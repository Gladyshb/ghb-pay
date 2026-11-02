import { useEffect, useId, useRef, useState } from "react";
import { X, FileCheck2, Loader2, RefreshCw, Camera, FolderOpen } from "lucide-react";
import { uploadPrivate } from "@/lib/ghb";
import { savePendingFile, getPendingFile, clearPendingFile } from "@/lib/pendingFile";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1600;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function inferMimeType(file) {
  const type = (file.type || "").toLowerCase();
  if (type) return type;
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "";
}

async function convertToJpeg(file) {
  if (typeof document === "undefined" || !document.createElement) {
    throw new Error("La conversion d’image n’est pas disponible sur cet appareil.");
  }

  let source;
  let objectUrl;
  try {
    if (typeof createImageBitmap === "function") {
      source = await createImageBitmap(file, {
        resizeWidth: MAX_IMAGE_WIDTH,
        resizeQuality: "high",
      });
    } else if (typeof window !== "undefined" && window.Image) {
      objectUrl = URL.createObjectURL(file);
      source = new Image();
      source.decoding = "async";
      await new Promise((resolve, reject) => {
        source.onload = resolve;
        source.onerror = reject;
        source.src = objectUrl;
      });
    } else {
      throw new Error("Le navigateur ne peut pas traiter cette image.");
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_IMAGE_WIDTH / source.width);
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("La conversion d’image n’est pas disponible sur cet appareil.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("Impossible de réduire cette image. Choisissez un JPG ou PNG moins volumineux."));
          return;
        }
        resolve(result);
      }, "image/jpeg", 0.88);
    });

    const baseName = (file.name || "file").replace(/\.[^./]+$/, "");
    const convertedFile = new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    return convertedFile;
  } finally {
    if (typeof source?.close === "function") source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeFile(file) {
  const mimeType = inferMimeType(file);
  const extension = (file.name || "").toLowerCase();

  if (!mimeType && !/\.(png|jpe?g|webp|heic|heif|pdf)$/i.test(extension)) {
    throw new Error("Type de fichier non pris en charge. Utilisez JPG, PNG, WEBP ou PDF.");
  }

  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Format de fichier non pris en charge. Veuillez choisir une image JPG/PNG/WEBP ou un PDF.");
  }

  const isHeic = mimeType === "image/heic" || mimeType === "image/heif" || /\.(heic|heif)$/i.test(extension);
  if (isHeic || mimeType?.startsWith("image/")) {
    let convertedFile;
    try {
      convertedFile = await convertToJpeg(file);
    } catch {
      if (isHeic) {
        throw new Error("Le téléphone n’a pas assez de mémoire pour convertir cette photo HEIC. Choisissez un JPG/PNG dans la galerie ou réduisez la photo puis réessayez.");
      }
      throw new Error("Le téléphone n’a pas assez de mémoire pour traiter cette photo. Choisissez une image moins volumineuse puis réessayez.");
    }
    if (convertedFile.size > MAX_FILE_SIZE_BYTES) {
      throw new Error("L’image reste trop volumineuse après réduction. Essayez une photo moins détaillée.");
    }
    return convertedFile;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Le fichier est trop volumineux. Sélectionnez une image ou un PDF de moins de 10 Mo.");
  }

  return file;
}

/**
 * File picker that survives a page reload: the selected file is mirrored in
 * IndexedDB and resumed automatically when the page returns.
 */
export default function FileUpload({
  value,
  onChange,
  label = "Téléverser un fichier",
  accept = "image/*",
  hint = "",
  draftKey = "",
}) {
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const inputId = useId();
  const lastHandledFileRef = useRef("");
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [resuming, setResuming] = useState(false);

  const resetInput = (inputRefValue) => {
    if (inputRefValue?.current) inputRefValue.current.value = "";
  };

  const openGalleryPicker = () => {
    if (busy) return;
    resetInput(galleryInputRef);
    if (typeof galleryInputRef.current?.showPicker === "function") {
      galleryInputRef.current.showPicker();
      return;
    }
    galleryInputRef.current?.click();
  };

  const openCameraPicker = () => {
    if (busy) return;
    resetInput(cameraInputRef);
    if (typeof cameraInputRef.current?.showPicker === "function") {
      cameraInputRef.current.showPicker();
      return;
    }
    cameraInputRef.current?.click();
  };

  const handleFileSelection = async (file) => {
    if (!file || busy) {
      if (!file) setError("Aucun fichier n’a été reçu. Réessayez de choisir le document.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      // Persist the selected file before decoding or resizing it. Mobile
      // browsers may reload the page while processing large gallery images.
      if (draftKey) await savePendingFile(draftKey, file);

      const normalizedFile = await normalizeFile(file);
      const fileKey = `${normalizedFile.name}-${normalizedFile.size}-${normalizedFile.lastModified}`;

      if (lastHandledFileRef.current === fileKey && value) {
        resetInput(galleryInputRef);
        resetInput(cameraInputRef);
        return;
      }

      lastHandledFileRef.current = fileKey;
      setName(normalizedFile.name);

      const uri = await uploadPrivate(normalizedFile);
      changeRef.current(uri, normalizedFile.name);
      if (draftKey) await clearPendingFile(draftKey);
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Échec du téléversement.");
    } finally {
      setBusy(false);
      resetInput(galleryInputRef);
      resetInput(cameraInputRef);
    }
  };

  const handleGallery = async (event) => {
    const file = event.currentTarget.files?.[0];
    await handleFileSelection(file);
  };

  const handleCamera = async (event) => {
    const file = event.currentTarget.files?.[0];
    await handleFileSelection(file);
  };

  useEffect(() => {
    if (!draftKey) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (valueRef.current) {
          await clearPendingFile(draftKey);
          return;
        }
        const pending = await getPendingFile(draftKey);
        if (cancelled || !pending || busy || valueRef.current) return;
        setBusy(true);
        setResuming(true);
        setName(pending.name);
        const uri = await uploadPrivate(await normalizeFile(pending));
        if (!valueRef.current) changeRef.current(uri, pending.name);
        if (draftKey) await clearPendingFile(draftKey);
        setError("");
      } catch (resumeError) {
        setError(resumeError instanceof Error ? resumeError.message : "La reprise du téléversement a échoué. Réessayez.");
      } finally {
        if (!cancelled) {
          setBusy(false);
          setResuming(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  return (
    <div>
      {label && <div className="mb-1.5 text-sm font-medium text-foreground">{label}</div>}

      <input
        ref={galleryInputRef}
        id={`${inputId}-gallery`}
        type="file"
        accept={accept}
        className="hidden"
        aria-label={`${label} depuis la galerie`}
        disabled={busy}
        onChange={handleGallery}
      />

      <input
        ref={cameraInputRef}
        id={`${inputId}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label={`${label} depuis la caméra`}
        disabled={busy}
        onChange={handleCamera}
      />

      {!value ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={openCameraPicker}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-3 text-sm font-medium text-[#F6D77C] transition ${
              busy ? "cursor-wait opacity-60" : "hover:bg-[#D4AF37]/20"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Utiliser la caméra
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={openGalleryPicker}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-4 py-3 text-sm font-medium text-foreground transition ${
              busy ? "cursor-wait opacity-60" : "hover:border-[#D4AF37]/50 hover:bg-white/[0.04]"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            Choisir depuis la galerie
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3">
          <FileCheck2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{name || "Fichier téléversé"}</div>
            <div className="text-xs text-emerald-400">Téléversé avec succès</div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onChange("", "");
              setName("");
              setError("");
              lastHandledFileRef.current = "";
              if (draftKey) clearPendingFile(draftKey);
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Supprimer le fichier sélectionné"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={openGalleryPicker}
            className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-foreground hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Changer
          </button>
        </div>
      )}

      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
      {busy && !resuming && draftKey && (
        <div className="mt-2 text-xs text-muted-foreground">
          <RefreshCw className="inline h-3 w-3" /> Vous pouvez quitter : l’envoi reprendra.
        </div>
      )}
      {busy && !resuming && !draftKey && (
        <div className="mt-2 text-xs text-muted-foreground">Gardez cette page ouverte.</div>
      )}
      {error && (
        <div role="alert" className="mt-2 break-words text-sm text-red-400">
          {name ? `${name} : ` : ""}{error}
        </div>
      )}
    </div>
  );
}
