import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatMoney, formatDate, KYC_META, signFile, getBalances } from "@/lib/ghb";
import StatusBadge from "@/components/ghb/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, Eye, Ban, Unlock, KeyRound, FileText } from "lucide-react";

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [docUrl, setDocUrl] = useState("");
  const [faceUrl, setFaceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    base44.functions.invoke("listUsersForAdmin", { filter: {} })
      .then((res) => setUsers(res?.data?.items || res?.items || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const open = async (u) => {
    setViewing(u); setWallet(null); setDocUrl(""); setFaceUrl(""); setMsg("");
    try {
      const { items } = await base44.entities.Wallet.filter({ user_id: u.id }, { limit: 1 });
      setWallet(items[0] || null);
      if (u.id_document_uri) { try { setDocUrl(await signFile(u.id_document_uri)); } catch {} }
      if (u.face_uri) { try { setFaceUrl(await signFile(u.face_uri)); } catch {} }
    } catch {}
  };

  const toggleBlock = async (u) => {
    setBusy(true);
    try {
      await base44.entities.User.update(u.id, { disabled: !u.disabled });
      setViewing({ ...u, disabled: !u.disabled });
      load();
      setMsg(u.disabled ? "Utilisateur débloqué." : "Utilisateur bloqué. Il sera déconnecté à la prochaine ouverture.");
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const sendReset = async (u) => {
    setBusy(true);
    try {
      await base44.auth.resetPasswordRequest(u.email);
      setMsg("Lien de réinitialisation du mot de passe envoyé à " + u.email);
    } catch (e) { setMsg("Échec : " + (e.message || "")); } finally { setBusy(false); }
  };

  const filtered = users.filter((u) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [u.email, u.legal_name, u.username].some((v) => (v || "").toLowerCase().includes(s));
  });

  const balances = wallet ? getBalances(wallet) : {};

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par email, nom ou pseudo…" className="pl-9 bg-white/5 border-white/10" />
      </div>
      <div className="text-sm text-muted-foreground">{filtered.length} utilisateur(s)</div>
      {filtered.length === 0 ? (
        <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucun utilisateur.</div>
      ) : filtered.map((u) => (
        <div key={u.id} className="ghb-card rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground truncate">{u.legal_name || u.email}</span>
              {u.role === "admin" && <span className="text-[10px] px-2 py-0.5 rounded-full ghb-gold-bg text-black">Admin</span>}
              {u.disabled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Bloqué</span>}
            </div>
            <div className="text-xs text-muted-foreground truncate">{u.email} · {u.phone || "—"} · {u.country || "—"}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge meta={KYC_META} status={u.kyc_status || "not_submitted"} />
            <Button size="sm" variant="outline" onClick={() => open(u)} className="border-white/10 bg-white/5">
              <Eye className="w-3.5 h-3.5 mr-1" /> Ouvrir
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="bg-card border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Compte — {viewing?.legal_name || viewing?.email}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info label="Email" value={viewing.email} />
                <Info label="Téléphone" value={viewing.phone} />
                <Info label="Pays" value={viewing.country} />
                <Info label="Pseudo" value={viewing.username} />
                <Info label="Rôle" value={viewing.role} />
                <Info label="KYC" value={KYC_META[viewing.kyc_status]?.label || viewing.kyc_status} />
                <Info label="Code parrain" value={viewing.referral_code} />
                <Info label="Inscrit le" value={viewing.created_date ? formatDate(viewing.created_date) : "—"} />
              </div>

              <div>
                <Label>Soldes (multi-devises)</Label>
                {Object.keys(balances).length === 0 ? (
                  <div className="text-muted-foreground mt-1">Aucun solde.</div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(balances).map(([code, v]) => (
                      <span key={code} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm">{formatMoney(Number(v), code)}</span>
                    ))}
                  </div>
                )}
              </div>

              {(viewing.id_document_uri || viewing.face_uri) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pièce d'identité</Label>
                    {docUrl ? (
                      /\.(png|jpe?g|webp|gif)$/i.test(viewing.id_document_uri || "") ? (
                        <img src={docUrl} alt="pièce" className="mt-2 w-full rounded-xl border border-white/10" />
                      ) : (
                        <a href={docUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-[#E8C65A]"><FileText className="w-4 h-4" /> Ouvrir</a>
                      )
                    ) : <div className="text-muted-foreground mt-1">—</div>}
                  </div>
                  <div>
                    <Label>Selfie</Label>
                    {faceUrl ? <img src={faceUrl} alt="selfie" className="mt-2 w-full max-w-[140px] rounded-xl border border-white/10" /> : <div className="text-muted-foreground mt-1">—</div>}
                  </div>
                </div>
              )}

              {msg && <div className="text-sm text-emerald-400">{msg}</div>}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => sendReset(viewing)} disabled={busy} className="border-white/10">
              <KeyRound className="w-4 h-4 mr-1" /> Réinitialiser le mot de passe
            </Button>
            <Button variant="outline" onClick={() => toggleBlock(viewing)} disabled={busy}
              className={viewing?.disabled ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}>
              {viewing?.disabled ? <><Unlock className="w-4 h-4 mr-1" /> Débloquer</> : <><Ban className="w-4 h-4 mr-1" /> Bloquer</>}
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