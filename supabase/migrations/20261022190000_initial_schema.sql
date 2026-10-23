create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('admin', 'user')),
  username text,
  legal_name text,
  phone text,
  country text,
  id_document_type text,
  id_document_uri text,
  kyc_status text not null default 'not_submitted' check (kyc_status in ('not_submitted', 'pending', 'approved', 'rejected')),
  kyc_rejection_reason text,
  referral_code text,
  referred_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_referral_code_unique
  on public.profiles (upper(referral_code)) where referral_code is not null;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, legal_name, username, phone, country)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'legal_name',
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'country'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

insert into public.profiles (id, email, legal_name, username, phone, country)
select
  id,
  email,
  raw_user_meta_data ->> 'legal_name',
  raw_user_meta_data ->> 'username',
  raw_user_meta_data ->> 'phone',
  raw_user_meta_data ->> 'country'
from auth.users
on conflict (id) do nothing;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (not public.is_admin()) then
    if new.role is distinct from old.role then
      raise exception 'Only administrators can change profile roles';
    end if;
    if new.kyc_status = 'approved' or
       (new.kyc_status is distinct from old.kyc_status and new.kyc_status <> 'pending') then
      raise exception 'Only administrators can approve or reject KYC';
    end if;
    if (new.referral_code is distinct from old.referral_code
        or new.referred_by is distinct from old.referred_by)
       and current_setting('ghb.allow_referral_profile_update', true) is distinct from 'on' then
      raise exception 'Referral fields must be changed through the referral functions';
    end if;
    if new.id_document_uri is distinct from old.id_document_uri
       and new.id_document_uri is not null
       and new.id_document_uri <> ''
       and (storage.foldername(new.id_document_uri))[1] is distinct from (select auth.uid())::text then
      raise exception 'KYC files must belong to the authenticated user';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance numeric(18, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text,
  user_email text,
  amount numeric(18, 2) not null check (amount > 0),
  currency text not null,
  deposit_address_id text,
  deposit_address_label text,
  receipt_uri text,
  sender_reference text,
  promo_code text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  rejection_reason text,
  credited_amount numeric(18, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text,
  user_email text,
  amount numeric(18, 2) not null check (amount > 0),
  from_currency text not null,
  to_currency text not null,
  converted_amount numeric(18, 2),
  rate numeric(18, 6),
  beneficiary_name text not null,
  beneficiary_country text,
  payout_method text,
  payout_details text,
  promo_code text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  receipt_uri text,
  admin_notes text,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.currencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  symbol text,
  flag_emoji text,
  type text not null default 'fiat' check (type in ('fiat', 'crypto')),
  binance_rate numeric(18, 6) not null default 0,
  fee_percent numeric(8, 4) not null default 5,
  spread_fixed numeric(18, 6) not null default 0,
  buy_rate numeric(18, 6) not null default 0,
  sell_rate numeric(18, 6) not null default 0,
  manual_override boolean not null default false,
  last_synced_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.deposit_addresses (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  type text not null,
  label text,
  account_info text not null,
  account_holder text,
  currency text not null,
  country text,
  network text,
  instructions text,
  accent_color text default '#D4AF37',
  icon text,
  card_style text default 'standard',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  emoji text default '📢',
  cta_text text,
  cta_url text,
  "order" integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ticker_messages (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  emoji text default '⚡',
  "order" integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.about_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  intro text,
  vision text,
  services text,
  "values" text,
  location text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.support_links (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  label text not null,
  url text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_type text not null check (thread_type in ('deposit', 'transfer', 'support')),
  thread_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'admin')),
  text text not null default '',
  attachment_uri text,
  attachment_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referrer_name text,
  referrer_code text,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  referred_name text,
  referred_username text,
  referred_email text,
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'void')),
  reward_amount numeric(18, 2) not null default 0,
  first_transfer_id uuid references public.transfer_requests(id),
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

create table if not exists public.referral_settings (
  id uuid primary key default gen_random_uuid(),
  commission_type text not null default 'percent' check (commission_type in ('percent', 'fixed')),
  commission_value numeric(18, 4) not null default 20,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists referral_settings_single_active_idx
  on public.referral_settings (active) where active;
create index if not exists deposit_requests_user_created_idx on public.deposit_requests (user_id, created_at desc);
create index if not exists transfer_requests_user_created_idx on public.transfer_requests (user_id, created_at desc);
create index if not exists chat_messages_thread_created_idx on public.chat_messages (thread_type, thread_id, created_at);
create index if not exists referrals_referrer_created_idx on public.referrals (referrer_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.transfer_requests enable row level security;
alter table public.currencies enable row level security;
alter table public.deposit_addresses enable row level security;
alter table public.announcements enable row level security;
alter table public.ticker_messages enable row level security;
alter table public.about_content enable row level security;
alter table public.support_links enable row level security;
alter table public.chat_messages enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_settings enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists wallets_select_owner_or_admin on public.wallets;
create policy wallets_select_owner_or_admin on public.wallets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists wallets_admin_all on public.wallets;
create policy wallets_admin_all on public.wallets for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists deposit_requests_select_owner_or_admin on public.deposit_requests;
create policy deposit_requests_select_owner_or_admin on public.deposit_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists deposit_requests_insert_owner on public.deposit_requests;
create policy deposit_requests_insert_owner on public.deposit_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
drop policy if exists deposit_requests_admin_update on public.deposit_requests;
create policy deposit_requests_admin_update on public.deposit_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists transfer_requests_select_owner_or_admin on public.transfer_requests;
create policy transfer_requests_select_owner_or_admin on public.transfer_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists transfer_requests_insert_owner on public.transfer_requests;
create policy transfer_requests_insert_owner on public.transfer_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
drop policy if exists transfer_requests_admin_update on public.transfer_requests;
create policy transfer_requests_admin_update on public.transfer_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists currencies_public_read on public.currencies;
create policy currencies_public_read on public.currencies for select to anon, authenticated using (active or (select public.is_admin()));
drop policy if exists currencies_admin_write on public.currencies;
create policy currencies_admin_write on public.currencies for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists deposit_addresses_public_read on public.deposit_addresses;
create policy deposit_addresses_public_read on public.deposit_addresses for select to anon, authenticated using (active or (select public.is_admin()));
drop policy if exists deposit_addresses_admin_write on public.deposit_addresses;
create policy deposit_addresses_admin_write on public.deposit_addresses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements for select to anon, authenticated using (active or (select public.is_admin()));
drop policy if exists announcements_admin_write on public.announcements;
create policy announcements_admin_write on public.announcements for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists ticker_messages_public_read on public.ticker_messages;
create policy ticker_messages_public_read on public.ticker_messages for select to anon, authenticated using (active or (select public.is_admin()));
drop policy if exists ticker_messages_admin_write on public.ticker_messages;
create policy ticker_messages_admin_write on public.ticker_messages for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists about_content_public_read on public.about_content;
create policy about_content_public_read on public.about_content for select to anon, authenticated using (active or (select public.is_admin()));
drop policy if exists about_content_admin_write on public.about_content;
create policy about_content_admin_write on public.about_content for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists support_links_public_read on public.support_links;
create policy support_links_public_read on public.support_links for select to anon, authenticated using (active or (select public.is_admin()));
drop policy if exists support_links_admin_write on public.support_links;
create policy support_links_admin_write on public.support_links for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists chat_messages_select_participants on public.chat_messages;
create policy chat_messages_select_participants on public.chat_messages for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists chat_messages_insert_participants on public.chat_messages;
create policy chat_messages_insert_participants on public.chat_messages for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and sender_role = 'user' and not (select public.is_admin()))
    or ((select public.is_admin()) and sender_role = 'admin')
  );
drop policy if exists chat_messages_admin_update on public.chat_messages;
create policy chat_messages_admin_update on public.chat_messages for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists referrals_select_participant_or_admin on public.referrals;
create policy referrals_select_participant_or_admin on public.referrals for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists referrals_insert_referred_or_admin on public.referrals;
drop policy if exists referrals_admin_insert on public.referrals;
create policy referrals_admin_insert on public.referrals for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists referrals_admin_update on public.referrals;
create policy referrals_admin_update on public.referrals for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists referral_settings_public_read on public.referral_settings;
create policy referral_settings_public_read on public.referral_settings for select to anon, authenticated
  using (active or (select public.is_admin()));
drop policy if exists referral_settings_admin_write on public.referral_settings;
create policy referral_settings_admin_write on public.referral_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

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
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into deposit_record from public.deposit_requests where id = p_deposit_id for update;
  if not found then raise exception 'Deposit request not found'; end if;
  if deposit_record.status <> 'pending' then raise exception 'Deposit request is no longer pending'; end if;

  insert into public.wallets (user_id, balance)
  values (deposit_record.user_id, deposit_record.amount)
  on conflict (user_id) do update
    set balance = public.wallets.balance + excluded.balance;

  update public.deposit_requests
  set status = 'approved', credited_amount = deposit_record.amount, admin_notes = 'Crédité'
  where id = p_deposit_id;
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
    app_fee := transfer_record.amount * coalesce(currency_record.fee_percent, 5) / 100;
  end if;
  if settings_record.commission_type = 'percent' then
    reward := app_fee * settings_record.commission_value / 100;
  else
    reward := settings_record.commission_value;
  end if;
  if reward <= 0 then return jsonb_build_object('rewarded', false, 'reason', 'zero_reward', 'appFeeUsd', app_fee); end if;

  insert into public.wallets (user_id, balance) values (referred_profile.referred_by, reward)
  on conflict (user_id) do update set balance = public.wallets.balance + excluded.balance;
  update public.referrals
  set status = 'rewarded', reward_amount = reward, first_transfer_id = p_transfer_id
  where id = referral_record.id;
  return jsonb_build_object('rewarded', true, 'reward', reward, 'appFeeUsd', app_fee);
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

  update public.wallets
  set balance = balance - transfer_record.amount
  where user_id = transfer_record.user_id and balance >= transfer_record.amount;
  if not found then raise exception 'Insufficient wallet balance'; end if;

  update public.transfer_requests
  set status = 'completed', receipt_uri = p_receipt_uri
  where id = p_transfer_id;
  perform public.process_referral_reward(p_transfer_id);
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.currencies, public.deposit_addresses, public.announcements,
  public.ticker_messages, public.about_content, public.support_links,
  public.referral_settings to anon;

revoke all on function public.set_referral_code(text) from public, anon;
revoke all on function public.apply_referral_code(text) from public, anon;
revoke all on function public.approve_deposit(uuid) from public, anon;
revoke all on function public.complete_transfer(uuid, text) from public, anon;
revoke all on function public.process_referral_reward(uuid) from public, anon;
grant execute on function public.set_referral_code(text) to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.approve_deposit(uuid) to authenticated;
grant execute on function public.complete_transfer(uuid, text) to authenticated;
grant execute on function public.process_referral_reward(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('private-files', 'private-files', false)
on conflict (id) do nothing;

create or replace function public.can_read_private_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (storage.foldername(p_path))[1] = (select auth.uid())::text
    or (select public.is_admin())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.id_document_uri = p_path)
    or exists (select 1 from public.deposit_requests d where d.user_id = (select auth.uid()) and d.receipt_uri = p_path)
    or exists (select 1 from public.transfer_requests t where t.user_id = (select auth.uid()) and t.receipt_uri = p_path)
    or exists (select 1 from public.chat_messages m where m.user_id = (select auth.uid()) and m.attachment_uri = p_path);
$$;

drop policy if exists private_files_read_owner_or_admin on storage.objects;
create policy private_files_read_owner_or_admin on storage.objects for select to authenticated
  using (bucket_id = 'private-files' and public.can_read_private_file(name));
drop policy if exists private_files_insert_owner on storage.objects;
create policy private_files_insert_owner on storage.objects for insert to authenticated
  with check (bucket_id = 'private-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists private_files_delete_owner_or_admin on storage.objects;
create policy private_files_delete_owner_or_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'private-files'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then
  null;
end;
$$;
