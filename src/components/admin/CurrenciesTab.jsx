import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Coins } from "lucide-react";

const empty = { code: "", name: "", symbol: "", flag_emoji: "", type: "fiat", buy_rate: 0, sell_rate: 0, active: true };

export default function CurrenciesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.Currency.filter({}, { sort: "code", limit: 100 })
      .then(({ items }) => setItems(items))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, buy_rate: Number(form.buy_rate) || 0, sell_rate: Number(form.sell_rate) || 0 };
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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{items.length} devise(s)</div>
        <Button onClick={() => { setForm(empty); setEditing("new"); }} size="sm" className="ghb-gold-bg text-black"><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
      </div>
      <div className="space-y-2.5">
        {items.map((c) => (
          <div key={c.id} className="ghb-card rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl">{c.flag_emoji || "💱"}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{c.code}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">{c.type}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{c.name} · {c.symbol}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">Achat / Vente</div>
                <div className="text-sm"><span className="text-emerald-400">{c.buy_rate}</span> <span className="text-muted-foreground">/</span> <span className="text-[#E8C65A]">{c.sell_rate}</span></div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setForm(c); setEditing(c.id); }} className="text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(c)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucune devise.</div>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>{editing === "new" ? "Nouvelle devise" : "Modifier la devise"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={editing !== "new"} className="bg-white/5 border-white/10" placeholder="USDT" /></Field>
              <Field label="Symbole"><Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} className="bg-white/5 border-white/10" placeholder="$" /></Field>
            </div>
            <Field label="Nom"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10" placeholder="Tether USDT" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Drapeau (emoji)"><Input value={form.flag_emoji} onChange={(e) => setForm({ ...form, flag_emoji: e.target.value })} className="bg-white/5 border-white/10" placeholder="🇺🇸" /></Field>
              <Field label="Type">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="fiat">Fiat</SelectItem><SelectItem value="crypto">Crypto</SelectItem></SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taux d'achat (par USD)"><Input type="number" step="0.0001" value={form.buy_rate} onChange={(e) => setForm({ ...form, buy_rate: e.target.value })} className="bg-white/5 border-white/10" /></Field>
              <Field label="Taux de vente (par USD)"><Input type="number" step="0.0001" value={form.sell_rate} onChange={(e) => setForm({ ...form, sell_rate: e.target.value })} className="bg-white/5 border-white/10" /></Field>
            </div>
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