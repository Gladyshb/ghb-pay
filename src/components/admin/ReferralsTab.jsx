import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import StatusBadge from "@/components/ghb/StatusBadge";
import { formatDate, formatMoney } from "@/lib/ghb";
import { Loader2, Save, Gift, Users, Settings2 } from "lucide-react";

const REF_STATUS = {
  pending: { label: "En attente", tone: "amber" },
  rewarded: { label: "Récompensé", tone: "emerald" },
  void: { label: "Annulé", tone: "muted" },
};

export default function ReferralsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setting, setSetting] = useState(null);
  const [settingId, setSettingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Referral.filter({}, { sort: "-created_date", limit: 100 }),
      base44.entities.ReferralSetting.filter({ active: true }, { limit: 1 }),
    ]).then(([r, s]) => {
      setItems(r.items);
      if (s.items[0]) { setSetting(s.items[0]); setSettingId(s.items[0].id); }
      else setSetting({ commission_type: "percent", commission_value: 5, active: true });
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const saveSetting = async () => {
    setBusy(true);
    try {
      const payload = {
        commission_type: setting.commission_type,
        commission_value: Number(setting.commission_value),
        active: setting.active,
      };
      if (settingId) await base44.entities.ReferralSetting.update(settingId, payload);
      else { const c = await base44.entities.ReferralSetting.create(payload); setSettingId(c.id); }
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const markVoid = async (r) => {
    if (!confirm("Annuler ce parrainage (aucune récompense) ?")) return;
    await base44.entities.Referral.update(r.id, { status: "void" });
    load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  const totalEarned = items.filter((i) => i.status === "rewarded").reduce((s, i) => s + (i.reward_amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Settings */}
      <div className="ghb-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-foreground font-semibold text-sm"><Settings2 className="w-4 h-4 text-[#D4AF37]" /> Configuration de la commission</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Type de commission</div>
            <Select value={setting.commission_type} onValueChange={(v) => setSetting({ ...setting, commission_type: v })}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Pourcentage (%)</SelectItem>
                <SelectItem value="fixed">Montant fixe (USD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Valeur</div>
            <Input type="number" min="0" step="0.01" value={setting.commission_value} onChange={(e) => setSetting({ ...setting, commission_value: e.target.value })} className="bg-white/5 border-white/10" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={setting.active} onCheckedChange={(v) => setSetting({ ...setting, active: v })} /> Programme actif
        </label>
        <div className="text-xs text-muted-foreground">
          La récompense est créditée automatiquement sur le solde du parrain lors de la validation du premier transfert du filleul.
        </div>
        <Button onClick={saveSetting} disabled={busy} className="ghb-emerald-bg text-white w-full">
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Enregistrer les paramètres
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={Users} label="Parrainages" value={items.length} />
        <Stat icon={Gift} label="Récompensés" value={items.filter((i) => i.status === "rewarded").length} tone="emerald" />
        <Stat icon={Gift} label="Total crédité" value={`$${totalEarned.toFixed(2)}`} tone="gold" />
      </div>

      {/* List */}
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Parrainages actifs</div>
        {items.length === 0 ? (
          <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucun parrainage.</div>
        ) : items.map((r) => (
          <div key={r.id} className="ghb-card rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{r.referred_name || r.referred_email}</div>
              <div className="text-xs text-muted-foreground truncate">Parrain: {r.referrer_name || "—"} · {formatDate(r.created_date)}</div>
              {r.reward_amount > 0 && <div className="text-xs text-[#E8C65A] mt-0.5">+{formatMoney(r.reward_amount, "USD")}</div>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge meta={REF_STATUS} status={r.status} />
              {r.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => markVoid(r)} className="border-white/10 bg-white/5 h-8 text-xs">Annuler</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="ghb-card rounded-2xl p-3 text-center">
      <Icon className={`w-4 h-4 mx-auto mb-1 ${tone === "emerald" ? "text-emerald-400" : "text-[#D4AF37]"}`} />
      <div className={`text-lg font-bold ${tone === "gold" ? "ghb-gold-text" : tone === "emerald" ? "text-emerald-400" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}