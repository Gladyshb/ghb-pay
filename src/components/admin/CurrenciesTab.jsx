import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Coins, RefreshCw, Zap, Lock } from "lucide-react";

const empty = { code: "", name: "", symbol: "", flag_emoji: "", type: "fiat", binance_rate: 0, fee_percent: 5, spread_fixed: 0, buy_rate: 0, sell_rate: 0, manual_override: false, active: true };

// Buy = reference + spread (GREEN) · Sell = reference - spread (WHITE)
function computeRates(ref, feePercent, spreadFixed) {
  const r = Number(ref) || 0;
  const fee = Number(feePercent) || 0;
  const spread = Number(spreadFixed) || 0;
  if (!r) return { buy: 0, sell: 0 };
  let buy, sell;
  if (spread > 0) {
    buy = +(r + spread).toFixed(4);
    sell = +Math.max(0, r - spread).toFixed(4);
  } else {
    buy = +(r * (1 + fee / 100)).toFixed(4);
    sell = +(r * (1 - fee / 100)).toFixed(4);
  }
  return { buy, sell };
}

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

  // Recompute Buy/Sell when fee or spread changes inline.
  const updateSpread = async (c, feeVal, spreadVal) => {
    const fee = Math.max(0, Number(feeVal) || 0);
    const spread = Math.max(0, Number(spreadVal) || 0);
    if (fee === Number(c.fee_percent ?? 5) && spread === Number(c.spread_fixed ?? 0)) return;
    const { buy, sell } = computeRates(c.binance_rate, fee, spread);
    await base44.entities.Currency.update(c.id, { fee_percent: fee, spread_fixed: spread, buy_rate: buy, sell_rate: sell });
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
      const ref = Number(form.binance_rate) || 0;
      const fee = Number(form.fee_percent) || 0;
      const spread = Number(form.spread_fixed) || 0;
      const { buy, sell } = computeRates(ref, fee, spread);
      const payload = {
        ...form,
        binance_rate: ref,
        fee_percent: fee,
        spread_fixed: spread,
        buy_rate: buy,
        sell_rate: sell,
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
              <div className="text-[11px] text-muted-foreground">Rafraîchissement automatique toutes les 12h · Référence manuelle pour les devises verrouillées</div>
            </div>
          </div>
          <Button onClick={sync} disabled={syncing} size="sm" className="ghb-emerald-bg text-white">
            {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />} Synchroniser
          </Button>
        </div>
        {syncInfo && (
          <div className="text-[11px] text-muted-foreground">
            Synchronisé : {syncInfo.synced} devise(s) · source : {syncInfo.source === "binance" ? "Binance P2P" : syncInfo.source === "fallback" ? "API de marché (repli)" : syncInfo.source === "manual" ? "Référence manuelle" : "—"}
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
          const spread = Number(c.spread_fixed ?? 0);
          return (
            <div key={c.id} className="ghb-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{c.flag_emoji || "💱"}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{c.code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">{c.type}</span>
                      {c.manual_override && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#E8C65A] flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> réf. manuelle</span>}
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

              {/* Rates grid: Référence (neutre) · Achat GREEN (higher) · Vente WHITE (lower) */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/[0.03] py-2 px-1">
                  <div className="text-[9px] uppercase text-muted-foreground">Référence</div>
                  <div className="text-sm font-semibold text-foreground truncate">{Number(c.binance_rate || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })}</div>
                </div>
                <div className="rounded-lg bg-emerald-500/[0.07] py-2 px-1 ring-1 ring-emerald-500/20">
                  <div className="text-[9px] uppercase text-emerald-400/80">Achat (client achète USDT)</div>
                  <div className="text-sm font-semibold text-emerald-400 truncate">{Number(c.buy_rate || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })}</div>
                </div>
                <div className="rounded-lg bg-white/[0.06] py-2 px-1 ring-1 ring-white/10">
                  <div className="text-[9px] uppercase text-muted-foreground">Vente (client vend USDT)</div>
                  <div className="text-sm font-semibold text-foreground truncate">{Number(c.sell_rate || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })}</div>
                </div>
              </div>

              {/* Spread / Fee editor */}
              {!isBase && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Spread fixe</Label>
                  <Input
                    type="number" min="0" step="1" defaultValue={spread}
                    onBlur={(e) => updateSpread(c, fee, e.target.value)}
                    className="h-8 bg-white/5 border-white/10 text-sm w-20"
                    placeholder="0"
                  />
                  <Label className="text-[11px] text-muted-foreground whitespace-nowrap ml-1">ou Fee %</Label>
                  <Input
                    type="number" min="0" step="0.1" defaultValue={fee}
                    onBlur={(e) => updateSpread(c, e.target.value, spread)}
                    className="h-8 bg-white/5 border-white/10 text-sm w-20"
                  />
                  <span className="text-[10px] text-muted-foreground">Achat = Réf + Spread · Vente = Réf − Spread</span>
                  <button onClick={() => toggleManual(c)} className={`ml-auto text-[10px] flex items-center gap-1 px-2 py-1 rounded-full ${c.manual_override ? "bg-[#D4AF37]/10 text-[#E8C65A]" : "bg-white/5 text-muted-foreground"}`}>
                    <Lock className="w-2.5 h-2.5" /> {c.manual_override ? "Réf manuelle" : "Réf auto"}
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
            <Field label="Taux de référence (par USD) — ex: 6000 pour le BIF"><Input type="number" min="0" step="0.0001" value={form.binance_rate} onChange={(e) => setForm({ ...form, binance_rate: e.target.value })} className="bg-white/5 border-white/10" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Spread fixe (ex: 150)"><Input type="number" min="0" step="1" value={form.spread_fixed} onChange={(e) => setForm({ ...form, spread_fixed: e.target.value })} className="bg-white/5 border-white/10" /></Field>
              <Field label="Fee % (si spread = 0)"><Input type="number" min="0" step="0.1" value={form.fee_percent} onChange={(e) => setForm({ ...form, fee_percent: e.target.value })} className="bg-white/5 border-white/10" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taux Achat (auto = Réf + Spread)"><Input type="number" step="0.0001" value={computeRates(form.binance_rate, form.fee_percent, form.spread_fixed).buy} disabled className="bg-white/5 border-white/10 text-emerald-400" /></Field>
              <Field label="Taux Vente (auto = Réf − Spread)"><Input type="number" step="0.0001" value={computeRates(form.binance_rate, form.fee_percent, form.spread_fixed).sell} disabled className="bg-white/5 border-white/10" /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.manual_override} onChange={(e) => setForm({ ...form, manual_override: e.target.checked })} className="accent-[#D4AF37]" /> Référence manuelle (la synchro auto ne remplace PAS le taux de référence ; Buy/Sell restent calculés)
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