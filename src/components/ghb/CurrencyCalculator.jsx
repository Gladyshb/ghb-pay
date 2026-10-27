import { useMemo, useState } from "react";
import { ArrowLeftRight, Calculator, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// rate = units of this currency per 1 USD (as configured in Admin Panel).
// Convert through USD: amount_A / buy_rate_A = USD, then USD * sell_rate_B = amount_B.
function rateOf(currencies, code) {
  if (!code) return 0;
  if (code === "USD") return 1;
  const c = currencies.find((x) => x.code === code);
  const r = c?.buy_rate || c?.sell_rate || 0;
  return r > 0 ? r : 0;
}
function sellRateOf(currencies, code) {
  if (!code) return 0;
  if (code === "USD") return 1;
  const c = currencies.find((x) => x.code === code);
  const r = c?.sell_rate || c?.buy_rate || 0;
  return r > 0 ? r : 0;
}

export default function CurrencyCalculator({ currencies, loading }) {
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("BIF");

    const opts = useMemo(
    () =>
      currencies
        .filter((c) => typeof c.code === "string" && c.code.trim() !== "")
        .map((c) => ({ code: c.code, flag: c.flag_emoji })),
    [currencies]
  );

  const result = useMemo(() => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return 0;
    const buy = rateOf(currencies, from);
    const sell = sellRateOf(currencies, to);
    if (!buy || !sell) return 0;
    return (amt / buy) * sell;
  }, [amount, from, to, currencies]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const fmt = (n, code) =>
    `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`;

  return (
    <div className="ghb-card rounded-2xl p-5">
      <div className="flex items-center gap-2 text-foreground font-semibold mb-4">
        <Calculator className="w-4 h-4 text-[#D4AF37]" /> Convertisseur de devises
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
        </div>
      ) : opts.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Aucune devise disponible.
        </div>
      ) : (
        <div className="space-y-4">
          {/* From */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Vous envoyez</div>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-white/5 border-white/10 h-11 flex-1"
              />
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="w-[42%] h-11 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opts.map((o) => (
                    <SelectItem key={o.code} value={o.code}>
                      {o.flag ? `${o.flag} ` : ""}{o.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Swap */}
          <div className="flex justify-center">
            <button
              onClick={swap}
              className="w-9 h-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-muted-foreground hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition"
              aria-label="Inverser"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* To */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Le bénéficiaire reçoit</div>
            <div className="flex gap-2">
              <div className="flex-1 h-11 flex items-center px-3 rounded-md bg-white/[0.03] border border-white/10">
                <span className="text-lg font-bold ghb-gold-text truncate">
                  {fmt(result, to)}
                </span>
              </div>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger className="w-[42%] h-11 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opts.map((o) => (
                    <SelectItem key={o.code} value={o.code}>
                      {o.flag ? `${o.flag} ` : ""}{o.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground text-center">
            Taux indicatifs basés sur les cours Achat / Vente configurés.
          </div>
        </div>
      )}
    </div>
  );
}