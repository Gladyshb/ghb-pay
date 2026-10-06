import { base44 } from "@/api/base44Client";
import { getBalances, withCredit } from "@/lib/ghb";

// Generate and persist a unique referral code for the current user if missing.
export async function ensureReferralCode(user) {
  if (user?.referral_code) return user.referral_code;
  const code = "GHB" + Math.random().toString(36).slice(2, 8).toUpperCase();
  try {
    await base44.auth.updateMe({ referral_code: code });
  } catch {
    /* ignore — code still returned for display */
  }
  return code;
}

// Called from the admin transfer-completion flow: credits the referrer ONLY on
// the referred user's first validated transfer. The reward equals a configured
// percentage of the fees collected by the app on that transfer (or a fixed amount).
export async function processReferralReward(transfer) {
  try {
    const user = await base44.entities.User.get(transfer.user_id);
    const referrerId = user?.referred_by;
    if (!referrerId) return { rewarded: false, reason: "no_referrer" };

    // First transfer only: a pending referral must exist. Once rewarded, it is no
    // longer pending, so subsequent transfers of the same filleul find nothing.
    const { items } = await base44.entities.Referral.filter(
      { referred_id: transfer.user_id, status: "pending" },
      { limit: 1 }
    );
    if (items.length === 0) return { rewarded: false, reason: "not_first_transfer" };
    const referral = items[0];

    const { items: settings } = await base44.entities.ReferralSetting.filter(
      { active: true },
      { limit: 1 }
    );
    const setting = settings[0];
    if (!setting) return { rewarded: false, reason: "no_setting" };

    // App fee collected on this transfer = margin on the payout currency.
    const toCur = (transfer.to_currency || "").toUpperCase();
    let appFeeUsd = 0;
    if (toCur !== "USD" && toCur !== "USDT") {
      const { items: curs } = await base44.entities.Currency.filter({ code: toCur }, { limit: 1 });
      const cur = curs[0];
      const feePercent = Number(cur?.fee_percent ?? 5);
      appFeeUsd = (Number(transfer.amount || 0) * feePercent) / 100;
    }

    let reward = 0;
    if (setting.commission_type === "percent") {
      reward = (appFeeUsd * (setting.commission_value || 0)) / 100;
    } else {
      reward = Number(setting.commission_value || 0);
    }
    if (reward <= 0) return { rewarded: false, reason: "zero_reward", appFeeUsd };

    const { items: wallets } = await base44.entities.Wallet.filter(
      { user_id: referrerId },
      { limit: 1 }
    );
    if (wallets.length > 0) {
      const w = wallets[0];
      const balances = withCredit(getBalances(w), "USD", reward);
      await base44.entities.Wallet.update(w.id, { balances });
    } else {
      await base44.entities.Wallet.create({ user_id: referrerId, balances: { USD: reward } });
    }

    await base44.entities.Referral.update(referral.id, {
      status: "rewarded",
      reward_amount: reward,
      first_transfer_id: transfer.id,
    });
    return { rewarded: true, reward, appFeeUsd };
  } catch (e) {
    return { rewarded: false, error: e.message };
  }
}