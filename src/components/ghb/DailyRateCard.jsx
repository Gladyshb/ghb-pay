import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { ImageDown, Loader2, Share2, ShieldCheck, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

// Cross rates to BIF go through the USDT base: 1 CUR = (ref_BIF / cur_buy) BIF envoyés
// et 1 CUR = (ref_BIF / cur_sell) BIF payés pour recevoir la devise.
function computeQuote(currencies, code) {
  const cur = currencies.find((c) => c.code === code);
  const bif = currencies.find((c) => c.code === "BIF");
  const refBif = Number(bif?.binance_rate) || 0;
  const buy = Number(cur?.buy_rate) || 0;
  const sell = Number(cur?.sell_rate) || 0;
  const ref = Number(cur?.binance_rate) || 0;
  const toBif = (rate) => (refBif > 0 && rate > 0 ? refBif / rate : 0);
  return {
    cur,
    ref,
    buy,
    sell,
    sendBif: toBif(buy),
    recvBif: toBif(sell),
    ready: Boolean(cur) && refBif > 0 && buy > 0 && sell > 0,
  };
}

const GOLD = "#D4AF37";
const GOLD_SOFT = "#E8C65A";
const EMERALD = "#34D399";

const fmtBif = (n) =>
  n > 0 ? Math.round(n).toLocaleString("fr-FR") : "—";

const fmtRate = (n) =>
  n > 0
    ? n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 4 : 2 })
    : "—";

const todayLabel = () =>
  new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function DailyRateCard({ currencies, loading }) {
  const options = useMemo(
    () =>
      currencies.filter((c) => typeof c.code === "string" && c.code.trim() !== ""),
    [currencies]
  );
  const preferred =
    options.find((c) => c.code === "USD")?.code || options[0]?.code || "";
  const [code, setCode] = useState(preferred);
  const [generating, setGenerating] = useState(false);
  const captureRef = useRef(null);

  const quote = useMemo(
    () => computeQuote(currencies, code || preferred),
    [currencies, code, preferred]
  );

  const date = todayLabel();

  const handleDownload = async () => {
    const node = captureRef.current;
    if (!node || !quote.ready) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(node, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: null,
      });
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png")
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ghbpay-taux-${quote.cur.code}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Image générée", description: "Le taux du jour est prêt à être partagé." });
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer l'image du taux du jour." });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="ghb-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Share2 className="w-4 h-4 text-[#D4AF37]" /> Taux du jour — partage
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" />
          ) : options.length === 0 ? (
            <span className="text-xs text-muted-foreground">Aucune devise.</span>
          ) : (
            <Select value={quote.cur?.code || code} onValueChange={setCode}>
              <SelectTrigger className="w-[180px] h-9 bg-white/5 border-white/10 text-sm">
                <SelectValue placeholder="Choisir une devise" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.code} value={o.code}>
                    {o.flag_emoji ? `${o.flag_emoji} ` : ""}
                    {o.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <button
            onClick={handleDownload}
            disabled={generating || !quote.ready || loading || options.length === 0}
            className="flex items-center gap-2 h-9 px-4 rounded-lg ghb-emerald-bg text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageDown className="w-4 h-4" />
            )}
            PNG
          </button>
        </div>
      </div>

      {quote.ready && quote.cur ? (
        <QuoteCard
          innerRef={captureRef}
          cur={quote.cur}
          referenceRate={quote.ref}
          buy={quote.buy}
          sell={quote.sell}
          sendBif={quote.sendBif}
          recvBif={quote.recvBif}
          date={date}
        />
      ) : (
        <div className="text-sm text-muted-foreground py-4 text-center">
          {loading
            ? "Chargement des taux…"
            : "Sélectionnez une devise dont les taux achat/vente sont publiés."}
        </div>
      )}
    </div>
  );
}

function QuoteCard({ innerRef, cur, referenceRate, buy, sell, sendBif, recvBif, date }) {
  return (
    <div
      ref={innerRef}
      style={{
        width: 480,
        maxWidth: "100%",
        margin: "0 auto",
        borderRadius: 24,
        padding: 26,
        boxSizing: "border-box",
        color: "#F4F1EA",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        background: "linear-gradient(160deg, #0D1E19 0%, #060D0B 100%)",
        border: `1px solid rgba(212,175,55,0.35)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* decorative glows */}
      <div
        style={{
          position: "absolute",
          top: -70,
          right: -70,
          width: 220,
          height: 220,
          borderRadius: 9999,
          background: "rgba(212,175,55,0.10)",
          filter: "blur(48px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -80,
          left: -60,
          width: 220,
          height: 220,
          borderRadius: 9999,
          background: "rgba(16,185,129,0.12)",
          filter: "blur(48px)",
        }}
      />

      {/* Header: logo + brand */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg, #13925A 0%, #0B5B38 100%)",
              border: `1px solid rgba(212,175,55,0.45)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck style={{ width: 22, height: 22, color: "#FFFFFF" }} />
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>
              GHB <span style={{ color: GOLD }}>Pay</span>
            </div>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(244,241,234,0.55)", marginTop: 3 }}>
              Gladys HB Business
            </div>
          </div>
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: GOLD_SOFT,
            background: "rgba(212,175,55,0.10)",
            border: `1px solid rgba(212,175,55,0.30)`,
            borderRadius: 9999,
            padding: "6px 12px",
          }}
        >
          TAUX DU JOUR
        </div>
      </div>

      {/* Currency hero */}
      <div style={{ position: "relative", textAlign: "center", margin: "22px 0 18px" }}>
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>
          {cur.flag_emoji || "💱"}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10 }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {cur.code}
          </span>
          <span style={{ fontSize: 12, color: "rgba(244,241,234,0.60)", textTransform: "capitalize" }}>
            {cur.name || cur.type || ""}
          </span>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(244,241,234,0.55)" }}>
          Référence :{" "}
          <span style={{ color: "#F4F1EA", fontWeight: 600 }}>
            {fmtRate(referenceRate)} {cur.code}
          </span>{" "}
          / 1 USDT
        </div>
      </div>

      {/* Buy / Sell panels */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
        <Panel
          tone={EMERALD}
          label="ENVOI · ALLER (ACHAT)"
          sub={`Taux achat : ${fmtRate(buy)} ${cur.code} / USDT`}
          value={fmtBif(sendBif)}
          unit={"BIF reçus pour 1 " + cur.code}
        />
        <Panel
          tone={GOLD}
          label="RÉCEPTION · RETOUR (VENTE)"
          sub={`Taux vente : ${fmtRate(sell)} ${cur.code} / USDT`}
          value={fmtBif(recvBif)}
          unit={"BIF payés pour 1 " + cur.code}
        />
      </div>

      {/* Divider */}
      <div style={{ position: "relative", height: 1, background: "rgba(244,241,234,0.10)", margin: "20px 0 14px" }} />

      {/* Footer: signature */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "linear-gradient(135deg, #F5D98C 0%, #D4AF37 50%, #B8860B 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck style={{ width: 15, height: 15, color: "#0B2A1D" }} />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              Signé par <span style={{ color: GOLD_SOFT }}>GladysHB</span>, Fondateur
            </div>
            <div style={{ fontSize: 9, color: "rgba(244,241,234,0.50)", marginTop: 2, textTransform: "capitalize" }}>
              {date} · ghbpay.com
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(244,241,234,0.55)" }}>
          <TrendingUp style={{ width: 13, height: 13, color: GOLD }} />
          <span style={{ fontSize: 10, letterSpacing: "0.08em" }}>Taux indicatifs</span>
        </div>
      </div>
    </div>
  );
}

function Panel({ tone, label, sub, value, unit }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: "14px 16px",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${tone}33`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: tone }}>
          {label}
        </span>
        <span style={{ width: 8, height: 8, borderRadius: 9999, background: tone }} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: tone, letterSpacing: "-0.02em" }}>
          {value}
        </span>
        <span style={{ fontSize: 12, color: "rgba(244,241,234,0.65)" }}>
          {unit}
        </span>
      </div>
      <div style={{ fontSize: 10, color: "rgba(244,241,234,0.45)", marginTop: 6 }}>
        {sub}
      </div>
    </div>
  );
}
