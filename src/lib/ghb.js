import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { selectRows } from "@/lib/supabaseData";

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

const PRIVATE_BUCKET = "private-files";

export async function uploadPrivate(file) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("You must be signed in to upload a file.");

  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function signFile(path) {
  const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let alive = true;
    let requestId = 0;
    const loadUser = async (authUser) => {
      const currentRequestId = ++requestId;
      if (!authUser) {
        if (alive) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const rows = await selectRows("profiles", { id: authUser.id }, { limit: 1 });
        if (!alive || currentRequestId !== requestId) return;
        setUser({
          ...authUser,
          ...(authUser.user_metadata || {}),
          ...(rows[0] || {}),
          id: authUser.id,
          email: authUser.email,
        });
      } catch (error) {
        console.error("Failed to load the current profile:", error);
        if (alive && currentRequestId === requestId) setUser(null);
      } finally {
        if (alive && currentRequestId === requestId) setLoading(false);
      }
    };

    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "TOKEN_REFRESHED") void loadUser(session?.user || null);
    });
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) throw error;
      return loadUser(data.user);
    }).catch((error) => {
      console.error("Failed to load the current authenticated user:", error);
      if (alive) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [reloadKey]);

  return { user, loading, refresh };
}

export function useUserBalances(userId) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let alive = true;
    if (!userId) {
      setBalances([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    selectRows("user_balances", { user_id: userId }, { sort: "currency", limit: 1000 }).then((rows) => {
      if (alive) setBalances(rows);
    }).catch((error) => {
      console.error("Failed to load user balances:", error);
      if (alive) setBalances([]);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [userId, reloadKey]);

  return { balances, loading, refresh };
}

export function useSupportLinks() {
  const [links, setLinks] = useState({ direct: null, group: null, phone: "+257 616 59 327" });

  useEffect(() => {
    let alive = true;
    selectRows("support_links", { active: true }, { limit: 50 }).then((rows) => {
      if (!alive) return;
      const map = { direct: null, group: null, phone: "+257 616 59 327" };
      for (const link of rows) {
        if (link.type === "whatsapp_direct") map.direct = link;
        else if (link.type === "whatsapp_group") map.group = link;
        else if (link.type === "phone") map.phone = link.phone || map.phone;
      }
      setLinks(map);
    }).catch((error) => {
      console.error("Failed to load support links:", error);
    });
    return () => { alive = false; };
  }, []);

  return links;
}
