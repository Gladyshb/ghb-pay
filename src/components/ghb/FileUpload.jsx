import { useEffect, useId, useRef, useState } from "react";
import { UploadCloud, X, FileCheck2, Loader2, RefreshCw } from "lucide-react";
import { uploadPrivate } from "@/lib/ghb";
import { savePendingFile, getPendingFile, clearPendingFile } from "@/lib/pendingFile";

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

  const runUpload = async (file, { fromPending = false } = {}) => {
    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    if (valueRef.current || busy) return;
    setError("");
    setBusy(true);
    setName(file.name);
    if (fromPending) setResuming(true);
    try {
      const uri = await uploadPrivate(file);
      if (valueRef.current) {
        // A restored draft URI arrived in the meantime — drop this duplicate.
      } else {
        changeRef.current(uri, file.name);
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

    if (file.size === 0) {
      setError("Le fichier sélectionné est vide.");
      input.value = "";
      return;
    }

    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    if (lastHandledFileRef.current === fileKey && value) {
      input.value = "";
      return;
    }

    lastHandledFileRef.current = fileKey;
    setError("");
    setBusy(true);
    setName(file.name);
    input.value = "";

    try {
      if (draftKey) await savePendingFile(draftKey, file);
      const uri = await uploadPrivate(file);
      if (valueRef.current) {
        // A restored draft URI arrived in the meantime — drop this duplicate.
      } else {
        changeRef.current(uri, file.name);
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
            <X className="h-4 h-4" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
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
