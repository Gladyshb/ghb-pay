import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Power, MapPin } from "lucide-react";

const TYPES = [
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank", label: "Banque locale" },
  { value: "crypto", label: "Crypto / USDT" },
  { value: "international", label: "Compte international" },
];

const empty = { provider: "", type: "mobile_money", label: "", account_info: "", account_holder: "", currency: "USD", country: "", network: "", instructions: "", active: true };

export default function AddressesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.DepositAddress.filter({}, { sort: "type", limit: 100 })
      .then(({ items }) => setItems(items))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => { setForm(empty); setEditing("new"); };
  const openEdit = (a) => { setForm(a); setEditing(a.id); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing === "new") await base44.entities.DepositAddress.create(form);
      else await base44.entities.DepositAddress.update(editing, form);
      setEditing(null); load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const toggle = async (a) => {
    await base44.entities.DepositAddress.update(a.id, { active: !a.active });
    load();
  };

  const remove = async (a) => {
    if (!confirm("Supprimer cette adresse ?")) return;
    await base44.entities.DepositAddress.delete(a.id);
    load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Méthodes & adresses de dépôt</h2>
        <Button onClick={openNew} size="sm" className="ghb-gold-bg text-black"><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
      </div>
      <div className="space-y-2.5">
        {items.map((a) => (
          <div key={a.id} className="ghb-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{a.provider}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted-foreground"}`}>
                    {a.active ? "Actif" : "Inactif"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.label} · {a.currency} · {a.country}</div>
                <div className="text-xs text-foreground font-mono mt-1 break-all">{a.account_info}</div>
                {a.network && <div className="text-xs text-muted-foreground mt-0.5">Réseau: {a.network}</div>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => toggle(a)} title="Activer/Désactiver" className="text-muted-foreground hover:text-foreground">
                  <Power className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(a)} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucune adresse. Ajoutez-en une.</div>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing === "new" ? "Nouveau moyen de paiement" : "Modifier le moyen de paiement"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Nom de la méthode"><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="bg-white/5 border-white/10" placeholder="Lumicash, Zelle, USDT TRC20…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Catégorie">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Devise"><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="bg-white/5 border-white/10" /></Field>
            </div>
            <Field label="Libellé"><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="bg-white/5 border-white/10" /></Field>
            <Field label="Compte / Adresse"><Input value={form.account_info} onChange={(e) => setForm({ ...form, account_info: e.target.value })} className="bg-white/5 border-white/10 font-mono" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bénéficiaire"><Input value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} className="bg-white/5 border-white/10" /></Field>
              <Field label="Pays"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="bg-white/5 border-white/10" /></Field>
            </div>
            <Field label="Réseau (crypto)"><Input value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} className="bg-white/5 border-white/10" placeholder="TRC20, ERC20…" /></Field>
            <Field label="Instructions"><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} className="bg-white/5 border-white/10 resize-none" /></Field>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#D4AF37]" />
              Adresse active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="border-white/10">Annuler</Button>
            <Button onClick={save} disabled={saving} className="ghb-gold-bg text-black">{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MapPin className="w-4 h-4 mr-1" />} Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}