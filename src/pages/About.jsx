import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, MapPin, Phone, Mail, Globe2, ShieldCheck, Zap, HeartHandshake, Loader2 } from "lucide-react";

export default function About() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.AboutContent.filter({ active: true }, { limit: 1 })
      .then(({ items }) => setContent(items[0] || null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  const c = content || {};

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" /> Accueil
      </Link>

      {/* Hero */}
      <div className="ghb-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="relative">
          <div className="text-3xl mb-2">🏦</div>
          <h1 className="text-2xl font-bold text-foreground">{c.title || "À propos de GHB Pay"}</h1>
          {c.intro && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{c.intro}</p>}
        </div>
      </div>

      {/* Vision */}
      {c.vision && (
        <div className="ghb-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-foreground font-semibold mb-2">
            <Globe2 className="w-4 h-4 text-[#D4AF37]" /> Ancrage local & Vision globale
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{c.vision}</p>
        </div>
      )}

      {/* Services */}
      {c.services && (
        <div className="ghb-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-foreground font-semibold mb-3">
            <Zap className="w-4 h-4 text-[#D4AF37]" /> Nos Services
          </div>
          <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{c.services}</div>
        </div>
      )}

      {/* Values */}
      {c.values && (
        <div className="ghb-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-foreground font-semibold mb-3">
            <HeartHandshake className="w-4 h-4 text-[#D4AF37]" /> Nos Valeurs
          </div>
          <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{c.values}</div>
        </div>
      )}

      {/* Contact */}
      <div className="ghb-card rounded-2xl p-5">
        <div className="flex items-center gap-2 text-foreground font-semibold mb-3">
          <ShieldCheck className="w-4 h-4 text-[#D4AF37]" /> Contact & Localisation
        </div>
        <div className="space-y-2 text-sm">
          {c.location && (
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4 text-emerald-400" /> {c.location}</div>
          )}
          {c.phone && (
            <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Phone className="w-4 h-4 text-emerald-400" /> {c.phone}</a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Mail className="w-4 h-4 text-emerald-400" /> {c.email}</a>
          )}
        </div>
      </div>
    </div>
  );
}