import { useEffect, useState } from "react";
import { selectRows } from "@/lib/supabaseData";
import { formatDate } from "@/lib/ghb";
import ChatThread from "@/components/ghb/ChatThread";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MessageSquare, ArrowDownToLine, ArrowUpFromLine, LifeBuoy, ChevronRight } from "lucide-react";

export default function ChatInboxTab() {
  const [deposits, setDeposits] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [supportMsgs, setSupportMsgs] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null); // {threadType, threadId, userId, title}

  useEffect(() => {
    let alive = true;
    Promise.all([
      selectRows("deposit_requests", {}, { sort: "-created_at", limit: 100 }),
      selectRows("transfer_requests", {}, { sort: "-created_at", limit: 100 }),
      selectRows("chat_messages", { thread_type: "support" }, { sort: "-created_at", limit: 100 }),
    ]).then(async ([d, t, s]) => {
      if (!alive) return;
      setDeposits(d);
      setTransfers(t);
      setSupportMsgs(s);
      // fetch user names for support threads
      const ids = [...new Set(s.map((m) => m.user_id))];
      const uMap = {};
      if (ids.length > 0) {
        const profiles = await selectRows("profiles", { id: ids });
        for (const profile of profiles) uMap[profile.id] = profile;
      }
      if (alive) { setUsers(uMap); setLoading(false); }
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // distinct support users with latest message
  const supportThreads = Object.entries(
    supportMsgs.reduce((acc, m) => {
      if (!acc[m.user_id]) acc[m.user_id] = m;
      return acc;
    }, {})
  ).map(([uid, m]) => ({ user_id: uid, latest: m }));

  return (
    <div className="space-y-5">
      {loading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" /></div> : (
        <>
          <Section title="Support général" icon={LifeBuoy}>
            {supportThreads.length === 0 ? <Empty label="Aucune conversation de support." /> : supportThreads.map((st) => (
              <Row key={st.user_id} icon={LifeBuoy}
                title={users[st.user_id]?.legal_name || users[st.user_id]?.email || st.user_id}
                sub={st.latest.text || "Pièce jointe"}
                onClick={() => setOpen({ threadType: "support", threadId: "support", userId: st.user_id, title: "Support général" })} />
            ))}
          </Section>

          <Section title="Dépôts" icon={ArrowDownToLine}>
            {deposits.length === 0 ? <Empty label="Aucun dépôt." /> : deposits.map((d) => (
              <Row key={d.id} icon={ArrowDownToLine}
                title={`${d.user_name} — ${d.currency} ${d.amount}`}
                sub={`${d.deposit_address_label} · ${formatDate(d.created_date)}`}
                onClick={() => setOpen({ threadType: "deposit", threadId: d.id, userId: d.user_id, title: `Dépôt — ${d.user_name}` })} />
            ))}
          </Section>

          <Section title="Transferts" icon={ArrowUpFromLine}>
            {transfers.length === 0 ? <Empty label="Aucun transfert." /> : transfers.map((t) => (
              <Row key={t.id} icon={ArrowUpFromLine}
                title={`${t.user_name} — ${t.from_currency} ${t.amount} → ${t.to_currency}`}
                sub={`${t.beneficiary_name} · ${formatDate(t.created_date)}`}
                onClick={() => setOpen({ threadType: "transfer", threadId: t.id, userId: t.user_id, title: `Transfert — ${t.user_name}` })} />
            ))}
          </Section>
        </>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="bg-card border-white/10 max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-white/10">
            <DialogTitle className="flex items-center gap-2 text-base"><MessageSquare className="w-4 h-4 text-[#D4AF37]" /> {open?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {open && <ChatThread threadType={open.threadType} threadId={open.threadId} participantUserId={open.userId} viewerRole="admin" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-foreground font-semibold text-sm"><Icon className="w-4 h-4 text-[#D4AF37]" /> {title}</div>
      {children}
    </div>
  );
}
function Row({ icon: Icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl ghb-card hover:border-[#D4AF37]/40 transition text-left">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-[#D4AF37]" /></div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground truncate">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{sub}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}
function Empty({ label }) { return <div className="ghb-card rounded-2xl p-5 text-center text-sm text-muted-foreground">{label}</div>; }