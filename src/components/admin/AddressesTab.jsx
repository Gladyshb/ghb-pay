import { useEffect, useState } from "react";
import { deleteRow, insertRow, selectRows, updateRow } from "@/lib/supabaseData";
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

const COLORS = ["#D4AF37", "#10B981", "#3B82F6", "#8B5CF6", "#F97316", "#EF4444", "#14B8A6", "#EC4899", "#64748B"];
const ICONS = ["📱", "🏦", "₮", "💳", "🌍", "💰", "🔗", "🪙", "⚡", "🏛️", "💸", "🟢", " PayPal", "WU"];

const empty = { provider: "", type: "mobile_money", label: "", account_info: "", account_holder: "", currency: "USD", country: "", network: "", instructions: "", accent_color: "#D4AF37", icon: "", card_style: "standard", active: true };

export default function AddressesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    selectRows("deposit_addresses", {}, { sort: "type", limit: 100 })
      .then(setItems)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => { setForm(empty); setEditing("new"); };
  const openEdit = (a) => { setForm(a); setEditing(a.id); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing === "new") await insertRow("deposit_addresses", form);
      else await updateRow("deposit_addresses", editing, form);
      setEditing(null); load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const toggle = async (a) => {
    await updateRow("deposit_addresses", a.id, { active: !a.active });
    load();
  };

  const remove = async (a) => {
    if (!confirm("Supprimer cette adresse ?")) return;
    await deleteRow("deposit_addresses", a.id);
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
              <div className="min-w-0 flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: (a.accent_color || "#D4AF37") + "1F", color: a.accent_color || "#D4AF37", border: `1px solid ${(a.accent_color || "#D4AF37")}55` }}>
                  {a.icon || TYPES.find((t) => t.value === a.type)?.label.charAt(0)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{a.provider}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted-foreground"}`}>
                      {a.active ? "Actif" : "Inactif"}
                    </span>
                    {a.card_style === "highlighted" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">Mis en avant</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.label} · {a.currency} · {a.country}</div>
                  <div className="text-xs text-foreground font-mono mt-1 break-all">{a.account_info}</div>
                  {a.network && <div className="text-xs text-muted-foreground mt-0.5">Réseau: {a.network}</div>}
                </div>
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

            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, accent_color: c })}
                    className={`w-8 h-8 rounded-full border-2 transition ${form.accent_color === c ? "border-white scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                  className="w-8 h-8 rounded-full bg-transparent border border-white/10 cursor-pointer p-0" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Icône / Logo</Label>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => setForm({ ...form, icon: ic })}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition ${form.icon === ic ? "border-[#D4AF37] bg-white/10" : "border-white/10 bg-white/[0.03]"}`}>
                    {ic}
                  </button>
                ))}
              </div>
              <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="bg-white/5 border-white/10" placeholder="Ou saisissez un emoji / texte personnalisé" />
            </div>

            <div className="space-y-2">
              <Label>Présentation de la carte</Label>
              <Select value={form.card_style} onValueChange={(v) => setForm({ ...form, card_style: v })}>
                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (subtile)</SelectItem>
                  <SelectItem value="highlighted">Mise en avant (bordure colorée)</SelectItem>
                </SelectContent>
              </Select>
            </div>

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