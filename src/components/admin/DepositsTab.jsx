import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatMoney, formatDate, DEPOSIT_STATUS, signFile } from "@/lib/ghb";
import StatusBadge from "@/components/ghb/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Check, X, Eye, FileText } from "lucide-react";

export default function DepositsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.DepositRequest.filter({}, { sort: "-created_date", limit: 100 })
      .then(({ items }) => setItems(items))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const view = async (d) => {
    setViewing(d); setReceiptUrl("");
    if (d.receipt_uri) { try { setReceiptUrl(await signFile(d.receipt_uri)); } catch {} }
  };

  const creditWallet = async (userId, amount) => {
    const { items } = await base44.entities.Wallet.filter({ user_id: userId }, { limit: 1 });
    if (items.length > 0) {
      const w = items[0];
      await base44.entities.Wallet.update(w.id, { balance: (w.balance || 0) + amount });
    } else {
      await base44.entities.Wallet.create({ user_id: userId, balance: amount });
    }
  };

  const approve = async (d) => {
    setBusy(true);
    try {
      await base44.entities.DepositRequest.update(d.id, { status: "approved", credited_amount: d.amount, admin_notes: "Crédité" });
      await creditWallet(d.user_id, d.amount);
      setViewing(null); load();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await base44.entities.DepositRequest.update(rejecting.id, { status: "rejected", rejection_reason: reason });
      setRejecting(null); setReason(""); load();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  const pending = items.filter((i) => i.status === "pending");

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{pending.length} dépôt(s) en attente · {items.length} au total</div>
      {items.length === 0 ? (
        <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucun dépôt.</div>
      ) : items.map((d) => (
        <div key={d.id} className="ghb-card rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-foreground">{formatMoney(d.amount, d.currency)}</div>
              <div className="text-xs text-muted-foreground truncate">{d.user_name} · {d.deposit_address_label} · {formatDate(d.created_date)}</div>
              {d.sender_reference && <div className="text-xs text-muted-foreground">Réf: {d.sender_reference}</div>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge meta={DEPOSIT_STATUS} status={d.status} />
              {d.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => view(d)} className="border-white/10 bg-white/5">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Examiner
                </Button>
              )}
            </div>
          </div>
          {d.status === "rejected" && d.rejection_reason && (
            <div className="text-xs text-red-400 mt-2">Rejeté : {d.rejection_reason}</div>
          )}
        </div>
      ))}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle>Preuve de dépôt — {viewing?.user_name}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Montant</span>
                <span className="font-bold ghb-gold-text">{formatMoney(viewing.amount, viewing.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Adresse</span>
                <span className="text-foreground">{viewing.deposit_address_label}</span>
              </div>
              {viewing.sender_reference && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Référence</span>
                  <span className="text-foreground">{viewing.sender_reference}</span>
                </div>
              )}
              <div>
                <div className="text-muted-foreground mb-2">Reçu téléversé</div>
                {receiptUrl ? (
                  /\.(png|jpe?g|webp|gif)$/i.test(viewing.receipt_uri || "") ? (
                    <img src={receiptUrl} alt="reçu" className="w-full rounded-xl border border-white/10" />
                  ) : (
                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-[#E8C65A]">
                      <FileText className="w-4 h-4" /> Ouvrir le reçu
                    </a>
                  )
                ) : <div className="text-muted-foreground">Aucun reçu</div>}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejecting(viewing); setViewing(null); }} className="border-red-500/30 text-red-400">
              <X className="w-4 h-4 mr-1" /> Rejeter
            </Button>
            <Button onClick={() => approve(viewing)} disabled={busy} className="ghb-emerald-bg text-white">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Approuver & créditer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="bg-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>Motif du rejet</DialogTitle></DialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. montant incorrect" className="bg-white/5 border-white/10" />
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