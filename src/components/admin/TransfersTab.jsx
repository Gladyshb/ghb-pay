import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatMoney, formatDate, TRANSFER_STATUS, signFile } from "@/lib/ghb";
import { processReferralReward } from "@/lib/referral";
import StatusBadge from "@/components/ghb/StatusBadge";
import FileUpload from "@/components/ghb/FileUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Check, X, Eye, FileText } from "lucide-react";

export default function TransfersTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receipt, setReceipt] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.TransferRequest.filter({}, { sort: "-created_date", limit: 100 })
      .then(({ items }) => setItems(items))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const view = async (t) => {
    setViewing(t); setReceipt(""); setReceiptUrl("");
    if (t.receipt_uri) { try { setReceiptUrl(await signFile(t.receipt_uri)); } catch {} }
  };

  const debitWallet = async (userId, amount) => {
    const { items } = await base44.entities.Wallet.filter({ user_id: userId }, { limit: 1 });
    if (items.length > 0) {
      const w = items[0];
      await base44.entities.Wallet.update(w.id, { balance: Math.max(0, (w.balance || 0) - amount) });
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await base44.entities.TransferRequest.update(viewing.id, { status: "completed", receipt_uri: receipt });
      await debitWallet(viewing.user_id, viewing.amount);
      await processReferralReward({ id: viewing.id, user_id: viewing.user_id, amount: viewing.amount, to_currency: viewing.to_currency });
      setViewing(null); load();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await base44.entities.TransferRequest.update(rejecting.id, { status: "rejected", rejection_reason: reason });
      setRejecting(null); setReason(""); load();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{items.filter((i) => i.status === "pending").length} transfert(s) en attente</div>
      {items.length === 0 ? (
        <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucun transfert.</div>
      ) : items.map((t) => (
        <div key={t.id} className="ghb-card rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-foreground">{formatMoney(t.amount, t.from_currency)} → {t.to_currency}</div>
              <div className="text-xs text-muted-foreground truncate">{t.user_name} · {t.beneficiary_name} ({t.beneficiary_country}) · {formatDate(t.created_date)}</div>
              <div className="text-xs text-muted-foreground truncate">{t.payout_method}: {t.payout_details}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge meta={TRANSFER_STATUS} status={t.status} />
              {t.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => view(t)} className="border-white/10 bg-white/5">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Traiter
                </Button>
              )}
              {t.status === "completed" && t.receipt_uri && (
                <Button size="sm" variant="outline" onClick={() => view(t)} className="border-white/10 bg-white/5">
                  <FileText className="w-3.5 h-3.5 mr-1" /> Reçu
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle>Transfert — {viewing?.user_name}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <Row label="Montant" value={formatMoney(viewing.amount, viewing.from_currency)} />
              <Row label="Conversion" value={`${formatMoney(viewing.converted_amount, viewing.to_currency)} (1 USD = ${viewing.rate})`} />
              <Row label="Bénéficiaire" value={`${viewing.beneficiary_name} · ${viewing.beneficiary_country}`} />
              <Row label="Méthode" value={viewing.payout_method} />
              <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="text-[10px] uppercase text-muted-foreground">Coordonnées de paiement</div>
                <div className="text-foreground break-words">{viewing.payout_details}</div>
              </div>
              {viewing.status === "pending" ? (
                <FileUpload value={receipt} onChange={(uri) => setReceipt(uri)} label="Reçu final de paiement" accept="image/*,application/pdf" />
              ) : receiptUrl ? (
                /\.(png|jpe?g|webp|gif)$/i.test(viewing.receipt_uri || "") ? (
                  <img src={receiptUrl} alt="reçu" className="w-full rounded-xl border border-white/10" />
                ) : (
                  <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-[#E8C65A]"><FileText className="w-4 h-4" /> Ouvrir le reçu</a>
                )
              ) : null}
            </div>
          )}
          <DialogFooter className="gap-2">
            {viewing?.status === "pending" ? (
              <>
                <Button variant="outline" onClick={() => { setRejecting(viewing); setViewing(null); }} className="border-red-500/30 text-red-400">
                  <X className="w-4 h-4 mr-1" /> Rejeter
                </Button>
                <Button onClick={complete} disabled={busy || !receipt} className="ghb-emerald-bg text-white">
                  {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Marquer terminé
                </Button>
              </>
            ) : <Button variant="outline" onClick={() => setViewing(null)} className="border-white/10">Fermer</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="bg-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>Motif du rejet</DialogTitle></DialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. coordonnées invalides" className="bg-white/5 border-white/10" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)} className="border-white/10">Annuler</Button>
            <Button onClick={reject} disabled={busy || !reason.trim()} className="bg-red-500/80 text-white">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />} Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}