-- Lets the platform admin rename a business on a customer's behalf (e.g. a
-- support request to correct/change their trading name). Not exposed to
-- business owners themselves.
create or replace function public.admin_rename_organization(p_org_id uuid, p_name text) returns organizations
language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype; v_name text;
begin
  if not is_platform_admin() then raise exception 'Not authorized'; end if;

  v_name := trim(p_name);
  if v_name = '' then raise exception 'Name cannot be empty'; end if;

  update organizations set name = v_name where id = p_org_id returning * into v_org;
  if v_org.id is null then raise exception 'Organization not found'; end if;
  return v_org;
end; $$;
