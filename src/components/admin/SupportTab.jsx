import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, MessageCircle, Users, Phone } from "lucide-react";

const TYPES = [
  { value: "whatsapp_direct", label: "WhatsApp direct", icon: MessageCircle },
  { value: "whatsapp_group", label: "Groupe WhatsApp", icon: Users },
  { value: "phone", label: "Téléphone", icon: Phone },
];

const empty = { type: "whatsapp_direct", label: "", url: "", phone: "", active: true };

export default function SupportTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.SupportLink.filter({}, { sort: "type", limit: 50 })
      .then(({ items }) => setItems(items))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      if (editing === "new") await base44.entities.SupportLink.create(form);
      else await base44.entities.SupportLink.update(editing, form);
      setEditing(null); load();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const remove = async (s) => {
    if (!confirm("Supprimer ce lien ?")) return;
    await base44.entities.SupportLink.delete(s.id); load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Liens affichés aux utilisateurs</div>
        <Button onClick={() => { setForm(empty); setEditing("new"); }} size="sm" className="ghb-gold-bg text-black"><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
      </div>
      <div className="space-y-2.5">
        {items.map((s) => {
          const meta = TYPES.find((t) => t.value === s.type) || {};
          const Icon = meta.icon || MessageCircle;
          return (
            <div key={s.id} className="ghb-card rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><Icon className="w-5 h-5 text-[#D4AF37]" /></div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">{s.label || meta.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.url || s.phone || "—"}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setForm(s); setEditing(s.id); }} className="text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucun lien. Ajoutez le support WhatsApp.</div>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>{editing === "new" ? "Nouveau lien" : "Modifier le lien"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Libellé"><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="bg-white/5 border-white/10" placeholder="Support WhatsApp" /></Field>
            {form.type !== "phone" && (
              <Field label="URL"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="bg-white/5 border-white/10" placeholder="https://wa.me/25761659327" /></Field>
            )}
            {form.type === "phone" && (
              <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-white/5 border-white/10" placeholder="+257 616 59 327" /></Field>
            )}
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#D4AF37]" /> Lien actif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="border-white/10">Annuler</Button>
            <Button onClick={save} disabled={saving} className="ghb-gold-bg text-black">{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}