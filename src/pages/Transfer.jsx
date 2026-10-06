import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser, useWallet, formatMoney, convertCurrency } from "@/lib/ghb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUpFromLine, Loader2, Check, MessageSquare, ChevronLeft, AlertTriangle, Ticket } from "lucide-react";

const PAYOUT_METHODS = ["Mobile Money", "Virement bancaire", "Crypto / USDT", "Zelle", "Cash pickup", "Autre"];
const COUNTRIES = ["Burundi", "RDC", "Kenya", "Rwanda", "Tanzanie", "Ouganda", "Zambie", "Côte d'Ivoire", "Sénégal", "Maroc", "Algérie", "Émirats Arabes Unis", "Autre"];

export default function Transfer() {
  const { user } = useCurrentUser();
  const { balances, getBalance } = useWallet(user?.id);
  const [currencies, setCurrencies] = useState([]);
  const [loadingCur, setLoadingCur] = useState(true);
  const availableCodes = Object.keys(balances).filter((c) => Number(balances[c]) > 0);
  const [form, setForm] = useState({
    amount: "",
    from_currency: "",
    to_currency: "USDT",
    beneficiary_name: "",
    beneficiary_country: "Burundi",
    payout_method: "Mobile Money",
    payout_details: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    base44.entities.Currency.filter({ active: true }, { sort: "code", limit: 100 })
      .then(({ items }) => setCurrencies(items))
      .finally(() => setLoadingCur(false));
  }, []);

  // Default the source currency to the first available balance.
  useEffect(() => {
    if (!form.from_currency && availableCodes.length > 0) {
      setForm((f) => ({ ...f, from_currency: availableCodes[0] }));
    }
  }, [availableCodes, form.from_currency]);

  const amountNum = Number(form.amount) || 0;
  const converted = form.from_currency && form.to_currency
    ? convertCurrency(amountNum, form.from_currency, form.to_currency, currencies)
    : 0;
  const effectiveRate = amountNum > 0 ? converted / amountNum : 0;
  const sourceBalance = getBalance(form.from_currency);
  const insufficient = amountNum > sourceBalance;

  const submit = async () => {
    setError("");
    if (!form.from_currency) { setError("Choisissez la devise source."); return; }
    if (!form.amount || amountNum <= 0) { setError("Indiquez un montant valide."); return; }
    if (insufficient) { setError("Solde insuffisant dans la devise source."); return; }
    if (!form.beneficiary_name || !form.payout_details) { setError("Renseignez le bénéficiaire et les coordonnées de paiement."); return; }
    setSubmitting(true);
    try {
      await base44.entities.TransferRequest.create({
        user_id: user.id,
        user_name: user.legal_name || user.email,
        user_email: user.email,
        amount: amountNum,
        from_currency: form.from_currency,
        to_currency: form.to_currency,
        converted_amount: converted,
        rate: effectiveRate,
        beneficiary_name: form.beneficiary_name,
        beneficiary_country: form.beneficiary_country,
        payout_method: form.payout_method,
        payout_details: form.payout_details,
        promo_code: promoCode.trim().toUpperCase() || undefined,
        status: "pending",
      });
      const code = promoCode.trim().toUpperCase();
      if (code) { try { await base44.functions.invoke("applyReferral", { code }); } catch {} }
      setDone(true);
    } catch (e) {
      setError(e.message || "Échec de la demande");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto space-y-5">
        <div className="ghb-card rounded-2xl p-6 text-center">
          <div className="w-14 h-14 rounded-2xl ghb-emerald-bg mx-auto flex items-center justify-center mb-3">
            <Check className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Demande de transfert envoyée</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Le traitement est en cours. Vous recevrez le reçu de confirmation final dans le chat.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/chat" className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl ghb-emerald-bg text-white font-semibold">
            <MessageSquare className="w-4 h-4" /> Discuter
          </Link>
          <Link to="/transactions" className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-foreground font-semibold">
            Mes transactions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><ArrowUpFromLine className="w-5 h-5 text-[#D4AF37]" /> Nouveau transfert</h1>
        <p className="text-sm text-muted-foreground mt-1">Choisissez la devise source et la devise reçue par le bénéficiaire.</p>
      </div>

      {/* Available balances — pick the source */}
      <div className="ghb-card rounded-2xl p-4">
        <div className="text-xs text-muted-foreground mb-2">Soldes disponibles</div>
        {loadingCur ? (
          <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" /></div>
        ) : availableCodes.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucun solde. Effectuez d'abord un dépôt.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableCodes.map((code) => (
              <button key={code} type="button" onClick={() => setForm((f) => ({ ...f, from_currency: code }))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${form.from_currency === code ? "ghb-gold-bg text-black border-transparent" : "bg-white/5 text-foreground border-white/10"}`}>
                {formatMoney(Number(balances[code]), code)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ghb-card rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Depuis (devise source)</Label>
            <Select value={form.from_currency} onValueChange={(v) => setForm({ ...form, from_currency: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {availableCodes.map((code) => (
                  <SelectItem key={code} value={code}>{code} — {formatMoney(Number(balances[code]), code)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Montant à envoyer</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00" className="bg-white/5 border-white/10 h-11" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Devise reçue</Label>
            <Select value={form.to_currency} onValueChange={(v) => setForm({ ...form, to_currency: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag_emoji} {c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Taux appliqué</Label>
            <Input value={effectiveRate ? `1 ${form.from_currency} = ${effectiveRate.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${form.to_currency}` : "—"} disabled className="bg-white/5 border-white/10 h-11" />
          </div>
        </div>

        {amountNum > 0 && form.from_currency && (
          <div className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30">
            <span className="text-sm text-muted-foreground">Bénéficiaire reçoit</span>
            <span className="text-base font-bold text-[#E8C65A]">{formatMoney(converted, form.to_currency)}</span>
          </div>
        )}

        {insufficient && form.from_currency && (
          <div className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle className="w-4 h-4" /> Solde insuffisant en {form.from_currency}.</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Nom du bénéficiaire</Label>
            <Input value={form.beneficiary_name} onChange={(e) => setForm({ ...form, beneficiary_name: e.target.value })}
              placeholder="Nom complet" className="bg-white/5 border-white/10 h-11" />
          </div>
          <div className="space-y-2">
            <Label>Pays destinataire</Label>
            <Select value={form.beneficiary_country} onValueChange={(v) => setForm({ ...form, beneficiary_country: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Méthode de paiement</Label>
          <Select value={form.payout_method} onValueChange={(v) => setForm({ ...form, payout_method: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYOUT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Coordonnées de paiement</Label>
          <Textarea value={form.payout_details} onChange={(e) => setForm({ ...form, payout_details: e.target.value })}
            placeholder="Numéro Mobile Money, IBAN, adresse wallet USDT, etc." rows={3}
            className="bg-white/5 border-white/10 resize-none" />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5 text-[#D4AF37]" /> Code Promo / Parrainage (optionnel)</Label>
          <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Code de votre parrain" className="bg-white/5 border-white/10 h-11 uppercase tracking-widest font-medium" />
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
        <Button onClick={submit} disabled={submitting || insufficient || !form.from_currency} className="w-full h-12 ghb-gold-bg text-black font-semibold hover:opacity-90">
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Demander le transfert
        </Button>
      </div>
    </div>
  );
}