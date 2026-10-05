import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Megaphone, Loader2, ChevronRight } from "lucide-react";

export default function AnnouncementCarousel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Announcement.filter({ active: true }, { sort: "order", limit: 20 })
      .then(({ items }) => setItems(items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="ghb-card rounded-2xl p-5">
      <div className="flex items-center gap-2 text-foreground font-semibold mb-3">
        <Megaphone className="w-4 h-4 text-[#D4AF37]" /> Annonces & Promotions
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-3 text-center">Aucune annonce pour le moment.</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {items.map((a) => (
            <div key={a.id} className="min-w-[250px] max-w-[270px] shrink-0 rounded-xl bg-white/[0.03] border border-white/5 p-4 flex flex-col gap-2">
              <div className="text-2xl">{a.emoji || "📢"}</div>
              <div className="font-semibold text-foreground text-sm leading-snug">{a.title}</div>
              {a.body && <div className="text-xs text-muted-foreground leading-relaxed">{a.body}</div>}
              {a.cta_text && (
                a.cta_url ? (
                  <Link to={a.cta_url} className="mt-1 inline-flex items-center gap-1 text-xs text-[#E8C65A] font-medium hover:underline">
                    {a.cta_text} <ChevronRight className="w-3 h-3" />
                  </Link>
                ) : (
                  <div className="mt-1 text-xs text-[#E8C65A] font-medium">{a.cta_text}</div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}