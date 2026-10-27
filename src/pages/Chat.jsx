import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { selectRows } from "@/lib/supabaseData";
import { useCurrentUser, formatDate, DEPOSIT_STATUS, TRANSFER_STATUS } from "@/lib/ghb";
import StatusBadge from "@/components/ghb/StatusBadge";
import ChatThread from "@/components/ghb/ChatThread";
import { ChevronLeft, MessageSquare, LifeBuoy, Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export default function Chat() {
  const [params, setParams] = useSearchParams();
  const { user, loading: userLoading } = useCurrentUser();
  const threadType = params.get("threadType");
  const threadId = params.get("threadId");
  // Always bind user conversations to the signed-in account; URL parameters are
  // navigation hints and must not choose the participant identity.
  const userId = user?.id;

  const [deposits, setDeposits] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading || !user) return undefined;
    let alive = true;
    Promise.all([
      selectRows("deposit_requests", {}, { sort: "-created_at", limit: 50 }),
      selectRows("transfer_requests", {}, { sort: "-created_at", limit: 50 }),
    ]).then(([d, t]) => {
      if (!alive) return;
      setDeposits((d || []).filter(Boolean));
      setTransfers((t || []).filter(Boolean));
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.id, userLoading]);

  const openThread = (type, id, uid) => {
    const p = new URLSearchParams({ threadType: type, threadId: id, userId: uid });
    setParams(p);
  };

  const closeThread = () => setParams({});

  if (userLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>;
  }

  if (!user) {
    return <div role="alert" className="max-w-2xl mx-auto ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Connectez-vous pour consulter vos messages.</div>;
  }

  // Conversation view
  if (threadType && threadId && userId) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <button onClick={closeThread} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Retour aux conversations
        </button>
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
          {threadType === "deposit" ? "Conversation — Dépôt" : threadType === "transfer" ? "Conversation — Transfert" : "Support"}
        </div>
        <ChatThread threadType={threadType} threadId={threadId} participantUserId={userId} viewerRole="user" />
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">Discutez avec le support pour chaque transaction.</p>
      </div>

      <button onClick={() => openThread("support", "support", userId)}
        className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl ghb-emerald-bg text-white text-left hover:opacity-95 transition">
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center"><LifeBuoy className="w-5 h-5" /></div>
        <div className="flex-1">
          <div className="font-semibold">Support général</div>
          <div className="text-xs text-white/70">Posez une question à l'équipe GHB Pay</div>
        </div>
        <MessageSquare className="w-4 h-4 opacity-80" />
      </button>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div>
      ) : (
        <div className="space-y-2.5">
          {deposits.filter((d) => d?.id).map((d) => (
            <ThreadRow key={d.id} icon={ArrowDownToLine}
              title={`Dépôt · ${d.currency} ${d.amount}`}
              sub={formatDate(d.created_date)} status={d.status} meta={DEPOSIT_STATUS}
              onClick={() => openThread("deposit", d.id, userId)} />
          ))}
          {transfers.filter((t) => t?.id).map((t) => (
            <ThreadRow key={t.id} icon={ArrowUpFromLine}
              title={`Transfert · ${t.from_currency} ${t.amount} → ${t.to_currency}`}
              sub={`${t.beneficiary_name} · ${formatDate(t.created_date)}`} status={t.status} meta={TRANSFER_STATUS}
              onClick={() => openThread("transfer", t.id, userId)} />
          ))}
          {deposits.length === 0 && transfers.length === 0 && (
            <div className="ghb-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Aucune conversation. Vos dépôts et transferts apparaîtront ici.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadRow({ icon: Icon, title, sub, status, meta, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl ghb-card hover:border-[#D4AF37]/40 transition text-left">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#D4AF37]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{sub}</div>
      </div>
      <StatusBadge meta={meta} status={status} />
    </button>
  );
}
