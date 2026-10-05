import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser, useWallet, formatMoney, formatDate, KYC_META, DEPOSIT_STATUS, TRANSFER_STATUS } from "@/lib/ghb";
import StatusBadge from "@/components/ghb/StatusBadge";
import SupportButtons from "@/components/ghb/SupportButtons";
import CurrencyCalculator from "@/components/ghb/CurrencyCalculator";
import TickerBanner from "@/components/ghb/TickerBanner";
import AnnouncementCarousel from "@/components/ghb/AnnouncementCarousel";
import { ArrowDownToLine, ArrowUpFromLine, MessageSquare, Wallet, TrendingUp, ShieldCheck, Loader2, ChevronRight, Gift, Info } from "lucide-react";

export default function Home() {
  const { user } = useCurrentUser();
  const { balance } = useWallet(user?.id);
  const [deposits, setDeposits] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      base44.entities.DepositRequest.filter({}, { sort: "-created_date", limit: 3 }),
      base44.entities.TransferRequest.filter({}, { sort: "-created_date", limit: 3 }),
      base44.entities.Currency.filter({ active: true }, { sort: "code", limit: 50 }),
    ]).then(([d, t, c]) => {
      if (!alive) return;
      setDeposits(d.items);
      setTransfers(t.items);
      setRates(c.items);
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const kyc = user?.kyc_status || "not_submitted";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Scrolling ticker */}
      <TickerBanner />

      {/* Hero balance card */}
      <div className="relative overflow-hidden rounded-3xl ghb-card p-6 sm:p-8">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="w-4 h-4" /> Solde disponible
            </div>
            <StatusBadge meta={KYC_META} status={kyc} />
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-4xl sm:text-5xl font-extrabold ghb-gold-text tracking-tight">
              ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-muted-foreground mb-1.5 text-sm">USD</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link to="/deposit" className="group flex items-center justify-between px-4 py-3.5 rounded-2xl ghb-emerald-bg text-white font-semibold shadow-lg shadow-emerald-900/30">
              <span className="flex items-center gap-2"><ArrowDownToLine className="w-5 h-5" /> Déposer</span>
              <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition" />
            </Link>
            <Link to="/transfer" className="group flex items-center justify-between px-4 py-3.5 rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#E8C65A] font-semibold">
              <span className="flex items-center gap-2"><ArrowUpFromLine className="w-5 h-5" /> Transférer</span>
              <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition" />
            </Link>
          </div>
        </div>
      </div>

      {/* KYC notice if not approved */}
      {kyc !== "approved" && (
        <Link to="/kyc" className="block ghb-card rounded-2xl p-4 flex items-center gap-3 hover:border-[#D4AF37]/40 transition">
          <div className="w-10 h-10 rounded-xl ghb-emerald-bg flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-foreground text-sm">Vérifiez votre identité</div>
            <div className="text-xs text-muted-foreground">Complétez votre KYC pour activer toutes les fonctionnalités.</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      )}

      {/* Promotional announcements */}
      <AnnouncementCarousel />

      {/* Exchange rates */}
      <div className="ghb-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-foreground font-semibold"><TrendingUp className="w-4 h-4 text-[#D4AF37]" /> Taux de change</div>
          <span className="text-xs text-muted-foreground">Achat / Vente (par USD)</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" /></div>
        ) : rates.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Aucun taux publié.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {rates.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{c.flag_emoji || "💱"}</span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.code}</div>
                    <div className="text-[10px] text-muted-foreground">{c.type}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-emerald-400/70 uppercase leading-none">Achat</div>
                  <div className="text-xs text-emerald-400 font-medium">{Number(c.buy_rate || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                  <div className="text-[9px] text-muted-foreground uppercase leading-none mt-1">Vente</div>
                  <div className="text-xs text-foreground font-medium">{Number(c.sell_rate || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Currency converter */}
      <CurrencyCalculator currencies={rates} loading={loading} />

      {/* Recent activity */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ActivityCard title="Dépôts récents" icon={ArrowDownToLine} items={deposits.map((d) => ({
          id: d.id, title: `${formatMoney(d.amount, d.currency)}`, sub: formatDate(d.created_date), status: d.status, meta: DEPOSIT_STATUS, link: "/transactions",
        }))} loading={loading} />
        <ActivityCard title="Retraits récents" icon={ArrowUpFromLine} items={transfers.map((t) => ({
          id: t.id, title: `${formatMoney(t.amount, t.from_currency)} → ${t.to_currency}`, sub: t.beneficiary_name, status: t.status, meta: TRANSFER_STATUS, link: "/transactions",
        }))} loading={loading} />
      </div>

      {/* Referral & About quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/referral" className="ghb-card rounded-2xl p-4 flex items-center gap-3 hover:border-[#D4AF37]/40 transition">
          <div className="w-10 h-10 rounded-xl ghb-gold-bg flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-black" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground text-sm">Parrainage</div>
            <div className="text-xs text-muted-foreground truncate">Invitez & gagnez</div>
          </div>
        </Link>
        <Link to="/about" className="ghb-card rounded-2xl p-4 flex items-center gap-3 hover:border-[#D4AF37]/40 transition">
          <div className="w-10 h-10 rounded-xl ghb-emerald-bg flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground text-sm">À propos</div>
            <div className="text-xs text-muted-foreground truncate">Notre histoire</div>
          </div>
        </Link>
      </div>

      <div className="sm:hidden">
        <SupportButtons variant="stack" />
      </div>
    </div>
  );
}

function ActivityCard({ title, icon: Icon, items, loading, link }) {
  return (
    <div className="ghb-card rounded-2xl p-5">
      <div className="flex items-center gap-2 text-foreground font-semibold mb-3">
        <Icon className="w-4 h-4 text-[#D4AF37]" /> {title}
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Aucune activité.</div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Link key={it.id} to={link} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/5 transition">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{it.title}</div>
                <div className="text-xs text-muted-foreground truncate">{it.sub}</div>
              </div>
              <StatusBadge meta={it.meta} status={it.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}