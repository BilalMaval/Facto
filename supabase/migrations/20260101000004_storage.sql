insert into storage.buckets (id, name, public) values ('worker-photos', 'worker-photos', false)
on conflict do nothing;

-- path convention: worker-photos/{organization_id}/{worker_id}/{filename}
create policy worker_photos_select on storage.objects for select
  using (bucket_id = 'worker-photos' and is_org_member((storage.foldername(name))[1]::uuid));
create policy worker_photos_write on storage.objects for insert
  with check (bucket_id = 'worker-photos' and has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']));
create policy worker_photos_update on storage.objects for update
  using (bucket_id = 'worker-photos' and has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']));
create policy worker_photos_delete on storage.objects for delete
  using (bucket_id = 'worker-photos' and has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']));
