import { useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, ArrowDownToLine, ArrowUpFromLine, ReceiptText, History as HistoryIcon, MessageSquare, ShieldAlert, LogOut, LayoutDashboard, Gift, Info } from "lucide-react";
import { useCurrentUser, useWallet, KYC_META } from "@/lib/ghb";
import { useAuth } from "@/lib/AuthContext";
import Logo from "./Logo";
import SupportButtons from "./SupportButtons";
import StatusBadge from "./StatusBadge";

const NAV = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/deposit", label: "Dépôt", icon: ArrowDownToLine },
  { to: "/transfer", label: "Transfert", icon: ArrowUpFromLine },
  { to: "/referral", label: "Parrain", icon: Gift },
  { to: "/history", label: "Historique", icon: HistoryIcon },
  { to: "/chat", label: "Chat", icon: MessageSquare },
];

export default function AppShell() {
  const { user, loading } = useCurrentUser();
  const { balance } = useWallet(user?.id);
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin";
  const kyc = user?.kyc_status || "not_submitted";
  const isKycRoute = location.pathname === "/kyc";
  const isAdminRoute = location.pathname.startsWith("/admin");

  // Non-admin without approved KYC: only allow /kyc route
  const gated = !isAdmin && kyc !== "approved" && !isKycRoute;
  // Admin console reserved to admins
  const adminBlocked = isAdminRoute && !isAdmin;

  useEffect(() => {
    if (loading) return;
    if (adminBlocked) { navigate("/", { replace: true }); return; }
    if (gated && !isKycRoute) navigate("/kyc", { replace: true });
  }, [gated, isKycRoute, adminBlocked, loading, navigate]);

  if (!loading && (gated || adminBlocked)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#D4AF37] rounded-full animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#D4AF37] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col ghb-gradient">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            {isAdmin && (
              <NavLink to="/admin"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border ${isActive ? "bg-[#D4AF37]/15 text-[#E8C65A] border-[#D4AF37]/40" : "border-white/10 text-foreground hover:bg-white/5"}`
                }>
                <LayoutDashboard className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Admin</span>
              </NavLink>
            )}
            {!isAdmin && kyc === "approved" && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <span className="text-xs text-muted-foreground">Solde</span>
                <span className="text-sm font-bold ghb-gold-text">
                  ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <NavLink to="/about" title="À propos"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border ${isActive ? "bg-[#D4AF37]/15 text-[#E8C65A] border-[#D4AF37]/40" : "border-white/10 text-foreground hover:bg-white/5"}`
              }>
              <Info className="w-3.5 h-3.5" /> <span className="hidden sm:inline">À propos</span>
            </NavLink>
            <button onClick={() => logout()} title="Déconnexion"
              className="p-2 rounded-lg border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-5 pb-28 sm:pb-10">
        {gated && isKycRoute ? (
          <Outlet />
        ) : (
          <Outlet />
        )}
      </main>

      {/* Bottom nav (mobile) */}
      {!isAdminRoute && (
        <nav className="fixed bottom-0 inset-x-0 z-30 sm:hidden border-t border-white/10 bg-background/95 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto grid grid-cols-6">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition ${isActive ? "text-[#D4AF37]" : "text-muted-foreground"}`
                  }>
                  <Icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      {/* Desktop side support strip */}
      <div className="hidden sm:block fixed bottom-6 right-6 z-20">
        <SupportButtons />
      </div>
    </div>
  );
}

// KYC gate screen (shown when non-admin lacks approved KYC and not on /kyc)
export function KycGate() {
  const { user } = useCurrentUser();
  const kyc = user?.kyc_status || "not_submitted";
  return (
    <div className="max-w-md mx-auto pt-10">
      <div className="ghb-card rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl ghb-emerald-bg mx-auto flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Vérification KYC requise</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Votre compte doit être vérifié avant d'accéder aux dépôts, transferts et taux de change.
        </p>
        <div className="mt-4 flex justify-center">
          <StatusBadge meta={KYC_META} status={kyc} />
        </div>
      </div>
    </div>
  );
}