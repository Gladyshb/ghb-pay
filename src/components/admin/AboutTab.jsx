import { useEffect, useState } from "react";
import { insertRow, selectRows, updateRow } from "@/lib/supabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Info } from "lucide-react";

const empty = { title: "", intro: "", vision: "", services: "", values: "", location: "", phone: "", email: "", active: true };

export default function AboutTab() {
  const [form, setForm] = useState(empty);
  const [id, setId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    selectRows("about_content", {}, { limit: 1 })
      .then((rows) => {
        if (rows[0]) {
          const row = rows[0];
          setForm({
            title: row.title ?? "",
            intro: row.intro ?? "",
            vision: row.vision ?? "",
            services: row.services ?? "",
            values: row.values ?? "",
            location: row.location ?? "",
            phone: row.phone ?? "",
            email: row.email ?? "",
            active: row.active ?? true,
          });
          setId(row.id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      if (id) await updateRow("about_content", id, form);
      else { const c = await insertRow("about_content", form); setId(c.id); }
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="ghb-card rounded-2xl p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-[#D4AF37] shrink-0" />
        Ce contenu alimente la page « À propos ». Un seul enregistrement est utilisé (le premier actif).
      </div>
      <div className="ghb-card rounded-2xl p-5 space-y-3">
        <Field label="Titre principal">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-white/5 border-white/10" />
        </Field>
        <Field label="Introduction">
          <Textarea value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} className="bg-white/5 border-white/10" rows={3} />
        </Field>
        <Field label="Ancrage local & Vision globale">
          <Textarea value={form.vision} onChange={(e) => setForm({ ...form, vision: e.target.value })} className="bg-white/5 border-white/10" rows={4} />
        </Field>
        <Field label="Nos Services (une ligne par service, préfixez par •)">
          <Textarea value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} className="bg-white/5 border-white/10" rows={4} />
        </Field>
        <Field label="Nos Valeurs (une ligne par valeur, préfixez par •)">
          <Textarea value={form.values} onChange={(e) => setForm({ ...form, values: e.target.value })} className="bg-white/5 border-white/10" rows={4} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Localisation">
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="bg-white/5 border-white/10" />
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-white/5 border-white/10" />
          </Field>
        </div>
        <Field label="Email">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white/5 border-white/10" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Page active
        </label>
        <Button onClick={save} disabled={busy || !form.title.trim()} className="ghb-emerald-bg text-white w-full">
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Enregistrer
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}