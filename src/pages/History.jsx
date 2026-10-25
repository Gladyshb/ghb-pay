import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { selectRows } from "@/lib/supabaseData";
import { useCurrentUser, formatMoney, formatDate } from "@/lib/ghb";
import StatusBadge from "@/components/ghb/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jsPDF } from "jspdf";
import { ArrowDownToLine, ArrowUpFromLine, Download, Loader2, RotateCcw, Filter, History as HistoryIcon, MessageSquare } from "lucide-react";

const STATUS_LABEL = {
  pending: "En attente",
  approved: "Approuvé",
  completed: "Terminé",
  rejected: "Rejeté",
};

function buildRows(deposits, transfers) {
  const d = (deposits || []).map((x) => ({
    id: x.id, date: x.created_date, type: "deposit",
    details: x.deposit_address_label || x.deposit_address_id || "Dépôt",
    amount: x.amount, currency: x.currency, status: x.status,
    threadType: "deposit", threadId: x.id,
  }));
  const t = (transfers || []).map((x) => ({
    id: x.id, date: x.created_date, type: "transfer",
    details: `${x.beneficiary_name || "Bénéficiaire"} · ${x.to_currency || ""}`,
    amount: x.amount, currency: x.from_currency, status: x.status,
    threadType: "transfer", threadId: x.id,
  }));
  return [...d, ...t].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const startOfDay = (s) => (s ? new Date(s + "T00:00:00") : null);
const endOfDay = (s) => (s ? new Date(s + "T23:59:59") : null);

export default function History() {
  const { user } = useCurrentUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("all");
  const [currency, setCurrency] = useState("all");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      selectRows("deposit_requests", {}, { sort: "-created_at", limit: 1000 }),
      selectRows("transfer_requests", {}, { sort: "-created_at", limit: 1000 }),
    ])
      .then(([d, t]) => { if (alive) { setRows(buildRows(d, t)); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const currencies = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(r.currency));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);
    return rows.filter((r) => {
      const d = new Date(r.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (status === "pending" && r.status !== "pending") return false;
      if (status === "done" && !(r.status === "approved" || r.status === "completed")) return false;
      if (status === "rejected" && r.status !== "rejected") return false;
      if (currency !== "all" && r.currency !== currency) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo, status, currency]);

  const stats = useMemo(() => {
    let dep = 0, tra = 0;
    filtered.forEach((r) => { if (r.type === "deposit") dep += 1; else tra += 1; });
    return { total: filtered.length, dep, tra };
  }, [filtered]);

  const reset = () => { setDateFrom(""); setDateTo(""); setStatus("all"); setCurrency("all"); };

  const downloadPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    const usable = pageW - margin * 2;
    const cols = [
      { t: "Date", w: 95 },
      { t: "Type", w: 55 },
      { t: "Détails", w: 180 },
      { t: "Montant", w: 90 },
      { t: "Statut", w: 95 },
    ];
    let x = margin;
    cols.forEach((c) => { c.x = x; x += c.w; });

    let y = 50;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.setTextColor(24, 89, 58);
    doc.text("Relevé de transactions — GHB Pay", margin, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(`Compte : ${user?.email || "-"}`, margin, y); y += 13;
    const range = dateFrom || dateTo ? `${dateFrom || "…"}  →  ${dateTo || "…"}` : "Toutes les dates";
    doc.text(`Période : ${range}`, margin, y); y += 13;
    doc.text(`Généré le : ${new Date().toLocaleString("fr-FR")}`, margin, y); y += 13;
    doc.text(`Total : ${stats.total} transaction(s) — ${stats.dep} dépôt(s), ${stats.tra} transfert(s)`, margin, y); y += 22;

    // Header row
    doc.setFillColor(24, 89, 58); doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.rect(margin, y - 11, usable, 16, "F");
    cols.forEach((c) => doc.text(c.t, c.x + 4, y));
    y += 16;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
    filtered.forEach((r, i) => {
      if (y > pageH - 40) { doc.addPage(); y = 50; }
      if (i % 2 === 0) { doc.setFillColor(245, 245, 245); doc.rect(margin, y - 11, usable, 16, "F"); }
      doc.text(formatDate(r.date), cols[0].x + 4, y);
      doc.text(r.type === "deposit" ? "Dépôt" : "Transfert", cols[1].x + 4, y);
      doc.text(String(r.details || "").slice(0, 40), cols[2].x + 4, y);
      doc.text(formatMoney(r.amount, r.currency), cols[3].x + 4, y);
      doc.text(STATUS_LABEL[r.status] || r.status, cols[4].x + 4, y);
      y += 16;
    });

    // Footer
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text(`GHB Pay — relevé confidentiel · page ${p}/${pages}`, margin, pageH - 20);
    }
    doc.save(`releve-ghbpay-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <HistoryIcon className="w-5 h-5 text-[#D4AF37]" /> Historique
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Filtrez vos transactions et téléchargez votre relevé.</p>
      </div>

      {/* Filters */}
      <div className="ghb-card rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="w-4 h-4 text-[#D4AF37]" /> Filtres
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Du</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 bg-white/5 border-white/10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Au</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 bg-white/5 border-white/10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="done">Terminé / Approuvé</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Devise</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-10 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les devises</SelectItem>
                {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={downloadPDF} disabled={loading || filtered.length === 0}
            className="h-10 ghb-gold-bg text-black hover:opacity-90 font-semibold">
            <Download className="w-4 h-4 mr-2" /> Télécharger le relevé (PDF)
          </Button>
          <Button variant="outline" onClick={reset} className="h-10 border-white/10 bg-white/5">
            <RotateCcw className="w-4 h-4 mr-2" /> Réinitialiser
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Transactions" value={stats.total} />
        <SummaryCard label="Dépôts" value={stats.dep} />
        <SummaryCard label="Transferts" value={stats.tra} />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucune transaction ne correspond aux filtres.</div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => (
            <Link key={r.id} to={`/chat?threadType=${r.threadType}&threadId=${r.threadId}&userId=${user.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl ghb-card hover:border-[#D4AF37]/40 transition">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.type === "deposit" ? "ghb-emerald-bg" : "bg-white/10"}`}>
                  {r.type === "deposit"
                    ? <ArrowDownToLine className="w-4 h-4 text-white" />
                    : <ArrowUpFromLine className="w-4 h-4 text-[#E8C65A]" />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{formatMoney(r.amount, r.currency)}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.details} · {formatDate(r.date)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge meta={r.type === "deposit" ? { pending: { label: "En attente", tone: "amber" }, approved: { label: "Approuvé", tone: "emerald" }, rejected: { label: "Rejeté", tone: "red" } } : { pending: { label: "En traitement", tone: "amber" }, completed: { label: "Terminé", tone: "emerald" }, rejected: { label: "Rejeté", tone: "red" } }} status={r.status} />
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="ghb-card rounded-2xl p-3 text-center">
      <div className="text-xl font-bold ghb-gold-text">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}