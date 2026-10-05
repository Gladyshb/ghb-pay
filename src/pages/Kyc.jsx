import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser, KYC_META, uploadPrivate } from "@/lib/ghb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/ghb/StatusBadge";
import FileUpload from "@/components/ghb/FileUpload";
import SupportButtons from "@/components/ghb/SupportButtons";
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const COUNTRIES = ["Burundi", "RDC", "Kenya", "Rwanda", "Tanzanie", "Ouganda", "Zambie", "Côte d'Ivoire", "Sénégal", "Maroc", "Algérie", "Émirats Arabes Unis", "Autre"];

export default function Kyc() {
  const { user, loading, refresh } = useCurrentUser();
  const [form, setForm] = useState({
    legal_name: user?.legal_name || "",
    phone: user?.phone || "",
    country: user?.country || "",
    id_document_type: user?.id_document_type || "national_id",
    id_document_uri: user?.id_document_uri || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const kyc = user?.kyc_status || "not_submitted";

  const submit = async () => {
    setError("");
    if (!form.legal_name || !form.phone || !form.country || !form.id_document_uri) {
      setError("Veuillez remplir tous les champs et téléverser votre pièce d'identité.");
      return;
    }
    setSaving(true);
    try {
      await base44.auth.updateMe({
        legal_name: form.legal_name,
        phone: form.phone,
        country: form.country,
        id_document_type: form.id_document_type,
        id_document_uri: form.id_document_uri,
        kyc_status: "pending",
        kyc_rejection_reason: "",
      });
      refresh();
    } catch (e) {
      setError(e.message || "Échec de la soumission");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl ghb-emerald-bg mx-auto flex items-center justify-center mb-3">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Vérification d'identité (KYC)</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Obligatoire pour activer les dépôts, transferts et taux de change.
        </p>
      </div>

      {kyc === "approved" && (
        <div className="ghb-card rounded-2xl p-6 text-center mb-6 border-emerald-500/30">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-foreground">Identité vérifiée</h2>
          <p className="text-sm text-muted-foreground mt-1">Votre compte est actif. Vous pouvez déposer et transférer.</p>
        </div>
      )}

      {kyc === "pending" && (
        <div className="ghb-card rounded-2xl p-6 text-center mb-6 border-amber-500/30">
          <Clock className="w-10 h-10 text-amber-400 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-foreground">En attente d'approbation</h2>
          <p className="text-sm text-muted-foreground mt-1">Un administrateur examine votre document. Vous serez notifié.</p>
        </div>
      )}

      {kyc === "rejected" && (
        <div className="ghb-card rounded-2xl p-5 mb-6 border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">KYC rejeté</div>
              {user?.kyc_rejection_reason && (
                <div className="text-sm text-muted-foreground mt-1">Motif : {user.kyc_rejection_reason}</div>
              )}
              <div className="text-sm text-muted-foreground mt-1">Veuillez corriger et soumettre à nouveau.</div>
            </div>
          </div>
        </div>
      )}

      {kyc !== "approved" && kyc !== "pending" && (
        <div className="ghb-card rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="legal_name">Nom complet légal</Label>
            <Input id="legal_name" value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
              placeholder="Ex. Gladys HB" className="bg-white/5 border-white/10 h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone (avec indicatif)</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+257 6XX XXXXX" className="bg-white/5 border-white/10 h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Pays de résidence</Label>
            <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc_type">Type de pièce</Label>
            <Select value={form.id_document_type} onValueChange={(v) => setForm({ ...form, id_document_type: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="national_id">Carte d'identité nationale</SelectItem>
                <SelectItem value="passport">Passeport</SelectItem>
                <SelectItem value="driver_license">Permis de conduire</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <FileUpload
            value={form.id_document_uri}
            onChange={(uri) => setForm({ ...form, id_document_uri: uri })}
            label="Photo / scan de la pièce d'identité"
            accept="image/*,application/pdf"
            hint="JPG, PNG ou PDF — lisible"
          />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <Button onClick={submit} disabled={saving} className="w-full h-12 ghb-gold-bg text-black font-semibold hover:opacity-90">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Soumettre pour vérification
          </Button>
        </div>
      )}

      <div className="mt-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 text-center">Besoin d'aide ?</div>
        <SupportButtons variant="stack" />
      </div>
    </div>
  );
}