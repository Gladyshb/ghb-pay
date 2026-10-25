import { useEffect, useState } from "react";
import { deleteRow, insertRow, selectRows, updateRow } from "@/lib/supabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Megaphone } from "lucide-react";

const empty = { title: "", body: "", emoji: "📢", cta_text: "", cta_url: "", order: 0, active: true };

export default function AnnouncementsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    selectRows("announcements", {}, { sort: "order", limit: 100 })
      .then(setItems)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => { setForm(empty); setEditing("new"); };
  const openEdit = (a) => { setForm({ ...a }); setEditing(a.id); };

  const save = async () => {
    setBusy(true);
    try {
      if (editing === "new") await insertRow("announcements", form);
      else await updateRow("announcements", editing, form);
      setEditing(null); load();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const toggle = async (a) => {
    await updateRow("announcements", a.id, { active: !a.active });
    load();
  };

  const remove = async (a) => {
    if (!confirm("Supprimer cette annonce ?")) return;
    await deleteRow("announcements", a.id);
    load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{items.length} annonce(s)</div>
        <Button onClick={openNew} size="sm" className="ghb-gold-bg text-black hover:opacity-90"><Plus className="w-4 h-4 mr-1" /> Nouvelle</Button>
      </div>
      {items.length === 0 ? (
        <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucune annonce.</div>
      ) : items.map((a) => (
        <div key={a.id} className="ghb-card rounded-2xl p-4 flex items-start gap-3">
          <div className="text-2xl">{a.emoji || "📢"}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground text-sm">{a.title}</div>
            {a.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body}</div>}
            <div className="text-[10px] text-muted-foreground mt-1">Ordre: {a.order} {a.cta_text ? `· CTA: ${a.cta_text}` : ""}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch checked={!!a.active} onCheckedChange={() => toggle(a)} />
            <Button size="icon" variant="outline" onClick={() => openEdit(a)} className="h-8 w-8 border-white/10 bg-white/5"><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="outline" onClick={() => remove(a)} className="h-8 w-8 border-red-500/30 text-red-400 bg-white/5"><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-[#D4AF37]" /> Annonce</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <Input placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-white/5 border-white/10" />
              <Input placeholder="Emoji" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="bg-white/5 border-white/10 text-center text-lg" />
            </div>
            <Textarea placeholder="Description" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="bg-white/5 border-white/10" rows={3} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Texte du bouton (optionnel)" value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} className="bg-white/5 border-white/10" />
              <Input placeholder="Lien (ex: /transfer)" value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} className="bg-white/5 border-white/10" />
            </div>
            <Input type="number" placeholder="Ordre d'affichage" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className="bg-white/5 border-white/10" />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Afficher sur la page d'accueil
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="border-white/10">Annuler</Button>
            <Button onClick={save} disabled={busy || !form.title.trim()} className="ghb-emerald-bg text-white">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}