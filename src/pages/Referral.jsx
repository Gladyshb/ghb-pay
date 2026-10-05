import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser, formatMoney, formatDate } from "@/lib/ghb";
import { ensureReferralCode } from "@/lib/referral";
import StatusBadge from "@/components/ghb/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Gift, Users, Wallet, Loader2, ChevronLeft, Link2, Ticket, Pencil, Save, X } from "lucide-react";

const REF_STATUS = {
  pending: { label: "Inscrit", tone: "amber" },
  rewarded: { label: "Actif - 1er transfert", tone: "emerald" },
  void: { label: "Annulé", tone: "muted" },
};

const REASON = {
  taken: "Ce code est déjà utilisé. Choisissez-en un autre.",
  invalid_format: "Code invalide : 3 à 20 caractères (lettres majuscules et chiffres uniquement).",
  no_code: "Veuillez saisir un code.",
  lookup_failed: "Vérification impossible, réessayez.",
};

export default function Referral() {
  const { user } = useCurrentUser();
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [stats, setStats] = useState({ invited: 0, rewarded: 0, earnings: 0 });
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  // Custom code editing
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeOk, setCodeOk] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) return;
      const myCode = await ensureReferralCode(user);
      if (!alive) return;
      setCode(myCode);
      setDraft(myCode);
      setLink(`${window.location.origin}/register?ref=${myCode}`);
      try {
        const [agg, list] = await Promise.all([
          base44.entities.Referral.aggregate({
            query: { referrer_id: user.id },
            groupBy: "status",
            sum: ["reward_amount"],
          }),
          base44.entities.Referral.filter({ referrer_id: user.id }, { sort: "-created_date", limit: 100 }),
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

  const startEdit = () => { setDraft(code); setEditing(true); setCodeError(""); setCodeOk(false); };

  const cancelEdit = () => { setEditing(false); setDraft(code); setCodeError(""); };

  const saveCode = async () => {
    const normalized = draft.trim().toUpperCase();
    setCodeError("");
    setCodeOk(false);
    if (normalized === code) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("updateReferralCode", { code: normalized });
      const data = res?.data || res;
      if (data?.ok) {
        setCode(data.code);
        setDraft(data.code);
        setLink(`${window.location.origin}/register?ref=${data.code}`);
        setEditing(false);
        setCodeOk(true);
        setTimeout(() => setCodeOk(false), 2500);
      } else {
        setCodeError(REASON[data?.reason] || "Échec de la mise à jour.");
      }
    } catch (e) {
      setCodeError(e?.message || "Échec de la mise à jour.");
    } finally {
      setSaving(false);
    }
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

      {/* Referral link + custom code */}
      <div className="ghb-card rounded-2xl p-5 space-y-4">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Lien de parrainage</div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-foreground/80 truncate">{link}</div>
            <Button onClick={() => copy(link, "link")} className="ghb-gold-bg text-black hover:opacity-90 px-3">
              {copied === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Code promo personnalisé</span>
            {!editing && (
              <button onClick={startEdit} className="flex items-center gap-1 text-[11px] text-[#E8C65A] hover:underline">
                <Pencil className="w-3 h-3" /> Personnaliser
              </button>
            )}
          </div>
          {!editing ? (
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-lg font-bold ghb-gold-text tracking-widest text-center">{code || "—"}</div>
              <Button onClick={() => copy(code, "code")} className="ghb-gold-bg text-black hover:opacity-90 px-3">
                {copied === "code" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())}
                  placeholder="ex : GLADYS257" maxLength={20}
                  className="flex-1 h-11 bg-white/5 border-white/10 text-lg font-bold ghb-gold-text tracking-widest uppercase" />
                <Button onClick={saveCode} disabled={saving} className="ghb-emerald-bg text-white px-3">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
                <Button onClick={cancelEdit} variant="outline" className="border-white/10 bg-white/5 px-3">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground">3 à 20 caractères (lettres majuscules et chiffres). Le lien s'ajuste automatiquement.</div>
              {codeError && <div className="text-xs text-red-400">{codeError}</div>}
              {codeOk && <div className="text-xs text-emerald-400">Code mis à jour avec succès.</div>}
            </div>
          )}
        </div>

        <div className="text-[11px] text-muted-foreground">
          Partagez ce lien. Dès qu'un filleul effectue son premier transfert validé, votre commission est créditée sur votre solde.
        </div>
      </div>

      {/* Detailed filleuls table */}
      <div className="ghb-card rounded-2xl p-5">
        <div className="text-foreground font-semibold mb-3 text-sm">Mes filleuls / Personnes parrainées</div>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" /></div>
        ) : referrals.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Aucun filleul pour le moment. Partagez votre lien !</div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground border-b border-white/10">
                  <th className="text-left font-medium py-2 pr-3">Pseudonyme</th>
                  <th className="text-left font-medium py-2 pr-3">Inscrit le</th>
                  <th className="text-left font-medium py-2 pr-3">Statut</th>
                  <th className="text-right font-medium py-2">Commission</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-foreground truncate">{r.referred_username || r.referred_name || "Membre"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.referred_email}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.created_date)}</td>
                    <td className="py-2.5 pr-3"><StatusBadge meta={REF_STATUS} status={r.status} /></td>
                    <td className="py-2.5 text-right text-xs font-medium text-[#E8C65A] whitespace-nowrap">
                      {r.reward_amount > 0 ? `+${formatMoney(r.reward_amount, "USD")}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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