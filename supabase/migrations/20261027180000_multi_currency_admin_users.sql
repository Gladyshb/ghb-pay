alter table public.profiles
  add column if not exists is_blocked boolean not null default false;

create table if not exists public.user_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency = upper(currency) and length(currency) between 2 and 12),
  balance numeric(18, 2) not null default 0 check (balance >= 0),
  reserved_balance numeric(18, 2) not null default 0 check (reserved_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, currency)
);

create index if not exists user_balances_user_idx on public.user_balances (user_id, currency);
alter table public.profiles drop constraint if exists profiles_referred_by_fkey;
alter table public.profiles add constraint profiles_referred_by_fkey
  foreign key (referred_by) references public.profiles(id) on delete set null;
alter table public.transfer_requests
  add column if not exists funds_reserved boolean not null default false;

insert into public.user_balances (user_id, currency, balance)
select user_id, 'USD', balance
from public.wallets
on conflict (user_id, currency) do nothing;

create table if not exists public.admin_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null,
  delta numeric(18, 2) not null check (delta <> 0),
  balance_after numeric(18, 2) not null check (balance_after >= 0),
  note text not null,
  created_at timestamptz not null default now()
);

create or replace function public.prevent_non_admin_account_blocking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_blocked is distinct from old.is_blocked
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_admin() then
    raise exception 'Only administrators can change account access';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_non_admin_blocking on public.profiles;
create trigger profiles_prevent_non_admin_blocking
  before update on public.profiles
  for each row execute function public.prevent_non_admin_account_blocking();

alter table public.admin_balance_adjustments enable row level security;
alter table public.user_balances enable row level security;

create or replace function public.is_account_active(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and not is_blocked
  );
$$;

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles for update to authenticated
  using ((id = (select auth.uid()) and (select public.is_account_active()))
    or (select public.is_admin()))
  with check ((id = (select auth.uid()) and (select public.is_account_active()))
    or (select public.is_admin()));

drop policy if exists user_balances_select_owner_or_admin on public.user_balances;
create policy user_balances_select_owner_or_admin on public.user_balances for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_account_active()))
    or (select public.is_admin()));
drop policy if exists user_balances_admin_all on public.user_balances;
create policy user_balances_admin_all on public.user_balances for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists admin_balance_adjustments_admin_select on public.admin_balance_adjustments;
create policy admin_balance_adjustments_admin_select on public.admin_balance_adjustments for select to authenticated
  using ((select public.is_admin()));

drop policy if exists deposit_requests_select_owner_or_admin on public.deposit_requests;
create policy deposit_requests_select_owner_or_admin on public.deposit_requests for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_account_active()))
    or (select public.is_admin()));
drop policy if exists deposit_requests_insert_owner on public.deposit_requests;
create policy deposit_requests_insert_owner on public.deposit_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending'
    and (select public.is_account_active()));

drop policy if exists transfer_requests_select_owner_or_admin on public.transfer_requests;
create policy transfer_requests_select_owner_or_admin on public.transfer_requests for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_account_active()))
    or (select public.is_admin()));
drop policy if exists transfer_requests_insert_owner on public.transfer_requests;
drop policy if exists transfer_requests_admin_update on public.transfer_requests;

drop policy if exists chat_messages_select_participants on public.chat_messages;
create policy chat_messages_select_participants on public.chat_messages for select to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_account_active()))
    or (select public.is_admin()));
drop policy if exists chat_messages_insert_participants on public.chat_messages;
create policy chat_messages_insert_participants on public.chat_messages for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and sender_role = 'user' and not (select public.is_admin())
      and (select public.is_account_active()))
    or ((select public.is_admin()) and sender_role = 'admin')
  );

drop policy if exists referrals_select_participant_or_admin on public.referrals;
create policy referrals_select_participant_or_admin on public.referrals for select to authenticated
  using (((referrer_id = (select auth.uid()) or referred_id = (select auth.uid()))
      and (select public.is_account_active()))
    or (select public.is_admin()));

create or replace function public.set_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_account_active() then raise exception 'Account is blocked'; end if;
  if normalized_code !~ '^[A-Z0-9]{3,20}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_format');
  end if;
  if exists (select 1 from public.profiles p where upper(p.referral_code) = normalized_code and p.id <> auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end if;
  perform set_config('ghb.allow_referral_profile_update', 'on', true);
  update public.profiles set referral_code = normalized_code where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  perform set_config('ghb.allow_referral_profile_update', 'off', true);
  return jsonb_build_object('ok', true, 'code', normalized_code);
end;
$$;

create or replace function public.apply_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
  sponsor public.profiles%rowtype;
  normalized_code text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_account_active() then raise exception 'Account is blocked'; end if;
  if normalized_code = '' then return jsonb_build_object('ok', false, 'reason', 'no_code'); end if;
  select * into current_profile from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Profile not found'; end if;
  if current_profile.referred_by is not null then return jsonb_build_object('ok', false, 'reason', 'already_referred'); end if;
  select * into sponsor from public.profiles where upper(referral_code) = normalized_code limit 1;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if sponsor.id = current_profile.id then return jsonb_build_object('ok', false, 'reason', 'self'); end if;

  perform set_config('ghb.allow_referral_profile_update', 'on', true);
  update public.profiles set referred_by = sponsor.id where id = current_profile.id;
  perform set_config('ghb.allow_referral_profile_update', 'off', true);
  insert into public.referrals (
    referrer_id, referrer_name, referrer_code, referred_id, referred_name,
    referred_username, referred_email, status, reward_amount
  ) values (
    sponsor.id, coalesce(sponsor.legal_name, sponsor.email), coalesce(sponsor.referral_code, ''),
    current_profile.id, coalesce(current_profile.legal_name, current_profile.email),
    coalesce(current_profile.username, ''), current_profile.email, 'pending', 0
  );
  return jsonb_build_object('ok', true, 'referrer_name', coalesce(sponsor.legal_name, sponsor.email));
end;
$$;

create or replace function public.approve_deposit(p_deposit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deposit_record public.deposit_requests%rowtype;
  currency_code text;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into deposit_record from public.deposit_requests where id = p_deposit_id for update;
  if not found then raise exception 'Deposit request not found'; end if;
  if deposit_record.status <> 'pending' then raise exception 'Deposit request is no longer pending'; end if;

  currency_code := upper(trim(deposit_record.currency));
  if currency_code = '' then raise exception 'Deposit currency is required'; end if;
  insert into public.user_balances (user_id, currency, balance)
  values (deposit_record.user_id, currency_code, deposit_record.amount)
  on conflict (user_id, currency) do update
    set balance = public.user_balances.balance + excluded.balance,
        updated_at = now();

  update public.deposit_requests
  set status = 'approved', credited_amount = deposit_record.amount, admin_notes = 'Crédité'
  where id = p_deposit_id;
end;
$$;

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

  if from_code not in ('USD', 'USDT') then
    select sell_rate into from_rate from public.currencies
    where code = from_code and active;
    if not found or from_rate <= 0 then raise exception 'Source currency is unavailable'; end if;
  end if;
  if to_code not in ('USD', 'USDT') then
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

create or replace function public.reject_transfer(p_transfer_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_record public.transfer_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if length(trim(coalesce(p_reason, ''))) not between 1 and 1000 then
    raise exception 'A valid rejection reason is required';
  end if;
  select * into transfer_record from public.transfer_requests where id = p_transfer_id for update;
  if not found then raise exception 'Transfer request not found'; end if;
  if transfer_record.status <> 'pending' then raise exception 'Transfer request is no longer pending'; end if;

  if transfer_record.funds_reserved then
    update public.user_balances
    set balance = balance + transfer_record.amount,
        reserved_balance = reserved_balance - transfer_record.amount,
        updated_at = now()
    where user_id = transfer_record.user_id
      and currency = upper(transfer_record.from_currency)
      and reserved_balance >= transfer_record.amount;
    if not found then raise exception 'Reserved transfer funds could not be refunded'; end if;
  end if;

  update public.transfer_requests
  set status = 'rejected', rejection_reason = trim(p_reason)
  where id = p_transfer_id;
end;
$$;

create or replace function public.admin_adjust_user_balance(
  p_user_id uuid,
  p_currency text,
  p_delta numeric,
  p_note text
)
returns public.user_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  currency_code text := upper(trim(coalesce(p_currency, '')));
  result_balance public.user_balances%rowtype;
  current_balance numeric(18, 2);
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_user_id is null or currency_code = '' then raise exception 'User and currency are required'; end if;
  if p_delta is null or p_delta = 0 or round(p_delta, 2) <> p_delta then
    raise exception 'Adjustment must be non-zero and have at most two decimal places';
  end if;
  if length(trim(coalesce(p_note, ''))) not between 1 and 500 then
    raise exception 'A reason is required for the adjustment';
  end if;

  insert into public.user_balances (user_id, currency, balance)
  values (p_user_id, currency_code, 0)
  on conflict (user_id, currency) do nothing;
  select balance into current_balance from public.user_balances
  where user_id = p_user_id and currency = currency_code for update;
  if current_balance + p_delta < 0 then
    raise exception 'Adjustment would result in a negative balance';
  end if;
  update public.user_balances
  set balance = balance + p_delta, updated_at = now()
  where user_id = p_user_id and currency = currency_code
  returning * into result_balance;
  if not found then raise exception 'Balance adjustment would result in a negative balance'; end if;

  insert into public.admin_balance_adjustments (
    admin_id, user_id, currency, delta, balance_after, note
  ) values (
    auth.uid(), p_user_id, currency_code, p_delta, result_balance.balance, trim(p_note)
  );
  return result_balance;
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

  if upper(coalesce(transfer_record.to_currency, '')) not in ('USD', 'USDT') then
    select * into currency_record from public.currencies where code = upper(transfer_record.to_currency) limit 1;
    if upper(transfer_record.from_currency) not in ('USD', 'USDT') then
      select sell_rate into source_rate from public.currencies
      where code = upper(transfer_record.from_currency) limit 1;
      if not found or source_rate <= 0 then raise exception 'Transfer source exchange rate is unavailable'; end if;
    end if;
    app_fee := (transfer_record.amount / source_rate) * coalesce(currency_record.fee_percent, 5) / 100;
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

create or replace function public.complete_transfer(p_transfer_id uuid, p_receipt_uri text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_record public.transfer_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into transfer_record from public.transfer_requests where id = p_transfer_id for update;
  if not found then raise exception 'Transfer request not found'; end if;
  if transfer_record.status <> 'pending' then raise exception 'Transfer request is no longer pending'; end if;

  if transfer_record.funds_reserved then
    update public.user_balances
    set reserved_balance = reserved_balance - transfer_record.amount,
        updated_at = now()
    where user_id = transfer_record.user_id
      and currency = upper(transfer_record.from_currency)
      and reserved_balance >= transfer_record.amount;
  else
    update public.user_balances
    set balance = balance - transfer_record.amount,
        updated_at = now()
    where user_id = transfer_record.user_id
      and currency = upper(transfer_record.from_currency)
      and balance >= transfer_record.amount;
  end if;
  if not found then raise exception 'Insufficient balance for %', transfer_record.from_currency; end if;

  update public.transfer_requests
  set status = 'completed', receipt_uri = p_receipt_uri
  where id = p_transfer_id;
  perform public.process_referral_reward(p_transfer_id);
end;
$$;

alter table public.referrals drop constraint if exists referrals_first_transfer_id_fkey;
alter table public.referrals add constraint referrals_first_transfer_id_fkey
  foreign key (first_transfer_id) references public.transfer_requests(id) on delete set null;

grant select on public.user_balances, public.admin_balance_adjustments to authenticated;
revoke all on function public.approve_deposit(uuid) from public, anon;
revoke all on function public.create_transfer_request(numeric, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.reject_transfer(uuid, text) from public, anon;
revoke all on function public.admin_adjust_user_balance(uuid, text, numeric, text) from public, anon;
revoke all on function public.complete_transfer(uuid, text) from public, anon;
revoke all on function public.process_referral_reward(uuid) from public, anon;
grant execute on function public.approve_deposit(uuid) to authenticated;
grant execute on function public.create_transfer_request(numeric, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.reject_transfer(uuid, text) to authenticated;
grant execute on function public.admin_adjust_user_balance(uuid, text, numeric, text) to authenticated;
grant execute on function public.complete_transfer(uuid, text) to authenticated;
grant execute on function public.process_referral_reward(uuid) to authenticated;
revoke all on function public.is_account_active(uuid) from public, anon;
revoke all on function public.can_read_private_file(text) from public, anon;
grant execute on function public.is_account_active(uuid) to authenticated;
grant execute on function public.can_read_private_file(text) to authenticated;

create or replace function public.can_read_private_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    ((select public.is_account_active()) and (
      (storage.foldername(p_path))[1] = (select auth.uid())::text
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.id_document_uri = p_path)
      or exists (select 1 from public.deposit_requests d where d.user_id = (select auth.uid()) and d.receipt_uri = p_path)
      or exists (select 1 from public.transfer_requests t where t.user_id = (select auth.uid()) and t.receipt_uri = p_path)
      or exists (select 1 from public.chat_messages m where m.user_id = (select auth.uid()) and m.attachment_uri = p_path)
    ))
    or (select public.is_admin());
$$;

drop policy if exists private_files_insert_owner on storage.objects;
create policy private_files_insert_owner on storage.objects for insert to authenticated
  with check (
    bucket_id = 'private-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_account_active())
  );

drop policy if exists private_files_delete_owner_or_admin on storage.objects;
create policy private_files_delete_owner_or_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'private-files'
    and (((storage.foldername(name))[1] = (select auth.uid())::text
      and (select public.is_account_active()))
      or (select public.is_admin()))
  );
