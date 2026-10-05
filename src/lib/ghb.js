import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Format a money amount with currency code
export function formatMoney(amount, currency = "USD") {
  const n = Number(amount || 0);
  const opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  try {
    return new Intl.NumberFormat("en-US", { ...opts, style: "currency", currency }).format(n);
  } catch {
    return `${n.toLocaleString("en-US", opts)} ${currency}`;
  }
}

export function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export const KYC_META = {
  not_submitted: { label: "Non soumis", tone: "muted" },
  pending: { label: "En attente", tone: "amber" },
  approved: { label: "Vérifié", tone: "emerald" },
  rejected: { label: "Rejeté", tone: "red" },
};

export const DEPOSIT_STATUS = {
  pending: { label: "En attente", tone: "amber" },
  approved: { label: "Approuvé", tone: "emerald" },
  rejected: { label: "Rejeté", tone: "red" },
};

export const TRANSFER_STATUS = {
  pending: { label: "En traitement", tone: "amber" },
  completed: { label: "Terminé", tone: "emerald" },
  rejected: { label: "Rejeté", tone: "red" },
};

export const TONE_CLASSES = {
  muted: "bg-white/5 text-muted-foreground border-white/10",
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  red: "bg-red-500/10 text-red-300 border-red-500/30",
  gold: "bg-[#D4AF37]/10 text-[#E8C65A] border-[#D4AF37]/30",
};

// Upload a private file and return its file_uri
export async function uploadPrivate(file) {
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  return file_uri;
}

// Create a signed URL for a private file_uri
export async function signFile(file_uri) {
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
  return signed_url;
}

// Hook: current user with refresh
export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    base44.auth.me()
      .then((u) => { if (alive) { setUser(u); setLoading(false); } })
      .catch(() => { if (alive) { setUser(null); setLoading(false); } });
    return () => { alive = false; };
  }, [reloadKey]);

  return { user, loading, refresh };
}

// Hook: current user's wallet (admin-only writes, so this is read-only for users)
export function useWallet(userId) {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    base44.entities.Wallet.filter({ user_id: userId }, { limit: 1 })
      .then(({ items }) => { if (alive) { setWallet(items[0] || null); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, reloadKey]);

  return { wallet, balance: wallet?.balance || 0, loading, refresh };
}

// Hook: support links (whatsapp direct / group / phone)
export function useSupportLinks() {
  const [links, setLinks] = useState({ direct: null, group: null, phone: "+257 616 59 327" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    base44.entities.SupportLink.filter({ active: true }, { limit: 50 })
      .then(({ items }) => {
        if (!alive) return;
        const map = { ...links };
        for (const l of items) {
          if (l.type === "whatsapp_direct") map.direct = l;
          else if (l.type === "whatsapp_group") map.group = l;
          else if (l.type === "phone") map.phone = l.phone || map.phone;
        }
        setLinks(map);
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return links;
}