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
const ALLOWED_EXTENSIONS = /\.(png|jpe?g|webp|heic|heif|pdf)$/i;

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

/**
 * Garantit un vrai objet File (nom + type). Utile quand le fichier revient
 * d'IndexedDB sous forme de Blob, ou sans nom sur certains navigateurs mobiles.
 */
function ensureFile(candidate) {
  if (candidate instanceof File && candidate.name) return candidate;
  const name = candidate?.name || `fichier-${Date.now()}`;
  const type = candidate?.type || "";
  return new File([candidate], name, { type, lastModified: candidate?.lastModified || Date.now() });
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
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("Impossible de réduire cette image. Choisissez un JPG ou PNG moins volumineux."));
            return;
          }
          resolve(result);
        },
        "image/jpeg",
        0.88,
      );
    });

    // Libère la mémoire du canvas (important sur mobile).
    canvas.width = 0;
    canvas.height = 0;

    const baseName = (file.name || "file").replace(/\.[^./]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    if (typeof source?.close === "function") source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeFile(inputFile) {
  const file = ensureFile(inputFile);
  const mimeType = inferMimeType(file);
  const fileName = (file.name || "").toLowerCase();

  if (!mimeType && !ALLOWED_EXTENSIONS.test(fileName)) {
    throw new Error("Type de fichier non pris en charge. Utilisez JPG, PNG, WEBP ou PDF.");
  }

  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Format de fichier non pris en charge. Veuillez choisir une image JPG/PNG/WEBP ou un PDF.");
  }

  const isHeic = mimeType === "image/heic" || mimeType === "image/heif" || /\.(heic|heif)$/i.test(fileName);
  const isImage = isHeic || mimeType.startsWith("image/");

  if (isImage) {
    let convertedFile;
    try {
      convertedFile = await convertToJpeg(file);
    } catch (conversionError) {
      console.warn("[FileUpload] conversion échouée", conversionError);
      if (isHeic) {
        throw new Error(
          "Le téléphone n’a pas pu convertir cette photo HEIC. Choisissez un JPG/PNG dans la galerie ou réduisez la photo puis réessayez.",
        );
      }
      throw new Error("Le téléphone n’a pas pu traiter cette photo. Choisissez une image moins volumineuse puis réessayez.");
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
 * Sélecteur de fichier qui survit à un rechargement de page : le fichier choisi
 * est sauvegardé (tel quel, avant tout traitement) dans IndexedDB puis repris
 * automatiquement au retour sur la page.
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
  const busyRef = useRef(false);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [resuming, setResuming] = useState(false);

  const setBusyState = (next) => {
    busyRef.current = next;
    setBusy(next);
  };

  const resetInputs = () => {
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // .click() est plus fiable que showPicker() pour les inputs fichier sur mobile.
  const openPicker = (inputRef) => {
    if (busyRef.current) return;
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  };

  const safeClearPending = async () => {
    if (!draftKey) return;
    try {
      await clearPendingFile(draftKey);
    } catch (clearError) {
      console.warn("[FileUpload] clearPendingFile a échoué", clearError);
    }
  };

  const handleFileSelection = async (file) => {
    if (!file) {
      setError("Aucun fichier n’a été reçu. Réessayez de choisir le document.");
      return;
    }
    if (busyRef.current) return;

    setBusyState(true);
    setError("");
    setName(file.name || "");

    try {
      // 1) Sauvegarde du fichier ORIGINAL avant tout traitement lourd :
      //    les navigateurs mobiles peuvent recharger la page pendant le décodage.
      if (draftKey) {
        try {
          await savePendingFile(draftKey, file);
        } catch (saveError) {
          console.warn("[FileUpload] savePendingFile a échoué", saveError);
        }
      }

      // 2) Conversion / réduction.
      const normalizedFile = await normalizeFile(file);
      const fileKey = `${normalizedFile.name}-${normalizedFile.size}-${normalizedFile.lastModified}`;

      if (lastHandledFileRef.current === fileKey && valueRef.current) {
        await safeClearPending();
        return;
      }

      lastHandledFileRef.current = fileKey;
      setName(normalizedFile.name);

      // 3) Envoi.
      const uri = await uploadPrivate(normalizedFile);
      changeRef.current(uri, normalizedFile.name);
      await safeClearPending();
      setError("");
    } catch (uploadError) {
      console.warn("[FileUpload] échec", uploadError);
      // On vide la sauvegarde pour ne pas relancer en boucle un fichier invalide.
      await safeClearPending();
      setError(uploadError instanceof Error ? uploadError.message : "Échec du téléversement.");
    } finally {
      setBusyState(false);
      resetInputs();
    }
  };

  const handleInputChange = async (event) => {
    const file = event.currentTarget.files?.[0];
    await handleFileSelection(file);
  };

  // Reprise automatique après rechargement de la page.
  useEffect(() => {
    if (!draftKey) return undefined;
    let cancelled = false;

    (async () => {
      let resumedStarted = false;
      try {
        if (valueRef.current) {
          await safeClearPending();
          return;
        }

        const pending = await getPendingFile(draftKey);
        if (cancelled || !pending || busyRef.current || valueRef.current) return;

        resumedStarted = true;
        setBusyState(true);
        setResuming(true);

        const pendingFile = ensureFile(pending);
        setName(pendingFile.name);

        const normalizedFile = await normalizeFile(pendingFile);
        const uri = await uploadPrivate(normalizedFile);
        if (!valueRef.current) changeRef.current(uri, normalizedFile.name);
        await safeClearPending();
        setError("");
      } catch (resumeError) {
        console.warn("[FileUpload] reprise échouée", resumeError);
        await safeClearPending();
        if (!cancelled) {
          setError(
            resumeError instanceof Error
              ? resumeError.message
              : "La reprise du téléversement a échoué. Réessayez.",
          );
        }
      } finally {
        if (resumedStarted && !cancelled) {
          setBusyState(false);
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
        onChange={handleInputChange}
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
        onChange={handleInputChange}
      />

      {!value ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => openPicker(cameraInputRef)}
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
            onClick={() => openPicker(galleryInputRef)}
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
              safeClearPending();
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Supprimer le fichier sélectionné"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => openPicker(galleryInputRef)}
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
      {busy && resuming && (
        <div className="mt-2 text-xs text-muted-foreground">Reprise de l’envoi en cours…</div>
      )}
      {busy && !resuming && !draftKey && (
        <div className="mt-2 text-xs text-muted-foreground">Gardez cette page ouverte.</div>
      )}
      {error && (
        <div role="alert" className="mt-2 break-words text-sm text-red-400">
          {name ? `${name} : ` : ""}
          {error}
        </div>
      )}
    </div>
  );
}