import { supabase } from "@/lib/supabase";

export async function ensureReferralCode(user) {
  if (user?.referral_code) return user.referral_code;
  const code = `GHB${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  const { data, error } = await supabase.rpc("set_referral_code", { p_code: code });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.reason || "Unable to create a referral code.");
  return data.code;
}
