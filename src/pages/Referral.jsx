import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/lib/ghb";
import { ensureReferralCode } from "@/lib/referral";
import StatusBadge from "@/components/ghb/StatusBadge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Gift, Users, Wallet, Loader2, ChevronLeft, Link2, Ticket } from "lucide-react";

const REF_STATUS = {
  pending: { label: "En attente", tone: "amber" },
  rewarded: { label: "Récompensé", tone: "emerald" },
  void: { label: "Annulé", tone: "muted" },
};

export default function Referral() {
  const { user } = useCurrentUser();
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [stats, setStats] = useState({ invited: 0, rewarded: 0, earnings: 0 });
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) return;
      const myCode = await ensureReferralCode(user);
      if (!alive) return;
      setCode(myCode);
      setLink(`${window.location.origin}/register?ref=${myCode}`);
      try {
        const [agg, list] = await Promise.all([
          base44.entities.Referral.aggregate({
            query: { referrer_id: user.id },
            groupBy: "status",
            sum: ["reward_amount"],
          }),
          base44.entities.Referral.filter({ referrer_id: user.id }, { sort: "-created_date", limit: 50 }),
        ]);
        if (!alive) return;
        let invited = 0, rewarded = 0, earnings = 0;
        for (const r of (agg.rows || [])) {
          invited += r.count || 0;
          if (r.status === "rewarded") { rewarded += r.count || 0; earnings += r.sum_reward_amount || 0; }
        }
        setStats({ invited, rewarded, earnings });
        setReferrals(list.items || []);
      } catch {}
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" /> Accueil
      </Link>

      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Gift className="w-5 h-5 text-[#D4AF37]" /> Programme de parrainage
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invitez vos proches et gagnez une commission sur leur premier transfert validé.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Users} label="Invités" value={stats.invited} />
        <StatCard icon={Check} label="Récompensés" value={stats.rewarded} tone="emerald" />
        <StatCard icon={Wallet} label="Gains (USD)" value={`$${stats.earnings.toFixed(2)}`} tone="gold" />
      </div>

      {/* Referral link + code */}
      <div className="ghb-card rounded-2xl p-5 space-y-4">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Lien de parrainage</div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-foreground/80 truncate">{link}</div>
            <Button onClick={() => copy(link, "link")} className="ghb-gold-bg text-black hover:opacity-90 px-3">
              {copied === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Code promo</div>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-lg font-bold ghb-gold-text tracking-widest text-center">{code || "—"}</div>
            <Button onClick={() => copy(code, "code")} className="ghb-gold-bg text-black hover:opacity-90 px-3">
              {copied === "code" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Partagez ce lien. Dès qu'un filleul effectue son premier transfert validé, votre commission est créditée sur votre solde.
        </div>
      </div>

      {/* Referrals list */}
      <div className="ghb-card rounded-2xl p-5">
        <div className="text-foreground font-semibold mb-3 text-sm">Vos filleuls</div>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" /></div>
        ) : referrals.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Aucun filleul pour le moment. Partagez votre lien !</div>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02]">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{r.referred_name || r.referred_email}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.referred_email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.reward_amount > 0 && <span className="text-xs text-[#E8C65A] font-medium">+${r.reward_amount.toFixed(2)}</span>}
                  <StatusBadge meta={REF_STATUS} status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const valColor = tone === "emerald" ? "text-emerald-400" : tone === "gold" ? "ghb-gold-text" : "text-foreground";
  return (
    <div className="ghb-card rounded-2xl p-4 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${tone === "emerald" ? "text-emerald-400" : "text-[#D4AF37]"}`} />
      <div className={`text-xl font-bold ${valColor}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}