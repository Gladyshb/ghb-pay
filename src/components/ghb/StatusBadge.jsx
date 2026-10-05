import { TONE_CLASSES } from "@/lib/ghb";

export default function StatusBadge({ meta, status }) {
  const m = meta?.[status] || { label: status, tone: "muted" };
  const cls = TONE_CLASSES[m.tone] || TONE_CLASSES.muted;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {m.label}
    </span>
  );
}