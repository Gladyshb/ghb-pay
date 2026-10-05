import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Coins, RefreshCw, Zap, Lock } from "lucide-react";

const empty = { code: "", name: "", symbol: "", flag_emoji: "", type: "fiat", binance_rate: 0, fee_percent: 5, buy_rate: 0, sell_rate: 0, manual_override: false, active: true };

export default function CurrenciesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState(null);

  const load = () => {
    setLoading(true);
    base44.entities.Currency.filter({}, { sort: "code", limit: 100 })
      .then(({ items }) => setItems(items))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const recompute = (c, fee) => {
    const r = Number(c.binance_rate) || 0;
    const f = Number(fee) || 0;
    if (!r) return { fee_percent: f };
    return {
      fee_percent: f,
      sell_rate: +(r * (1 + f / 100)).toFixed(4),
      buy_rate: +(r * (1 - f / 100)).toFixed(4),
    };
  };

  const updateFee = async (c, fee) => {
    const f = Math.max(0, Number(fee) || 0);
    if (f === Number(c.fee_percent ?? 5)) return;
    await base44.entities.Currency.update(c.id, recompute(c, f));
    load();
  };

  const toggleActive = async (c) => { await base44.entities.Currency.update(c.id, { active: !c.active }); load(); };
  const toggleManual = async (c) => { await base44.entities.Currency.update(c.id, { manual_override: !c.manual_override }); load(); };

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("syncBinanceRates");
      const data = res?.data || res;
      setSyncInfo({ source: data?.source, synced: data?.synced });
      load();
    } catch (e) { alert(e.message); } finally { setSyncing(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        fee_percent: Number(form.fee_percent) || 0,
        buy_rate: Number(form.buy_rate) || 0,
        sell_rate: Number(form.sell_rate) || 0,
        binance_rate: Number(form.binance_rate) || 0,
      };
      if (editing === "new") await base44.entities.Currency.create(payload);
      else await base44.entities.Currency.update(editing, payload);
      setEditing(null); load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!confirm("Supprimer cette devise ?")) return;
    await base44.entities.Currency.delete(c.id); load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Sync bar */}
      <div className="ghb-card rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#D4AF37]" />
            <div>
              <div className="text-sm font-semibold text-foreground">Source des taux : Binance P2P (USDT)</div>
              <div className="text-[11px] text-muted-foreground">Rafraîchissement automatique toutes les heures</div>
            </div>
          </div>
          <Button onClick={sync} disabled={syncing} size="sm" className="ghb-emerald-bg text-white">
            {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />} Synchroniser
          </Button>
        </div>
        {syncInfo && (
          <div className="text-[11px] text-muted-foreground">
            Synchronisé : {syncInfo.synced} devise(s) · source : {syncInfo.source === "binance" ? "Binance P2P" : syncInfo.source === "fallback" ? "API de marché (repli)" : "—"}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{items.length} devise(s)</div>
        <Button onClick={() => { setForm(empty); setEditing("new"); }} size="sm" className="ghb-gold-bg text-black"><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
      </div>

      <div className="space-y-2.5">
        {items.map((c) => {
          const isBase = c.code === "USD" || c.code === "USDT";
          const fee = Number(c.fee_percent ?? 5);
          return (
            <div key={c.id} className="ghb-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{c.flag_emoji || "💱"}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{c.code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">{c.type}</span>
                      {c.manual_override && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#E8C65A] flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> manuel</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                  <Button size="sm" variant="ghost" onClick={() => { setForm(c); setEditing(c.id); }} className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)} className="text-red-400 h-8 w-8 p-0"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Rates grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/[0.03] py-2 px-1">
                  <div className="text-[9px] uppercase text-muted-foreground">Binance live</div>
                  <div className="text-sm font-semibold text-foreground truncate">{Number(c.binance_rate || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })}</div>
                </div>
                <div className="rounded-lg bg-emerald-500/[0.06] py-2 px-1">
                  <div className="text-[9px] uppercase text-muted-foreground">Achat (client vend)</div>
                  <div className="text-sm font-semibold text-emerald-400 truncate">{Number(c.buy_rate || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })}</div>
                </div>
                <div className="rounded-lg bg-[#D4AF37]/[0.06] py-2 px-1">
                  <div className="text-[9px] uppercase text-muted-foreground">Vente (client achète)</div>
                  <div className="text-sm font-semibold text-[#E8C65A] truncate">{Number(c.sell_rate || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })}</div>
                </div>
              </div>

              {/* Fee editor */}
              {!isBase && (
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Fee %</Label>
                  <Input
                    type="number" min="0" step="0.1" defaultValue={fee}
                    onBlur={(e) => updateFee(c, e.target.value)}
                    className="h-8 bg-white/5 border-white/10 text-sm w-20"
                  />
                  <span className="text-[10px] text-muted-foreground">Achat = Binance − Fee · Vente = Binance + Fee</span>
                  <button onClick={() => toggleManual(c)} className={`ml-auto text-[10px] flex items-center gap-1 px-2 py-1 rounded-full ${c.manual_override ? "bg-[#D4AF37]/10 text-[#E8C65A]" : "bg-white/5 text-muted-foreground"}`}>
                    <Lock className="w-2.5 h-2.5" /> {c.manual_override ? "Auto OFF" : "Auto ON"}
                  </button>
                </div>
              )}
              {c.last_synced_at && <div className="text-[10px] text-muted-foreground">Dernière synchro : {new Date(c.last_synced_at).toLocaleString("fr-FR")}</div>}
            </div>
          );
        })}
        {items.length === 0 && <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucune devise.</div>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing === "new" ? "Nouvelle devise" : "Modifier la devise"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={editing !== "new"} className="bg-white/5 border-white/10" placeholder="BIF" /></Field>
              <Field label="Symbole"><Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} className="bg-white/5 border-white/10" placeholder="FBu" /></Field>
            </div>
            <Field label="Nom"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10" placeholder="Franc burundais" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Drapeau (emoji)"><Input value={form.flag_emoji} onChange={(e) => setForm({ ...form, flag_emoji: e.target.value })} className="bg-white/5 border-white/10" placeholder="🇧🇮" /></Field>
              <Field label="Type">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="fiat">Fiat</SelectItem><SelectItem value="crypto">Crypto</SelectItem></SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Fee % (marge appliquée sur le taux Binance)"><Input type="number" min="0" step="0.1" value={form.fee_percent} onChange={(e) => setForm({ ...form, fee_percent: e.target.value })} className="bg-white/5 border-white/10" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taux d'achat (par USD)"><Input type="number" step="0.0001" value={form.buy_rate} onChange={(e) => setForm({ ...form, buy_rate: e.target.value })} className="bg-white/5 border-white/10" /></Field>
              <Field label="Taux de vente (par USD)"><Input type="number" step="0.0001" value={form.sell_rate} onChange={(e) => setForm({ ...form, sell_rate: e.target.value })} className="bg-white/5 border-white/10" /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.manual_override} onChange={(e) => setForm({ ...form, manual_override: e.target.checked })} className="accent-[#D4AF37]" /> Verrouillage manuel (la synchro Binance ne remplace pas ces taux)
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#D4AF37]" /> Devise active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="border-white/10">Annuler</Button>
            <Button onClick={save} disabled={saving} className="ghb-gold-bg text-black">{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Coins className="w-4 h-4 mr-1" />} Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}