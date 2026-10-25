import { useEffect, useState } from "react";
import { deleteRow, insertRow, selectRows, updateRow, updateRows } from "@/lib/supabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Activity } from "lucide-react";

const empty = { text: "", emoji: "⚡", order: 0, active: true };

export default function TickerTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    selectRows("ticker_messages", {}, { sort: "order", limit: 100 })
      .then(setItems)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    setBusy(true);
    try {
      if (editing === "new") await insertRow("ticker_messages", form);
      else await updateRow("ticker_messages", editing, form);
      setEditing(null); load();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const toggleAll = async (on) => {
    setBusy(true);
    try {
      const ids = items.map((i) => i.id);
      await updateRows("ticker_messages", ids, { active: on });
      load();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const toggle = async (m) => {
    await updateRow("ticker_messages", m.id, { active: !m.active });
    load();
  };

  const remove = async (m) => {
    if (!confirm("Supprimer ce message ?")) return;
    await deleteRow("ticker_messages", m.id);
    load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  const anyActive = items.some((i) => i.active);

  return (
    <div className="space-y-3">
      <div className="ghb-card rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground flex items-center gap-2"><Activity className="w-4 h-4 text-[#D4AF37]" /> Bandeau défilant</div>
          <div className="text-xs text-muted-foreground mt-0.5">Affichage {anyActive ? "activé" : "désactivé"} sur la page d'accueil.</div>
        </div>
        <Button onClick={() => toggleAll(!anyActive)} disabled={busy} variant={anyActive ? "outline" : "default"}
          className={anyActive ? "border-red-500/30 text-red-400 bg-white/5" : "ghb-emerald-bg text-white"}>
          {anyActive ? "Désactiver le bandeau" : "Activer le bandeau"}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{items.length} message(s)</div>
        <Button onClick={() => { setForm(empty); setEditing("new"); }} size="sm" className="ghb-gold-bg text-black hover:opacity-90"><Plus className="w-4 h-4 mr-1" /> Nouveau</Button>
      </div>

      {items.length === 0 ? (
        <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucun message.</div>
      ) : items.map((m) => (
        <div key={m.id} className="ghb-card rounded-2xl p-4 flex items-center gap-3">
          <div className="text-xl">{m.emoji || "⚡"}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground truncate">{m.text}</div>
            <div className="text-[10px] text-muted-foreground">Ordre: {m.order}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch checked={!!m.active} onCheckedChange={() => toggle(m)} />
            <Button size="icon" variant="outline" onClick={() => { setForm({ ...m }); setEditing(m.id); }} className="h-8 w-8 border-white/10 bg-white/5"><Pencil className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="outline" onClick={() => remove(m)} className="h-8 w-8 border-red-500/30 text-red-400 bg-white/5"><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>Message du bandeau</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[60px_1fr] gap-2">
              <Input placeholder="⚡" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="bg-white/5 border-white/10 text-center text-lg" />
              <Input placeholder="Texte du message" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className="bg-white/5 border-white/10" />
            </div>
            <Input type="number" placeholder="Ordre" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className="bg-white/5 border-white/10" />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Afficher dans le bandeau
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="border-white/10">Annuler</Button>
            <Button onClick={save} disabled={busy || !form.text.trim()} className="ghb-emerald-bg text-white">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}