import { base44 } from "@/api/base44Client";

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

// Called from the admin transfer-completion flow: if the transfer user was
// referred and this is their first validated transfer, credit the referrer.
export async function processReferralReward(transfer) {
  try {
    const user = await base44.entities.User.get(transfer.user_id);
    const referrerId = user?.referred_by;
    if (!referrerId) return { rewarded: false, reason: "no_referrer" };

    const { items } = await base44.entities.Referral.filter(
      { referred_id: transfer.user_id, status: "pending" },
      { limit: 1 }
    );
    if (items.length === 0) return { rewarded: false, reason: "no_pending_referral" };
    const referral = items[0];

    const { items: settings } = await base44.entities.ReferralSetting.filter(
      { active: true },
      { limit: 1 }
    );
    const setting = settings[0];
    if (!setting) return { rewarded: false, reason: "no_setting" };

    let reward = 0;
    if (setting.commission_type === "percent") {
      reward = (Number(transfer.amount || 0) * (setting.commission_value || 0)) / 100;
    } else {
      reward = Number(setting.commission_value || 0);
    }
    if (reward <= 0) return { rewarded: false, reason: "zero_reward" };

    const { items: wallets } = await base44.entities.Wallet.filter(
      { user_id: referrerId },
      { limit: 1 }
    );
    if (wallets.length > 0) {
      const w = wallets[0];
      await base44.entities.Wallet.update(w.id, {
        balance: (w.balance || 0) + reward,
      });
    } else {
      await base44.entities.Wallet.create({ user_id: referrerId, balance: reward });
    }

    await base44.entities.Referral.update(referral.id, {
      status: "rewarded",
      reward_amount: reward,
      first_transfer_id: transfer.id,
    });
    return { rewarded: true, reward };
  } catch (e) {
    return { rewarded: false, error: e.message };
  }
}