import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser, KYC_META, signFile } from "@/lib/ghb";
import StatusBadge from "@/components/ghb/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X, FileText, Eye } from "lucide-react";

export default function KycTab() {
  const { refresh } = useCurrentUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [docUrl, setDocUrl] = useState("");
  const [faceUrl, setFaceUrl] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    base44.functions.invoke('listUsersForAdmin', { filter: { kyc_status: { $in: ['pending', 'rejected'] } } })
      .then((res) => setUsers(res.data?.items || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const viewDoc = async (u) => {
    setReviewing(u);
    setDocUrl("");
    setFaceUrl("");
    if (u.id_document_uri) {
      try { setDocUrl(await signFile(u.id_document_uri)); } catch {}
    }
    if (u.face_uri) {
      try { setFaceUrl(await signFile(u.face_uri)); } catch {}
    }
  };

  const approve = async (u) => {
    setBusy(true);
    try {
      await base44.entities.User.update(u.id, { kyc_status: "approved", kyc_rejection_reason: "" });
      // ensure a wallet exists
      const { items } = await base44.entities.Wallet.filter({ user_id: u.id }, { limit: 1 });
      if (items.length === 0) await base44.entities.Wallet.create({ user_id: u.id, balances: {} });
      setReviewing(null);
      load();
      refresh();
    } catch (e) { alert(e.message || "Échec"); } finally { setBusy(false); }
  };

  const reject = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await base44.entities.User.update(rejecting.id, { kyc_status: "rejected", kyc_rejection_reason: reason });
      setRejecting(null); setReason(""); load(); refresh();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{users.length} demande(s) de vérification</div>
      {users.length === 0 ? (
        <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucune demande en attente.</div>
      ) : users.map((u) => (
        <div key={u.id} className="ghb-card rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-foreground truncate">{u.legal_name || u.email}</div>
            <div className="text-xs text-muted-foreground truncate">{u.email} · {u.phone || "—"} · {u.country || "—"}</div>
            {u.kyc_status === "rejected" && u.kyc_rejection_reason && (
              <div className="text-xs text-red-400 mt-1">Rejeté : {u.kyc_rejection_reason}</div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge meta={KYC_META} status={u.kyc_status} />
            <Button size="sm" variant="outline" onClick={() => viewDoc(u)} className="border-white/10 bg-white/5">
              <Eye className="w-3.5 h-3.5 mr-1" /> Examiner
            </Button>
          </div>
        </div>
      ))}

      {/* Review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-lg">
          <DialogHeader><DialogTitle>Examen KYC — {reviewing?.legal_name || reviewing?.email}</DialogTitle></DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info label="Email" value={reviewing.email} />
                <Info label="Téléphone" value={reviewing.phone} />
                <Info label="Pays" value={reviewing.country} />
                <Info label="Pièce" value={reviewing.id_document_type} />
              </div>
              <div>
                <Label>Document d'identité</Label>
                {docUrl ? (
                  /\.(png|jpe?g|webp|gif)$/i.test(reviewing.id_document_uri || "") ? (
                    <img src={docUrl} alt="pièce" className="mt-2 w-full rounded-xl border border-white/10" />
                  ) : (
                    <a href={docUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm text-[#E8C65A]">
                      <FileText className="w-4 h-4" /> Ouvrir le document
                    </a>
                  )
                ) : <div className="text-muted-foreground">Aucun document</div>}
              </div>
              <div>
                <Label>Photo du visage (selfie)</Label>
                {faceUrl ? (
                  <img src={faceUrl} alt="selfie" className="mt-2 w-full max-w-[200px] rounded-xl border border-white/10" />
                ) : <div className="text-muted-foreground">Aucun selfie</div>}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejecting(reviewing); setReviewing(null); }} className="border-red-500/30 text-red-400">
              <X className="w-4 h-4 mr-1" /> Rejeter
            </Button>
            <Button onClick={() => approve(reviewing)} disabled={busy} className="ghb-emerald-bg text-white">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Approuver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="bg-card border-white/10 max-w-md">
          <DialogHeader><DialogTitle>Motif du rejet</DialogTitle></DialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. document illisible" className="bg-white/5 border-white/10" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)} className="border-white/10">Annuler</Button>
            <Button onClick={reject} disabled={busy || !reason.trim()} className="bg-red-500/80 text-white">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />} Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground truncate">{value || "—"}</div>
    </div>
  );
}