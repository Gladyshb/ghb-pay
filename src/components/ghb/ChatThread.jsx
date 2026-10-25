import { useEffect, useRef, useState, useCallback } from "react";
import { insertRow, selectRows } from "@/lib/supabaseData";
import { supabase } from "@/lib/supabase";
import { Paperclip, Send, Loader2, Download, FileText } from "lucide-react";
import { uploadPrivate, signFile, formatDate } from "@/lib/ghb";

/** @typedef {Record<string, any> & {
 *   id?: string,
 *   thread_type?: string,
 *   created_at?: string,
 *   created_date?: string,
 *   attachment_uri?: string | null,
 *   attachment_name?: string | null,
 *   sender_role?: string,
 *   text?: string
 * }} ChatMessage */

export default function ChatThread({ threadType, threadId, participantUserId, viewerRole }) {
  const [messages, setMessages] = useState(/** @type {ChatMessage[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [previews, setPreviews] = useState({});
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    try {
      const items = await selectRows("chat_messages",
        { thread_type: threadType, thread_id: threadId },
        { sort: "created_at", limit: 200 }
      );
      setMessages(items);
      setLoadError("");
      // sign attachment previews
      for (const m of items) {
        if (m.attachment_uri) {
          signFile(m.attachment_uri).then((url) =>
            setPreviews((p) => ({ ...p, [m.attachment_uri]: url }))
          ).catch((error) => console.error("Failed to create attachment preview:", error));
        }
      }
    } catch (error) {
      setLoadError(error.message || "Impossible de charger les messages.");
      console.error("Failed to load chat messages:", error);
    } finally {
      setLoading(false);
    }
  }, [threadType, threadId]);

  useEffect(() => { load(); }, [load]);

  // realtime subscription
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase.channel(`chat-${threadType}-${threadId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "chat_messages",
        filter: `thread_id=eq.${threadId}`,
      }, (event) => {
        const message = /** @type {ChatMessage} */ (event.new);
        if (message?.thread_type !== threadType) return;
        if (event.eventType === "INSERT") {
          const mapped = { ...message, created_date: message.created_at };
          setMessages((prev) => prev.some((item) => item.id === mapped.id) ? prev : [...prev, mapped]);
          if (mapped.attachment_uri) {
            signFile(mapped.attachment_uri).then((url) =>
              setPreviews((prev) => ({ ...prev, [mapped.attachment_uri]: url }))
            ).catch((error) => console.error("Failed to create attachment preview:", error));
          }
        } else {
          load();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleAttach = async (file) => {
    if (!file) return;
    setSending(true);
    try {
      const uri = await uploadPrivate(file);
      setAttachment({ uri, name: file.name });
    } catch (e) {
      alert(e.message || "Échec du téléversement");
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    if (!text.trim() && !attachment) return;
    setSending(true);
    try {
      await insertRow("chat_messages", {
        thread_type: threadType,
        thread_id: threadId,
        user_id: participantUserId,
        sender_role: viewerRole,
        text: text.trim(),
        attachment_uri: attachment?.uri || "",
        attachment_name: attachment?.name || "",
      });
      setText("");
      setAttachment(null);
    } catch (e) {
      alert(e.message || "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full ghb-card rounded-2xl overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[60vh]">
        {loadError ? (
          <div role="alert" className="text-center text-sm text-destructive py-8">{loadError}</div>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            Aucun message. Démarrez la conversation.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === viewerRole;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${mine ? "ghb-emerald-bg text-white rounded-br-sm" : "bg-white/5 text-foreground border border-white/10 rounded-bl-sm"}`}>
                  {m.text && <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>}
                  {m.attachment_uri && (
                    <div className="mt-1.5">
                      {/\.(png|jpe?g|webp|gif)$/i.test(m.attachment_name || "") && previews[m.attachment_uri] ? (
                        <a href={previews[m.attachment_uri]} target="_blank" rel="noreferrer">
                          <img src={previews[m.attachment_uri]} alt={m.attachment_name} className="max-h-44 rounded-lg border border-white/10" />
                        </a>
                      ) : (
                        <a href={previews[m.attachment_uri] || "#"} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-black/20">
                          <FileText className="w-3.5 h-3.5" /> {m.attachment_name || "Pièce jointe"}
                          <Download className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                  <div className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-muted-foreground"}`}>
                    {formatDate(m.created_date)} · {m.sender_role === "admin" ? "Support" : "Vous"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {attachment && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-2 bg-white/[0.02]">
          <Paperclip className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-xs text-foreground truncate flex-1">{attachment.name}</span>
          <button onClick={() => setAttachment(null)} className="text-xs text-red-400">Retirer</button>
        </div>
      )}

      <div className="p-3 border-t border-white/10 flex items-center gap-2 bg-background/60">
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleAttach(e.target.files?.[0])} />
        <button onClick={() => fileInputRef.current?.click()} disabled={sending}
          className="p-2.5 rounded-xl border border-white/10 text-muted-foreground hover:bg-white/5 disabled:opacity-50">
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Écrivez un message…"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#D4AF37]/50"
        />
        <button onClick={send} disabled={sending || (!text.trim() && !attachment)}
          className="p-2.5 rounded-xl ghb-gold-bg text-black font-semibold disabled:opacity-50">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}