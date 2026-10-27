import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatDate, formatMoney } from "@/lib/ghb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, UserRound, LockKeyhole, UnlockKeyhole, Trash2, Eye, KeyRound, Wallet, UserRoundCog } from "lucide-react";

const PAGE_SIZE = 20;
const IMPERSONATION_SESSION_KEY = "ghb_admin_impersonation_session";

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [balances, setBalances] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustment, setAdjustment] = useState({ currency: "USD", delta: "", note: "" });
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const listRequestId = useRef(0);
  const navigate = useNavigate();

  const loadUsers = useCallback(async () => {
    const requestId = ++listRequestId.current;
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("profiles")
        .select("id,email,legal_name,username,phone,country,role,kyc_status,is_blocked,created_at", { count: "exact" })
        .order("created_at", { ascending: false });

      const normalizedSearch = search.trim().replace(/[^a-zA-Z0-9@._+\- ]/g, " ").trim();
      if (normalizedSearch) {
        const pattern = `%${normalizedSearch}%`;
        query = query.or(`email.ilike.${pattern},legal_name.ilike.${pattern},username.ilike.${pattern}`);
      }
      if (roleFilter !== "all") query = query.eq("role", roleFilter);
      if (statusFilter === "active") query = query.eq("is_blocked", false);
      if (statusFilter === "blocked") query = query.eq("is_blocked", true);
      if (kycFilter !== "all") query = query.eq("kyc_status", kycFilter);

      const { data, error: queryError, count: total } = await query
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (queryError) throw queryError;
      if (requestId !== listRequestId.current) return;
      setUsers(data || []);
      setCount(total || 0);
    } catch (loadError) {
      if (requestId === listRequestId.current) setError(loadError.message || "Impossible de charger les utilisateurs.");
    } finally {
      if (requestId === listRequestId.current) setLoading(false);
    }
  }, [search, roleFilter, statusFilter, kycFilter, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    let active = true;
    const loadCurrencies = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("currencies")
          .select("code,name,flag_emoji")
          .eq("active", true)
          .order("code");
        if (queryError) throw queryError;
        if (active) setCurrencies(data || []);
      } catch (loadError) {
        if (active) setError(loadError.message || "Impossible de charger les devises.");
      }
    };
    void loadCurrencies();
    return () => { active = false; };
  }, []);

  const showUser = async (profile) => {
    setSelected(profile);
    setBalances([]);
    setPassword("");
    setNotice("");
    setError("");
    setDetailsLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from("user_balances")
        .select("id,user_id,currency,balance,reserved_balance,updated_at")
        .eq("user_id", profile.id)
        .order("currency");
      if (queryError) throw queryError;
      setBalances(data || []);
    } catch (loadError) {
      setError(loadError.message || "Impossible de charger les soldes de cet utilisateur.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const invokeAdminAction = async (action, userId, extra = {}) => {
    const { data, error: invocationError } = await supabase.functions.invoke("admin-users", {
      body: { action, userId, ...extra },
    });
    if (invocationError) throw invocationError;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const toggleBlock = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const action = selected.is_blocked ? "unblock" : "block";
      await invokeAdminAction(action, selected.id);
      const updated = { ...selected, is_blocked: !selected.is_blocked };
      setSelected(updated);
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
      setNotice(action === "block" ? "Compte bloqué." : "Compte débloqué.");
      await loadUsers();
    } catch (actionError) {
      setError(actionError.message || "Impossible de modifier l'accès au compte.");
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await invokeAdminAction("password", selected.id, { password });
      setPassword("");
      setNotice("Mot de passe mis à jour.");
    } catch (actionError) {
      setError(actionError.message || "Impossible de modifier le mot de passe.");
    } finally {
      setBusy(false);
    }
  };

  const adjustBalance = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("admin_adjust_user_balance", {
        p_user_id: selected.id,
        p_currency: adjustment.currency,
        p_delta: Number(adjustment.delta),
        p_note: adjustment.note.trim(),
      });
      if (rpcError) throw rpcError;
      const { data, error: queryError } = await supabase
        .from("user_balances")
        .select("id,user_id,currency,balance,reserved_balance,updated_at")
        .eq("user_id", selected.id)
        .order("currency");
      if (queryError) throw queryError;
      setBalances(data || []);
      setAdjustment({ currency: "USD", delta: "", note: "" });
      setAdjusting(false);
      setNotice("Ajustement de solde enregistré.");
    } catch (actionError) {
      setError(actionError.message || "Impossible d'ajuster ce solde.");
    } finally {
      setBusy(false);
    }
  };

  const impersonate = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error("Session administrateur introuvable.");

      const { tokenHash } = await invokeAdminAction("impersonate", selected.id);
      sessionStorage.setItem(IMPERSONATION_SESSION_KEY, JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }));
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (verifyError) {
        sessionStorage.removeItem(IMPERSONATION_SESSION_KEY);
        throw verifyError;
      }
      window.dispatchEvent(new Event("ghb-impersonation-change"));
      setSelected(null);
      navigate("/", { replace: true });
    } catch (actionError) {
      setError(actionError.message || "Impossible d'ouvrir la session de cet utilisateur.");
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async () => {
    if (!selected || deleteConfirmation !== selected.email) return;
    setBusy(true);
    setError("");
    try {
      await invokeAdminAction("delete", selected.id);
      setDeleting(false);
      setSelected(null);
      setDeleteConfirmation("");
      setNotice("Compte et données associées supprimés.");
      setPage(0);
      await loadUsers();
    } catch (actionError) {
      setError(actionError.message || "Impossible de supprimer ce compte.");
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder="Rechercher par nom, nom d'utilisateur ou e-mail"
            className="bg-white/5 border-white/10 pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-36 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="user">Utilisateur</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-36 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="blocked">Bloqués</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kycFilter} onValueChange={(value) => { setKycFilter(value); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-40 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les KYC</SelectItem>
            <SelectItem value="not_submitted">Non soumis</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="approved">Vérifié</SelectItem>
            <SelectItem value="rejected">Rejeté</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div>}

      <div className="text-sm text-muted-foreground">{count} utilisateur(s) · page {page + 1} / {totalPages}</div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" /></div>
      ) : users.length === 0 ? (
        <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</div>
      ) : (
        <div className="space-y-2">
          {users.map((profile) => (
            <div key={profile.id} className="ghb-card flex items-center justify-between gap-3 rounded-xl p-3 sm:p-4">
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">{profile.legal_name || profile.username || "Sans nom"}</div>
                <div className="truncate text-xs text-muted-foreground">{profile.email}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {profile.role} · KYC {profile.kyc_status} · {profile.is_blocked ? "Bloqué" : "Actif"}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => showUser(profile)} className="shrink-0 border-white/10 bg-white/5">
                <Eye className="mr-1.5 h-4 w-4" /> Détails
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)}
          className="border-white/10">Précédent</Button>
        <Button variant="outline" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((current) => current + 1)}
          className="border-white/10">Suivant</Button>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-[#D4AF37]" /> Profil utilisateur</DialogTitle>
            <DialogDescription>Consultation du profil, des portefeuilles et des actions d’administration.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
                <ProfileField label="Nom" value={selected.legal_name || "—"} />
                <ProfileField label="E-mail" value={selected.email || "—"} />
                <ProfileField label="Nom d'utilisateur" value={selected.username || "—"} />
                <ProfileField label="Téléphone" value={selected.phone || "—"} />
                <ProfileField label="Pays" value={selected.country || "—"} />
                <ProfileField label="Inscrit le" value={formatDate(selected.created_at)} />
                <ProfileField label="Rôle" value={selected.role} />
                <ProfileField label="KYC" value={selected.kyc_status} />
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-[#D4AF37]" /> Soldes par devise</h3>
                  <Button size="sm" variant="outline" onClick={() => setAdjusting(true)} className="border-white/10">
                    Ajuster un solde
                  </Button>
                </div>
                {detailsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" /></div>
                ) : balances.length ? balances.map((balance) => (
                  <div key={balance.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
                    <span className="font-medium">{balance.currency}</span>
                    <div className="text-right">
                      <div>{formatMoney(balance.balance, balance.currency)}</div>
                      {Number(balance.reserved_balance) > 0 && (
                        <div className="text-xs text-amber-300">Réservé : {formatMoney(balance.reserved_balance, balance.currency)}</div>
                      )}
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Aucun solde enregistré.</p>}
              </section>

              <section className="space-y-2 border-t border-white/10 pt-4">
                <Label htmlFor="admin-user-password" className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Nouveau mot de passe (12 caractères minimum)</Label>
                <div className="flex gap-2">
                  <Input id="admin-user-password" type="password" autoComplete="new-password" value={password}
                    onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128}
                    className="bg-white/5 border-white/10" />
                  <Button onClick={updatePassword} disabled={busy || password.length < 12}>Modifier</Button>
                </div>
              </section>

              {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
              {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div>}

              <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:flex-wrap">
                {selected.role !== "admin" && (
                  <>
                    <Button variant="outline" onClick={toggleBlock} disabled={busy} className="border-amber-500/30 text-amber-300">
                      {selected.is_blocked ? <UnlockKeyhole className="mr-2 h-4 w-4" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                      {selected.is_blocked ? "Débloquer" : "Bloquer"}
                    </Button>
                    <Button variant="outline" onClick={impersonate} disabled={busy || selected.is_blocked || !selected.email}
                      className="border-white/10">
                      <UserRoundCog className="mr-2 h-4 w-4" /> Se connecter en tant que
                    </Button>
                    <Button variant="outline" onClick={() => { setDeleteConfirmation(""); setDeleting(true); }}
                      className="border-red-500/30 text-red-300">
                      <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={adjusting} onOpenChange={setAdjusting}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader><DialogTitle>Ajuster le solde</DialogTitle></DialogHeader>
          <form onSubmit={adjustBalance} className="space-y-4">
            <div className="space-y-2">
              <Label>Devise</Label>
              <Select value={adjustment.currency} onValueChange={(currency) => setAdjustment((current) => ({ ...current, currency }))}>
                <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...new Set(["USD", "USDT", ...balances.map((balance) => balance.currency), ...currencies.map((currency) => currency.code)])]
                    .sort().map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Variation (positive ou négative)</Label>
              <Input type="number" step="0.01" value={adjustment.delta}
                onChange={(event) => setAdjustment((current) => ({ ...current, delta: event.target.value }))}
                placeholder="Ex. 25.00 ou -10.00" className="bg-white/5 border-white/10" />
            </div>
            <div className="space-y-2">
              <Label>Motif (obligatoire)</Label>
              <Input value={adjustment.note}
                onChange={(event) => setAdjustment((current) => ({ ...current, note: event.target.value }))}
                maxLength={500} className="bg-white/5 border-white/10" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || !adjustment.delta || !adjustment.note.trim()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent className="border-red-500/30 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-300">Suppression définitive</DialogTitle>
            <DialogDescription>
              Cette action supprime l’utilisateur et les données associées. Pour confirmer, saisissez son adresse e-mail exacte :
              <span className="mt-2 block font-semibold text-foreground">{selected?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)}
            autoComplete="off" className="bg-white/5 border-white/10" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)} className="border-white/10">Annuler</Button>
            <Button onClick={deleteUser} disabled={busy || deleteConfirmation !== selected?.email}
              className="bg-red-600 text-white hover:bg-red-700">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="break-words text-sm text-foreground">{value}</div>
    </div>
  );
}
