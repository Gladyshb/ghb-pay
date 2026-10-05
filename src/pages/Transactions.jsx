import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser, formatMoney, formatDate, DEPOSIT_STATUS, TRANSFER_STATUS } from "@/lib/ghb";
import StatusBadge from "@/components/ghb/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownToLine, ArrowUpFromLine, MessageSquare, Loader2, ChevronRight } from "lucide-react";

export default function Transactions() {
  const { user } = useCurrentUser();
  const [deposits, setDeposits] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      base44.entities.DepositRequest.filter({}, { sort: "-created_date", limit: 50 }),
      base44.entities.TransferRequest.filter({}, { sort: "-created_date", limit: 50 }),
    ]).then(([d, t]) => {
      if (!alive) return;
      setDeposits(d.items);
      setTransfers(t.items);
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Mes transactions</h1>
        <p className="text-sm text-muted-foreground mt-1">Suivez vos dépôts et transferts.</p>
      </div>

      <Tabs defaultValue="deposits">
        <TabsList className="grid grid-cols-2 w-full bg-white/5 border border-white/10">
          <TabsTrigger value="deposits" className="data-[state=active]:ghb-gold-bg data-[state=active]:text-black">
            <ArrowDownToLine className="w-4 h-4 mr-2" /> Dépôts
          </TabsTrigger>
          <TabsTrigger value="transfers" className="data-[state=active]:ghb-gold-bg data-[state=active]:text-black">
            <ArrowUpFromLine className="w-4 h-4 mr-2" /> Transferts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="mt-4 space-y-2.5">
          {loading ? <Spin /> : deposits.length === 0 ? <Empty label="Aucun dépôt." /> :
            deposits.map((d) => (
              <TxRow key={d.id}
                title={formatMoney(d.amount, d.currency)}
                sub={`${d.deposit_address_label} · ${formatDate(d.created_date)}`}
                status={d.status} meta={DEPOSIT_STATUS}
                to={`/chat?threadType=deposit&threadId=${d.id}&userId=${user.id}`} />
            ))}
        </TabsContent>

        <TabsContent value="transfers" className="mt-4 space-y-2.5">
          {loading ? <Spin /> : transfers.length === 0 ? <Empty label="Aucun transfert." /> :
            transfers.map((t) => (
              <TxRow key={t.id}
                title={formatMoney(t.amount, t.from_currency)}
                sub={`${t.beneficiary_name} · ${t.to_currency} · ${formatDate(t.created_date)}`}
                status={t.status} meta={TRANSFER_STATUS}
                to={`/chat?threadType=transfer&threadId=${t.id}&userId=${user.id}`} />
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TxRow({ title, sub, status, meta, to }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl ghb-card hover:border-[#D4AF37]/40 transition">
      <div className="min-w-0">
        <div className="font-semibold text-foreground truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{sub}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge meta={meta} status={status} />
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

function Spin() { return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>; }
function Empty({ label }) { return <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">{label}</div>; }