create or replace function public.create_transfer_request(
  p_amount numeric,
  p_from_currency text,
  p_to_currency text,
  p_beneficiary_name text,
  p_beneficiary_country text,
  p_payout_method text,
  p_payout_details text,
  p_promo_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  from_code text := upper(trim(coalesce(p_from_currency, '')));
  to_code text := upper(trim(coalesce(p_to_currency, '')));
  from_rate numeric := 1;
  to_rate numeric := 1;
  conversion_rate numeric;
  converted numeric(18, 2);
  available numeric(18, 2);
  transfer_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_account_active() then raise exception 'Account is blocked'; end if;
  if p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount then
    raise exception 'Enter a valid amount with at most two decimal places';
  end if;
  if from_code = '' or to_code = '' then raise exception 'Source and destination currencies are required'; end if;
  if length(trim(coalesce(p_beneficiary_name, ''))) not between 1 and 200
    or length(trim(coalesce(p_payout_details, ''))) not between 1 and 2000 then
    raise exception 'Beneficiary name and payout details are required';
  end if;

  if from_code <> 'USDT' then
    select sell_rate into from_rate from public.currencies
    where code = from_code and active;
    if not found or from_rate <= 0 then raise exception 'Source currency is unavailable'; end if;
  end if;
  if to_code <> 'USDT' then
    select sell_rate into to_rate from public.currencies
    where code = to_code and active;
    if not found or to_rate <= 0 then raise exception 'Destination currency is unavailable'; end if;
  end if;

  select balance into available from public.user_balances
  where user_id = auth.uid() and currency = from_code for update;
  if not found or available < p_amount then
    raise exception 'Insufficient balance for %', from_code;
  end if;
  select * into current_profile from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;

  conversion_rate := to_rate / from_rate;
  converted := round(p_amount * conversion_rate, 2);
  update public.user_balances
  set balance = balance - p_amount,
      reserved_balance = reserved_balance + p_amount,
      updated_at = now()
  where user_id = auth.uid() and currency = from_code;

  insert into public.transfer_requests (
    user_id, user_name, user_email, amount, from_currency, to_currency,
    converted_amount, rate, beneficiary_name, beneficiary_country, payout_method,
    payout_details, promo_code, status, funds_reserved
  ) values (
    auth.uid(), coalesce(current_profile.legal_name, current_profile.email), current_profile.email,
    p_amount, from_code, to_code, converted, conversion_rate,
    trim(p_beneficiary_name), nullif(trim(coalesce(p_beneficiary_country, '')), ''),
    nullif(trim(coalesce(p_payout_method, '')), ''), trim(p_payout_details),
    nullif(upper(trim(coalesce(p_promo_code, ''))), ''), 'pending', true
  ) returning id into transfer_id;

  return transfer_id;
end;
$$;

create or replace function public.process_referral_reward(p_transfer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_record public.transfer_requests%rowtype;
  referred_profile public.profiles%rowtype;
  referral_record public.referrals%rowtype;
  settings_record public.referral_settings%rowtype;
  currency_record public.currencies%rowtype;
  source_rate numeric := 1;
  usd_rate numeric := 1;
  app_fee numeric := 0;
  reward numeric := 0;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into transfer_record from public.transfer_requests where id = p_transfer_id;
  if not found or transfer_record.status <> 'completed' then
    raise exception 'Completed transfer not found';
  end if;
  select * into referred_profile from public.profiles where id = transfer_record.user_id;
  if referred_profile.referred_by is null then return jsonb_build_object('rewarded', false, 'reason', 'no_referrer'); end if;
  select * into referral_record from public.referrals
    where referred_id = transfer_record.user_id and status = 'pending' for update;
  if not found then return jsonb_build_object('rewarded', false, 'reason', 'not_first_transfer'); end if;
  select * into settings_record from public.referral_settings where active limit 1;
  if not found then return jsonb_build_object('rewarded', false, 'reason', 'no_setting'); end if;

  if upper(coalesce(transfer_record.to_currency, '')) <> 'USDT' then
    select * into currency_record from public.currencies
    where code = upper(transfer_record.to_currency) and active;
    if not found then raise exception 'Transfer destination exchange rate is unavailable'; end if;

    if upper(transfer_record.from_currency) <> 'USDT' then
      select sell_rate into source_rate from public.currencies
      where code = upper(transfer_record.from_currency) and active;
      if not found or source_rate <= 0 then raise exception 'Transfer source exchange rate is unavailable'; end if;
    end if;

    select sell_rate into usd_rate from public.currencies where code = 'USD' and active;
    if not found or usd_rate <= 0 then raise exception 'USD exchange rate is unavailable'; end if;
    app_fee := (transfer_record.amount / source_rate) * usd_rate
      * coalesce(currency_record.fee_percent, 5) / 100;
  end if;
  if settings_record.commission_type = 'percent' then
    reward := app_fee * settings_record.commission_value / 100;
  else
    reward := settings_record.commission_value;
  end if;
  if reward <= 0 then return jsonb_build_object('rewarded', false, 'reason', 'zero_reward', 'appFeeUsd', app_fee); end if;

  insert into public.user_balances (user_id, currency, balance)
  values (referred_profile.referred_by, 'USD', round(reward, 2))
  on conflict (user_id, currency) do update
    set balance = public.user_balances.balance + excluded.balance,
        updated_at = now();
  update public.referrals
  set status = 'rewarded', reward_amount = round(reward, 2), first_transfer_id = p_transfer_id
  where id = referral_record.id;
  return jsonb_build_object('rewarded', true, 'reward', round(reward, 2), 'appFeeUsd', app_fee);
end;
$$;
