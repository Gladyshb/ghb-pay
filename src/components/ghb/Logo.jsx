import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function Logo({ compact = false, to = "/" }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 select-none">
      <div className="relative">
        <div className="w-9 h-9 rounded-xl ghb-emerald-bg flex items-center justify-center shadow-lg shadow-emerald-900/40 ring-1 ring-[#D4AF37]/40">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="font-heading font-extrabold text-[17px] tracking-tight text-foreground">
            GHB <span className="ghb-gold-text">Pay</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
            Gladys HB Business
          </div>
        </div>
      )}
    </Link>
  );
}