import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser, formatMoney, DEPOSIT_STATUS } from "@/lib/ghb";
import StatusBadge from "@/components/ghb/StatusBadge";
import FileUpload from "@/components/ghb/FileUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownToLine, Copy, Check, Loader2, MessageSquare, ChevronLeft, Smartphone, Building2, Bitcoin, Globe, ShieldCheck, Ticket } from "lucide-react";

const TYPE_META = {
  mobile_money: { label: "Mobile Money", icon: Smartphone },
  bank: { label: "Banque locale", icon: Building2 },
  crypto: { label: "Crypto / USDT", icon: Bitcoin },
  international: { label: "Compte international", icon: Globe },
};

export default function Deposit() {
  const { user } = useCurrentUser();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: choose, 2: proof, 3: done
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [receipt, setReceipt] = useState("");
  const [senderRef, setSenderRef] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    base44.entities.DepositAddress.filter({ active: true }, { sort: "type", limit: 100 })
      .then(({ items }) => setAddresses(items))
      .finally(() => setLoading(false));
  }, []);

  const grouped = addresses.reduce((acc, a) => {
    (acc[a.type] = acc[a.type] || []).push(a);
    return acc;
  }, {});

  const copy = (text, key) => {
    navigator.clipState?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  const submit = async () => {
    setError("");
    if (!amount || Number(amount) <= 0) { setError("Indiquez un montant valide."); return; }
    if (!receipt) { setError("Téléversez la capture d'écran du reçu."); return; }
    setSubmitting(true);
    try {
      const created = await base44.entities.DepositRequest.create({
        user_id: user.id,
        user_name: user.legal_name || user.email,
        user_email: user.email,
        amount: Number(amount),
        currency,
        deposit_address_id: selected.id,
        deposit_address_label: selected.label,
        receipt_uri: receipt,
        sender_reference: senderRef,
        promo_code: promoCode.trim().toUpperCase() || undefined,
        status: "pending",
      });
      // Attach a referrer if the user entered a sponsor code and isn't already referred
      const code = promoCode.trim().toUpperCase();
      if (code) { try { await base44.functions.invoke("applyReferral", { code }); } catch {} }
      setCreatedId(created.id);
      setStep(3);
    } catch (e) {
      setError(e.message || "Échec de la demande");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Stepper step={step} />

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">Choisir une méthode de dépôt</h1>
            <p className="text-sm text-muted-foreground mt-1">Sélectionnez l'adresse vers laquelle vous envoyez les fonds.</p>
          </div>
          {addresses.length === 0 ? (
            <div className="ghb-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
              Aucune adresse de dépôt disponible pour le moment. Contactez le support.
            </div>
          ) : (
            Object.entries(grouped).map(([type, list]) => {
              const meta = TYPE_META[type] || { label: type, icon: ShieldCheck };
              const Icon = meta.icon;
              return (
                <div key={type} className="ghb-card rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-foreground font-semibold mb-3">
                    <Icon className="w-4 h-4 text-[#D4AF37]" /> {meta.label}
                  </div>
                  <div className="space-y-2">
                    {list.map((a) => {
                      const accent = a.accent_color || "#D4AF37";
                      const hl = a.card_style === "highlighted";
                      return (
                        <button key={a.id} onClick={() => { setSelected(a); setCurrency(a.currency || "USD"); setStep(2); }}
                          className="w-full text-left px-3.5 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition border"
                          style={{ borderColor: hl ? accent + "66" : "rgba(255,255,255,0.06)" }}>
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
                              style={{ backgroundColor: accent + "1F", color: accent, border: `1px solid ${accent}55` }}>
                              {a.icon || <Icon className="w-5 h-5" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground text-sm">{a.provider}</div>
                              <div className="text-xs text-muted-foreground truncate">{a.label} · {a.currency}</div>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {step === 2 && selected && (
        <div className="space-y-5">
          <button onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" /> Retour
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Effectuez le paiement</h1>
            <p className="text-sm text-muted-foreground mt-1">Envoyez les fonds aux coordonnées ci-dessous, puis téléversez la preuve.</p>
          </div>

          <div className="ghb-card rounded-2xl p-5 space-y-4">
            <div className="text-sm text-muted-foreground">{selected.provider}</div>
            <DetailRow label="Bénéficiaire" value={selected.account_holder} k="holder" copied={copied} onCopy={copy} />
            <DetailRow label="Compte / Adresse" value={selected.account_info} k="acct" copied={copied} onCopy={copy} mono />
            {selected.network && <DetailRow label="Réseau" value={selected.network} k="net" copied={copied} onCopy={copy} />}
            <DetailRow label="Devise" value={selected.currency} k="cur" copied={copied} onCopy={copy} />
            {selected.country && <DetailRow label="Pays" value={selected.country} k="country" copied={copied} onCopy={copy} />}
            {selected.instructions && (
              <div className="text-xs text-muted-foreground bg-white/[0.03] rounded-lg p-3 border border-white/5">
                {selected.instructions}
              </div>
            )}
          </div>

          <div className="ghb-card rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant déposé</Label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" className="bg-white/5 border-white/10 h-11" />
              </div>
              <div className="space-y-2">
                <Label>Devise</Label>
                <div className="h-11 flex items-center px-3 rounded-md bg-white/[0.03] border border-white/10 text-sm text-foreground font-medium">
                  {currency} <span className="text-[10px] text-muted-foreground ml-2">(liée à la méthode)</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Référence / ID transaction (optionnel)</Label>
              <Input value={senderRef} onChange={(e) => setSenderRef(e.target.value)}
                placeholder="Référence visible sur le paiement" className="bg-white/5 border-white/10 h-11" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5 text-[#D4AF37]" /> Code Promo / Parrainage (optionnel)</Label>
              <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Code de votre parrain" className="bg-white/5 border-white/10 h-11 uppercase tracking-widest font-medium" />
            </div>
            <FileUpload value={receipt} onChange={(uri) => setReceipt(uri)}
              label="Capture d'écran du reçu"
              accept="image/*,application/pdf"
              hint="Téléversez la preuve de votre transfert" />
            {error && <div className="text-sm text-red-400">{error}</div>}
            <Button onClick={submit} disabled={submitting} className="w-full h-12 ghb-gold-bg text-black font-semibold hover:opacity-90">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Soumettre la demande de dépôt
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="ghb-card rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-2xl ghb-emerald-bg mx-auto flex items-center justify-center mb-3">
              <Check className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Demande envoyée</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Votre dépôt est en attente de validation. Le solde sera crédité après approbation.
            </p>
            <div className="mt-4 flex justify-center">
              <StatusBadge meta={DEPOSIT_STATUS} status="pending" />
            </div>
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
      )}
    </div>
  );
}

function Stepper({ step }) {
  const steps = ["Adresse", "Preuve", "Validation"];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const n = i + 1;
        const active = step >= n;
        return (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${active ? "ghb-gold-bg text-black" : "bg-white/5 text-muted-foreground border border-white/10"}`}>{n}</div>
            <div className={`text-xs ${active ? "text-foreground" : "text-muted-foreground"}`}>{s}</div>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${step > n ? "bg-[#D4AF37]" : "bg-white/10"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value, k, copied, onCopy, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-sm text-foreground font-medium break-all ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <button onClick={() => onCopy(value, k)} className="p-2 rounded-lg border border-white/10 text-muted-foreground hover:bg-white/5 shrink-0">
        {copied === k ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}