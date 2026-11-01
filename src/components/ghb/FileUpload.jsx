import { useEffect, useId, useRef, useState } from "react";
import { UploadCloud, X, FileCheck2, Loader2, RefreshCw, Camera, FolderOpen } from "lucide-react";
import { uploadPrivate } from "@/lib/ghb";
import { savePendingFile, getPendingFile, clearPendingFile } from "@/lib/pendingFile";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
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
  if (typeof window === "undefined" || !window.Image || !document?.createElement) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas unavailable on this device.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("Impossible de convertir l’image sélectionnée."));
          return;
        }
        resolve(result);
      }, "image/jpeg", 0.9);
    });

    const baseName = (file.name || "file").replace(/\.[^./]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeFile(file) {
  const mimeType = inferMimeType(file);
  const extension = (file.name || "").toLowerCase();

  if (!mimeType && !/\.(png|jpe?g|webp|heic|heif|pdf)$/i.test(extension)) {
    throw new Error("Type de fichier non pris en charge. Utilisez JPG, PNG, WEBP ou PDF.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Le fichier est trop volumineux. Sélectionnez une image ou un PDF de moins de 10 Mo.");
  }

  if (mimeType === "image/heic" || mimeType === "image/heif" || /\.(heic|heif)$/i.test(extension)) {
    try {
      return await convertToJpeg(file);
    } catch {
      throw new Error("Le format HEIC/HEIF n’est pas compatible sur ce téléphone. Convertissez l’image en JPG/PNG puis réessayez.");
    }
  }

  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Format de fichier non pris en charge. Veuillez choisir une image JPG/PNG/WEBP ou un PDF.");
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

    try {
      const normalizedFile = await normalizeFile(file);
      const fileKey = `${normalizedFile.name}-${normalizedFile.size}-${normalizedFile.lastModified}`;

      if (lastHandledFileRef.current === fileKey && value) {
        resetInput(galleryInputRef);
        resetInput(cameraInputRef);
        return;
      }

      lastHandledFileRef.current = fileKey;
      setError("");
      setBusy(true);
      setName(normalizedFile.name);
      if (draftKey) await savePendingFile(draftKey, normalizedFile);

      const uri = await uploadPrivate(normalizedFile);
      if (!valueRef.current) changeRef.current(uri, normalizedFile.name);
      if (draftKey) await clearPendingFile(draftKey);
      setError("");
    } catch (uploadError) {
      if (valueRef.current) {
        if (draftKey) await clearPendingFile(draftKey);
        setError("");
      } else {
        setError(uploadError instanceof Error ? uploadError.message : "Échec du téléversement.");
      }
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
      } catch {
        // no-op
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
