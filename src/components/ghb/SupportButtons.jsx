import { MessageCircle, Users, Phone } from "lucide-react";
import { useSupportLinks } from "@/lib/ghb";

export default function SupportButtons({ variant = "bar" }) {
  const links = useSupportLinks();

  const directUrl = links.direct?.url || `https://wa.me/${(links.phone || "").replace(/[^0-9]/g, "")}`;
  const groupUrl = links.group?.url || "https://chat.whatsapp.com/";

  if (variant === "stack") {
    return (
      <div className="flex flex-col gap-2.5 w-full">
        <a href={directUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl ghb-emerald-bg text-white text-sm font-semibold shadow-lg shadow-emerald-900/30">
          <MessageCircle className="w-4 h-4" />
          Support WhatsApp
        </a>
        <a href={groupUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#E8C65A] text-sm font-semibold">
          <Users className="w-4 h-4" />
          Rejoindre la communauté
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a href={directUrl} target="_blank" rel="noreferrer" title="Support WhatsApp"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg ghb-emerald-bg text-white text-xs font-semibold shadow">
        <MessageCircle className="w-3.5 h-3.5" /> Support
      </a>
      <a href={groupUrl} target="_blank" rel="noreferrer" title="Communauté WhatsApp"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#E8C65A] text-xs font-semibold">
        <Users className="w-3.5 h-3.5" /> Communauté
      </a>
      <a href={`tel:${(links.phone || "").replace(/\s/g, "")}`} title={links.phone}
        className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-foreground text-xs font-medium">
        <Phone className="w-3.5 h-3.5" /> {links.phone}
      </a>
    </div>
  );
}