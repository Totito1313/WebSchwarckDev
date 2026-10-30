-- Portal de clientes, versión 3: roles, secciones visibles e identidad de marca.
--
-- · Cada persona de un portal tiene un rol: owner (dueño: todo, también editar los datos
--   del negocio), member (equipo: ve, aprueba, comenta y envía) o viewer (solo lectura).
-- · Las secciones se pueden ocultar a todo el portal (portal_clients.hidden) o a una
--   persona (portal_members.hidden). No es solo la pantalla: la base no le devuelve los
--   datos de lo que no puede ver. Secciones: cronologia, reporte, calendario, rendimiento,
--   leads, recursos, peticiones y enviar.
-- · La identidad de cada cliente (portal_clients.brand): colores, tipografía, esquinas,
--   estilo del inicio, portada, tema y nombre de la app.

alter table public.portal_members
  add column role text not null default 'member' check (role in ('owner', 'member', 'viewer')),
  add column hidden jsonb not null default '[]'::jsonb check (jsonb_typeof(hidden) = 'array');

alter table public.portal_clients
  add column brand jsonb not null default '{}'::jsonb check (jsonb_typeof(brand) = 'object'),
  add column hidden jsonb not null default '[]'::jsonb check (jsonb_typeof(hidden) = 'array');

-- El primero de cada portal pasa a dueño.
update public.portal_members m set role = 'owner'
where m.created_at = (select min(x.created_at) from public.portal_members x where x.client_id = m.client_id);

-- ── Qué puede ver y hacer cada quien ──

create or replace function private.can_see(c uuid, section text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.portal_members m
    join public.portal_clients p on p.id = m.client_id
    where m.client_id = c
      and m.user_id = (select auth.uid())
      and not (m.hidden ? section)
      and not (p.hidden ? section)
  );
$$;

create or replace function private.can_act(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.portal_members m where m.client_id = c and m.user_id = (select auth.uid()) and m.role <> 'viewer');
$$;

create or replace function private.is_owner(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.portal_members m where m.client_id = c and m.user_id = (select auth.uid()) and m.role = 'owner');
$$;

revoke all on function private.can_see(uuid, text) from public;
revoke all on function private.can_act(uuid) from public;
revoke all on function private.is_owner(uuid) from public;
grant execute on function private.can_see(uuid, text) to authenticated;
grant execute on function private.can_act(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;

-- ── Las reglas, con roles y secciones ──

alter policy "Miembros leen el trabajo" on public.portal_work using ((select private.can_see(client_id, 'reporte')));
alter policy "Miembros leen el calendario" on public.portal_content using ((select private.can_see(client_id, 'calendario')));
alter policy "Miembros aprueban el contenido" on public.portal_content
  using ((select private.can_see(client_id, 'calendario')) and (select private.can_act(client_id)))
  with check ((select private.can_see(client_id, 'calendario')) and (select private.can_act(client_id)));
alter policy "Miembros leen el rendimiento" on public.portal_metrics using ((select private.can_see(client_id, 'rendimiento')));
alter policy "Miembros leen sus leads" on public.portal_leads using ((select private.can_see(client_id, 'leads')));
alter policy "Miembros leen los recursos" on public.portal_resources using ((select private.can_see(client_id, 'recursos')));
alter policy "Miembros leen sus tareas" on public.portal_tasks using ((select private.can_see(client_id, 'peticiones')));
alter policy "Miembros marcan sus tareas" on public.portal_tasks
  using ((select private.can_see(client_id, 'peticiones')) and (select private.can_act(client_id)))
  with check ((select private.can_see(client_id, 'peticiones')) and (select private.can_act(client_id)));
alter policy "Miembros envían" on public.portal_submissions
  with check (
    (select private.can_see(client_id, 'enviar'))
    and (select private.can_act(client_id))
    and user_id = (select auth.uid())
    and (task_id is null or exists (select 1 from public.portal_tasks t where t.id = task_id and t.client_id = portal_submissions.client_id))
    and (storage_path is null or storage_path like client_id::text || '/entregas/' || (select auth.uid())::text || '/%')
  );
alter policy "Miembros comentan" on public.portal_comments
  with check ((select private.can_act(client_id)) and user_id = (select auth.uid()) and from_studio = false);
alter policy "Miembros editan su negocio" on public.portal_clients
  using ((select private.is_owner(id))) with check ((select private.is_owner(id)));
