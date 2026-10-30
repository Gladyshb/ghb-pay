import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { selectRows } from "@/lib/supabaseData";
import { supabase } from "@/lib/supabase";
import { useCurrentUser, useUserBalances, formatMoney } from "@/lib/ghb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUpFromLine, Loader2, Check, MessageSquare, AlertTriangle, Ticket } from "lucide-react";

const PAYOUT_METHODS = ["Mobile Money", "Virement bancaire", "Crypto / USDT", "Zelle", "Cash pickup", "Autre"];
const COUNTRIES = ["Burundi", "RDC", "Kenya", "Rwanda", "Tanzanie", "Ouganda", "Zambie", "Côte d'Ivoire", "Sénégal", "Maroc", "Algérie", "Émirats Arabes Unis", "Autre"];

export default function Transfer() {
  const { user } = useCurrentUser();
  const { balances, loading: loadingBalances } = useUserBalances(user?.id);
  const [currencies, setCurrencies] = useState([]);
  const [loadingCur, setLoadingCur] = useState(true);
  const [form, setForm] = useState({
    amount: "",
    from_currency: "",
    to_currency: "",
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
    selectRows("currencies", { active: true }, { sort: "code", limit: 1000 })
      .then(setCurrencies)
      .catch((loadError) => {
        console.error("Failed to load transfer currencies:", loadError);
        setError(loadError.message || "Impossible de charger les devises.");
      })
      .finally(() => setLoadingCur(false));
  }, []);

  const sourceCurrencies = balances.filter((wallet) => Number(wallet.balance) > 0);

  useEffect(() => {
    if (loadingBalances) return;
    const availableCurrencies = balances.filter((wallet) => Number(wallet.balance) > 0);
    const selectedCurrency = availableCurrencies.some((wallet) => wallet.currency === form.from_currency)
      ? form.from_currency
      : availableCurrencies[0]?.currency || "";
    if (selectedCurrency !== form.from_currency) {
      setForm((current) => ({ ...current, from_currency: selectedCurrency }));
    }
  }, [balances, form.from_currency, loadingBalances]);

  useEffect(() => {
    if (loadingCur) return;
    const selectedCurrency = currencies.some((currency) => currency.code === form.to_currency)
      ? form.to_currency
      : currencies[0]?.code || "";
    if (selectedCurrency !== form.to_currency) {
      setForm((current) => ({ ...current, to_currency: selectedCurrency }));
    }
  }, [currencies, form.to_currency, loadingCur]);

  const sourceRate = ["USD", "USDT"].includes(form.from_currency)
    ? 1
    : Number(currencies.find((currency) => currency.code === form.from_currency)?.sell_rate || 0);
  const destinationRate = ["USD", "USDT"].includes(form.to_currency)
    ? 1
    : Number(currencies.find((currency) => currency.code === form.to_currency)?.sell_rate || 0);
  const rate = sourceRate > 0 && destinationRate > 0 ? destinationRate / sourceRate : 0;
  const balance = Number(balances.find((wallet) => wallet.currency === form.from_currency)?.balance || 0);
  const amountNum = Number(form.amount) || 0;
  const converted = rate ? amountNum * rate : 0;
  const insufficient = amountNum > balance;

  const submit = async () => {
    setError("");
    if (!sourceCurrencies.some((wallet) => wallet.currency === form.from_currency)) {
      setError("Aucun solde disponible pour la devise sélectionnée.");
      return;
    }
    if (!currencies.some((currency) => currency.code === form.to_currency)) {
      setError("Sélectionnez une devise de réception disponible.");
      return;
    }
    if (!form.amount || amountNum <= 0) { setError("Indiquez un montant valide."); return; }
    if (insufficient) { setError("Solde insuffisant pour ce transfert."); return; }
    if (!rate) { setError("Le taux de conversion de la devise sélectionnée n'est pas disponible."); return; }
    if (!form.beneficiary_name || !form.payout_details) { setError("Renseignez le bénéficiaire et les coordonnées de paiement."); return; }
    setSubmitting(true);
    try {
      const { error: transferError } = await supabase.rpc("create_transfer_request", {
        p_amount: amountNum,
        p_from_currency: form.from_currency,
        p_to_currency: form.to_currency,
        p_beneficiary_name: form.beneficiary_name,
        p_beneficiary_country: form.beneficiary_country,
        p_payout_method: form.payout_method,
        p_payout_details: form.payout_details,
        p_promo_code: promoCode.trim().toUpperCase() || null,
      });
      if (transferError) throw transferError;
      // Attach a referrer if the user entered a sponsor code and isn't already referred
      const code = promoCode.trim().toUpperCase();
      if (code) {
        const { data: referralResult, error: referralError } = await supabase.rpc("apply_referral_code", { p_code: code });
        if (referralError || !referralResult?.ok) {
          console.error("Referral code could not be applied:", referralError || referralResult?.reason);
        }
      }
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
        <p className="text-sm text-muted-foreground mt-1">Envoyez des fonds depuis votre solde vers un bénéficiaire.</p>
      </div>

      <div className="ghb-card rounded-2xl p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Solde disponible en {form.from_currency}</span>
        <span className="text-lg font-bold ghb-gold-text">{formatMoney(balance, form.from_currency)}</span>
      </div>

      <div className="ghb-card rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Montant à envoyer</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00" className="bg-white/5 border-white/10 h-11" />
          </div>
          <div className="space-y-2">
            <Label>Depuis</Label>
            <Select
              value={form.from_currency}
              onValueChange={(value) => setForm((current) => ({ ...current, from_currency: value }))}
              disabled={loadingBalances || sourceCurrencies.length === 0}
            >
              <SelectTrigger className="bg-white/5 border-white/10 h-11">
                <SelectValue placeholder={loadingBalances ? "Chargement des soldes..." : "Aucun solde disponible"} />
              </SelectTrigger>
              <SelectContent>
                {sourceCurrencies.map((wallet) => {
                  const currency = currencies.find((item) => item.code === wallet.currency);
                  return (
                    <SelectItem key={wallet.currency} value={wallet.currency}>
                      {currency?.flag_emoji || "💱"} {wallet.currency} — {formatMoney(wallet.balance, wallet.currency)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Devise reçue</Label>
            <Select
              value={form.to_currency}
              onValueChange={(value) => setForm((current) => ({ ...current, to_currency: value }))}
              disabled={loadingCur || currencies.length === 0}
            >
              <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies
                  .filter((currency) => typeof currency.code === "string" && currency.code.trim())
                  .map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.flag_emoji} {currency.code} — {currency.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Taux (vente)</Label>
            <Input value={rate ? `1 ${form.from_currency} = ${rate} ${form.to_currency}` : "—"} disabled className="bg-white/5 border-white/10 h-11" />
          </div>
        </div>

        {amountNum > 0 && (
          <div className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30">
            <span className="text-sm text-muted-foreground">Bénéficiaire reçoit</span>
            <span className="text-base font-bold text-[#E8C65A]">{formatMoney(converted, form.to_currency)}</span>
          </div>
        )}

        {insufficient && (
          <div className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle className="w-4 h-4" /> Solde insuffisant.</div>
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
        <Button onClick={submit} disabled={submitting || insufficient || loadingCur || loadingBalances || sourceCurrencies.length === 0 || currencies.length === 0} className="w-full h-12 ghb-gold-bg text-black font-semibold hover:opacity-90">
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Demander le transfert
        </Button>
      </div>
    </div>
  );
}