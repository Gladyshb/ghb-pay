import { useRef, useState } from "react";
import { UploadCloud, X, FileCheck2, Loader2 } from "lucide-react";
import { uploadPrivate } from "@/lib/ghb";

// A controlled file uploader. Stores the resulting private file_uri in onChange.
// `value` is the stored file_uri (string). `preview` optionally shows a signed URL image.
export default function FileUpload({ value, onChange, label = "Téléverser un fichier", accept = "image/*", hint }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setBusy(true);
    setName(file.name);
    try {
      const uri = await uploadPrivate(file);
      onChange(uri, file.name);
    } catch (e) {
      setError(e.message || "Échec du téléversement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {label && <div className="text-sm font-medium text-foreground mb-1.5">{label}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:border-[#D4AF37]/50 hover:bg-white/[0.04] transition text-center disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
          ) : (
            <UploadCloud className="w-6 h-6 text-muted-foreground" />
          )}
          <span className="text-sm text-foreground font-medium">
            {busy ? "Téléversement…" : "Cliquez pour téléverser"}
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <FileCheck2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground font-medium truncate">{name || "Fichier téléversé"}</div>
            <div className="text-xs text-emerald-400">Téléversé avec succès</div>
          </div>
          <button type="button" onClick={() => { onChange("", ""); setName(""); }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-white/15 text-foreground hover:bg-white/5">
            Changer
          </button>
        </div>
      )}
      {error && <div className="text-xs text-red-400 mt-1.5">{error}</div>}
    </div>
  );
}