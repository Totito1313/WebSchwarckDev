-- Ajustes de los avisos del portal, en Vault.
--
-- · portal_hook_secret: lo crea la base aquí mismo y no sale de ella; la base lo manda en
--   cada llamada a la función `portal` y la función lo comprueba.
-- · portal_hook_url: la dirección de la función.
-- · portal_vapid_public y portal_vapid_private: las crea la función la primera vez que hace
--   falta y las guarda con portal_store_setting (solo si faltan, para no romper las
--   suscripciones ya hechas).

create or replace function public.portal_store_setting(setting text, value text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if setting not in ('portal_vapid_public', 'portal_vapid_private') then
    raise exception 'Ajuste no permitido.';
  end if;
  if exists (select 1 from vault.secrets where name = setting) then
    return;
  end if;
  perform vault.create_secret(value, setting);
end $$;
revoke all on function public.portal_store_setting(text, text) from public, anon, authenticated;
grant execute on function public.portal_store_setting(text, text) to service_role;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'portal_hook_secret');
select vault.create_secret('https://zblcnysojrogwbflived.supabase.co/functions/v1/portal', 'portal_hook_url');
