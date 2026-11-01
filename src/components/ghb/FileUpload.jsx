import { useEffect, useId, useRef, useState } from "react";
import { UploadCloud, X, FileCheck2, Loader2, RefreshCw } from "lucide-react";
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
 * IndexedDB (via `pendingFile.js`) and its upload resumes automatically when
 * the page comes back — even if the platform killed the previous JS context
 * while the transfer was in flight.
 *
 * Pass `draftKey` (a unique slot name, e.g. "deposit_receipt") to enable the
 * resume behaviour. Without it, upload behaves like a plain uploader.
 */
export default function FileUpload({
  value,
  onChange,
  label = "Téléverser un fichier",
  accept = "image/*",
  hint = "",
  draftKey = "",
  capture,
}) {
  const inputRef = useRef(null);
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

  const resolvedCapture = capture ?? (accept.toLowerCase().includes("image") ? "environment" : undefined);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const openPicker = () => {
    if (busy) return;
    resetInput();
    if (typeof inputRef.current?.showPicker === "function") {
      inputRef.current.showPicker();
      return;
    }
    inputRef.current?.click();
  };

  const runUpload = async (file, { fromPending = false } = {}) => {
    const normalizedFile = await normalizeFile(file);
    const fileKey = `${normalizedFile.name}-${normalizedFile.size}-${normalizedFile.lastModified}`;
    if (valueRef.current || busy) return;
    setError("");
    setBusy(true);
    setName(normalizedFile.name);
    if (fromPending) setResuming(true);
    try {
      const uri = await uploadPrivate(normalizedFile);
      if (valueRef.current) {
        // A restored draft URI arrived in the meantime — drop this duplicate.
      } else {
        changeRef.current(uri, normalizedFile.name);
      }
      if (draftKey) await clearPendingFile(draftKey);
      lastHandledFileRef.current = fileKey;
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
      setResuming(false);
      resetInput();
    }
  };

  const handleFile = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file || busy) {
      if (!file) {
        setError("Aucun fichier n’a été reçu. Réessayez de choisir le document.");
      }
      return;
    }

    try {
      const normalizedFile = await normalizeFile(file);
      const fileKey = `${normalizedFile.name}-${normalizedFile.size}-${normalizedFile.lastModified}`;

      if (lastHandledFileRef.current === fileKey && value) {
        resetInput();
        return;
      }

      lastHandledFileRef.current = fileKey;
      setError("");
      setBusy(true);
      setName(normalizedFile.name);
      input.value = "";

      if (draftKey) await savePendingFile(draftKey, normalizedFile);
      const uri = await uploadPrivate(normalizedFile);
      if (valueRef.current) {
        // A restored draft URI arrived in the meantime — drop this duplicate.
      } else {
        changeRef.current(uri, normalizedFile.name);
      }
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
      resetInput();
    }
  };

  // Resume any interrupted upload from a previous page load.
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
        await runUpload(pending, { fromPending: true });
      } catch {
        // IndexedDB unavailable — keep the plain path.
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
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        capture={resolvedCapture}
        className="sr-only"
        aria-label={label}
        disabled={busy}
        onChange={handleFile}
      />
      {!value ? (
        <label
          htmlFor={inputId}
          aria-disabled={busy}
          onClick={(event) => {
            if (busy) event.preventDefault();
            else {
              event.preventDefault();
              openPicker();
            }
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center transition ${
            busy ? "cursor-wait opacity-60" : "cursor-pointer hover:border-[#D4AF37]/50 hover:bg-white/[0.04]"
          }`}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
          ) : (
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">
            {busy
              ? resuming
                ? `Reprise du téléversement de ${name}…`
                : `Téléversement de ${name}…`
              : name
                ? `Touchez pour réessayer : ${name}`
                : "Touchez pour choisir un fichier"}
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          {busy && !resuming && draftKey && (
            <span className="text-xs text-muted-foreground">
              <RefreshCw className="inline h-3 w-3" /> Vous pouvez quitter : l’envoi reprendra.
            </span>
          )}
          {busy && !resuming && !draftKey && (
            <span className="text-xs text-muted-foreground">Gardez cette page ouverte.</span>
          )}
        </label>
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
            onClick={openPicker}
            className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-foreground hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Changer
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="mt-1.5 break-words text-sm text-red-400">
          {name ? `${name} : ` : ""}{error}
        </div>
      )}
    </div>
  );
}
