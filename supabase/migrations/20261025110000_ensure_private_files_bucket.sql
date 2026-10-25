insert into storage.buckets (id, name, public)
values ('private-files', 'private-files', false)
on conflict (id) do update set public = false;

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
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.id_document_uri = p_path
    )
    or exists (
      select 1 from public.deposit_requests d
      where d.user_id = (select auth.uid()) and d.receipt_uri = p_path
    )
    or exists (
      select 1 from public.transfer_requests t
      where t.user_id = (select auth.uid()) and t.receipt_uri = p_path
    )
    or exists (
      select 1 from public.chat_messages m
      where m.user_id = (select auth.uid()) and m.attachment_uri = p_path
    );
$$;

drop policy if exists private_files_read_owner_or_admin on storage.objects;
create policy private_files_read_owner_or_admin
  on storage.objects for select to authenticated
  using (bucket_id = 'private-files' and public.can_read_private_file(name));

drop policy if exists private_files_insert_owner on storage.objects;
create policy private_files_insert_owner
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'private-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists private_files_delete_owner_or_admin on storage.objects;
create policy private_files_delete_owner_or_admin
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'private-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );
