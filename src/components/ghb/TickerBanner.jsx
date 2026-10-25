import { useEffect, useState } from "react";
import { selectRows } from "@/lib/supabaseData";

export default function TickerBanner() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    selectRows("ticker_messages", { active: true }, { sort: "order", limit: 50 })
      .then(setMessages)
      .catch((error) => { console.error("Failed to load ticker messages:", error); setMessages([]); });
  }, []);

  if (messages.length === 0) return null;

  const line = messages.map((m) => `${m.emoji || "⚡"}  ${m.text}`).join("      •      ");
  // Duplicated content for a seamless loop (animate -50%).
  const content = `${line}      •      ${line}      •      `;

  return (
    <div className="overflow-hidden border-y border-[#D4AF37]/20 bg-emerald-900/30 rounded-xl">
      <div className="ghb-marquee py-1.5 text-xs sm:text-sm text-foreground/90">
        {content}
      </div>
    </div>
  );
}