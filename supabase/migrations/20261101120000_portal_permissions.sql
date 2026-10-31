-- Portal v4: permisos por cliente y por persona, varias redes por publicación, campos según
-- el formato, rechazar, ideas y anuncios del cliente, notas del reporte diario, plantillas
-- y el conector de Claude.
--
-- Permisos. Cada portal dice qué permite (portal_clients.perms) y cada persona puede tener
-- excepciones (portal_members.perms). Sin excepción, manda el rol: «Solo lectura» solo ve,
-- «Equipo» hace todo menos editar el negocio y «Dueño» todo, siempre dentro de lo que el
-- portal permite. Lo que nadie tocó toma el valor de private.perm_default: ver, aprobar,
-- rechazar, comentar, entregar peticiones, enviar y editar el negocio, sí; crear, no.
--
--   timeline.view  report.view  content.view  metrics.view  leads.view  resources.view  tasks.view
--   content.approve  content.reject  content.propose   posts.create   tasks.submit
--   resources.upload   leads.add  leads.edit   comment  send  business.edit
--
-- Las secciones ocultas de antes (hidden) siguen valiendo como «no ve»; Negocio ya guarda
-- todo en perms y las deja vacías.

-- ── Permisos ──

create or replace function private.perms_ok(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object' and coalesce((select bool_and(jsonb_typeof(v) = 'boolean') from jsonb_each(j) as e(k, v)), true);
$$;

alter table public.portal_clients add column perms jsonb not null default '{}'::jsonb check (private.perms_ok(perms));
alter table public.portal_members add column perms jsonb not null default '{}'::jsonb check (private.perms_ok(perms));

create or replace function private.perm_section(k text) returns text
language sql immutable set search_path = '' as $$
  select case k
    when 'timeline.view' then 'cronologia' when 'report.view' then 'reporte' when 'content.view' then 'calendario'
    when 'metrics.view' then 'rendimiento' when 'leads.view' then 'leads' when 'resources.view' then 'recursos'
    when 'tasks.view' then 'peticiones' when 'send' then 'enviar'
  end;
$$;

create or replace function private.role_allows(r text, k text) returns boolean
language sql immutable set search_path = '' as $$
  select case r when 'owner' then true when 'member' then k <> 'business.edit' else k like '%.view' end;
$$;

create or replace function private.perm_default(k text) returns boolean
language sql immutable set search_path = '' as $$
  select k like '%.view' or k in ('content.approve', 'content.reject', 'comment', 'tasks.submit', 'send', 'business.edit');
$$;

create or replace function private.perm(c uuid, k text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin() or coalesce((
    select case
      when private.perm_section(k) is not null and (p.hidden ? private.perm_section(k) or m.hidden ? private.perm_section(k)) then false
      when m.perms ? k then (m.perms ->> k)::boolean
      else private.role_allows(m.role, k) and coalesce((p.perms ->> k)::boolean, private.perm_default(k))
    end
    from public.portal_members m
    join public.portal_clients p on p.id = m.client_id
    where m.client_id = c and m.user_id = (select auth.uid()) and not p.archived
  ), false);
$$;
grant execute on function private.perm(uuid, text) to authenticated;

-- Un portal archivado deja de verse para su gente (antes solo lo escondía la app).
create or replace function private.is_member(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portal_members m join public.portal_clients p on p.id = m.client_id
    where m.client_id = c and m.user_id = (select auth.uid()) and not p.archived
  );
$$;

-- Las funciones de antes, ahora sobre los permisos (por si algo más las usa).
create or replace function private.can_see(c uuid, section text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.perm(c, case section
    when 'cronologia' then 'timeline.view' when 'reporte' then 'report.view' when 'calendario' then 'content.view'
    when 'rendimiento' then 'metrics.view' when 'leads' then 'leads.view' when 'recursos' then 'resources.view'
    when 'peticiones' then 'tasks.view' when 'enviar' then 'send' else section end);
$$;
create or replace function private.can_act(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.perm(c, 'comment');
$$;
create or replace function private.is_owner(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.perm(c, 'business.edit');
$$;

-- ── Publicaciones: varias redes, campos según el formato, rechazar e ideas del cliente ──

alter table public.portal_content
  add column channels text[] not null default '{}' check (channels <@ array['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'web', 'email', 'otro']::text[]),
  add column production jsonb not null default '{}'::jsonb check (jsonb_typeof(production) = 'object' and pg_column_size(production) < 60000),
  add column origin text not null default 'studio' check (origin in ('studio', 'client', 'claude')),
  add column created_by uuid default auth.uid() references auth.users (id) on delete set null,
  add column client_verdict_by uuid references auth.users (id) on delete set null,
  add column client_verdict_name text check (char_length(client_verdict_name) <= 120);
update public.portal_content set channels = array[channel] where cardinality(channels) = 0;
alter table public.portal_content drop constraint if exists portal_content_client_verdict_check;
alter table public.portal_content add constraint portal_content_client_verdict_check check (client_verdict in ('approved', 'changes', 'rejected'));
create index portal_content_created_by_idx on public.portal_content (created_by);
create index portal_content_verdict_by_idx on public.portal_content (client_verdict_by);

-- La primera red es la principal (channel): así lo de antes sigue funcionando.
create or replace function public.portal_content_channels() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.channels is null or cardinality(new.channels) = 0 then
    new.channels := array[new.channel];
  else
    new.channel := new.channels[1];
  end if;
  return new;
end $$;
create trigger portal_content_channels before insert or update on public.portal_content for each row execute function public.portal_content_channels();

-- Aprobar o pedir cambios, solo lo que está para revisar; rechazar, hasta que se programa.
-- Queda quién lo hizo.
create or replace function public.portal_verdict_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and not private.is_admin() then
    if new.client_verdict is distinct from old.client_verdict then
      if new.client_verdict in ('approved', 'changes') and (old.status <> 'review' or not private.perm(new.client_id, 'content.approve')) then
        raise exception 'Solo se aprueba o se piden cambios en lo que está para revisar.' using errcode = '42501';
      end if;
      if new.client_verdict = 'rejected' and (old.status in ('scheduled', 'published') or not private.perm(new.client_id, 'content.reject')) then
        raise exception 'Esta publicación ya no se puede rechazar.' using errcode = '42501';
      end if;
      if new.client_verdict is null and not (private.perm(new.client_id, 'content.approve') or private.perm(new.client_id, 'content.reject')) then
        raise exception 'No puedes cambiar eso.' using errcode = '42501';
      end if;
    end if;
    new.client_verdict_at := case when new.client_verdict is null then null else now() end;
    new.client_verdict_by := case when new.client_verdict is null then null else auth.uid() end;
    new.client_verdict_name := case when new.client_verdict is null then null else (
      select coalesce(nullif(m.name, ''), m.email) from public.portal_members m where m.client_id = new.client_id and m.user_id = auth.uid()
    ) end;
  end if;
  return new;
end $$;
-- (portal_content_cols, que deja al cliente tocar solo su respuesta, se dispara antes que
-- este: quién y cuándo los pone aquí la base, no el cliente.)

-- ── Lo que crea el cliente: ideas, anuncios, recursos y leads ──

alter table public.portal_posts
  add column origin text not null default 'studio' check (origin in ('studio', 'client')),
  add column created_by uuid default auth.uid() references auth.users (id) on delete set null,
  add column author text check (char_length(author) <= 120);
alter table public.portal_resources
  add column origin text not null default 'studio' check (origin in ('studio', 'client')),
  add column created_by uuid default auth.uid() references auth.users (id) on delete set null;
alter table public.portal_leads
  add column origin text not null default 'studio' check (origin in ('studio', 'client')),
  add column created_by uuid default auth.uid() references auth.users (id) on delete set null;
create index portal_posts_created_by_idx on public.portal_posts (created_by);
create index portal_resources_created_by_idx on public.portal_resources (created_by);
create index portal_leads_created_by_idx on public.portal_leads (created_by);

-- Lo que manda el cliente siempre queda como suyo y en su sitio: una idea entra como idea,
-- un anuncio como anuncio y sin fijar.
-- Sin «security definer»: dentro de una así, current_user es el dueño y nunca 'authenticated'.
create or replace function private.portal_client_insert() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated' and not private.is_admin() then
    new.created_by := auth.uid();
    new.origin := 'client';
    if tg_table_name = 'portal_content' then
      new.status := 'idea';
      new.client_verdict := null;
      new.client_note := null;
      new.client_verdict_at := null;
    elsif tg_table_name = 'portal_posts' then
      new.kind := 'announcement';
      new.pinned := false;
      new.occurred_at := now();
      new.author := (select coalesce(nullif(m.name, ''), m.email) from public.portal_members m where m.client_id = new.client_id and m.user_id = auth.uid());
    end if;
  end if;
  return new;
end $$;
create trigger portal_content_client before insert on public.portal_content for each row execute function private.portal_client_insert();
create trigger portal_posts_client before insert on public.portal_posts for each row execute function private.portal_client_insert();
create trigger portal_resources_client before insert on public.portal_resources for each row execute function private.portal_client_insert();
create trigger portal_leads_client before insert on public.portal_leads for each row execute function private.portal_client_insert();

-- El cliente edita de un lead lo que es del lead, no de quién es ni de dónde vino.
create trigger portal_leads_cols before update on public.portal_leads for each row
  execute function private.portal_guard_columns('name', 'contact', 'source', 'stage', 'value', 'date', 'campaign', 'notes', 'updated_at');
create trigger portal_leads_hook after insert on public.portal_leads for each row execute function private.portal_hook();

-- ── Las reglas, ahora con permisos ──

alter policy "Miembros editan su negocio" on public.portal_clients
  using ((select private.perm(id, 'business.edit'))) with check ((select private.perm(id, 'business.edit')));
alter policy "Miembros leen el trabajo" on public.portal_work using ((select private.perm(client_id, 'report.view')));
alter policy "Miembros leen el rendimiento" on public.portal_metrics using ((select private.perm(client_id, 'metrics.view')));
alter policy "Miembros leen sus leads" on public.portal_leads using ((select private.perm(client_id, 'leads.view')));
alter policy "Miembros leen los recursos" on public.portal_resources using ((select private.perm(client_id, 'resources.view')));
alter policy "Miembros leen sus tareas" on public.portal_tasks using ((select private.perm(client_id, 'tasks.view')));
alter policy "Miembros marcan sus tareas" on public.portal_tasks
  using ((select private.perm(client_id, 'tasks.submit'))) with check ((select private.perm(client_id, 'tasks.submit')));
alter policy "Miembros leen el calendario" on public.portal_content using ((select private.perm(client_id, 'content.view')));
alter policy "Miembros aprueban el contenido" on public.portal_content
  using ((select private.perm(client_id, 'content.view')) and ((select private.perm(client_id, 'content.approve')) or (select private.perm(client_id, 'content.reject'))))
  with check ((select private.perm(client_id, 'content.view')) and ((select private.perm(client_id, 'content.approve')) or (select private.perm(client_id, 'content.reject'))));
alter policy "Miembros comentan" on public.portal_comments
  with check ((select private.perm(client_id, 'comment')) and user_id = (select auth.uid()) and from_studio = false);
alter policy "Miembros envían" on public.portal_submissions
  with check (
    (select private.perm(client_id, case when task_id is null then 'send' else 'tasks.submit' end))
    and user_id = (select auth.uid())
    and (task_id is null or exists (select 1 from public.portal_tasks t where t.id = task_id and t.client_id = portal_submissions.client_id))
    and (storage_path is null or storage_path like client_id::text || '/entregas/' || (select auth.uid())::text || '/%')
  );

create policy "Miembros proponen ideas" on public.portal_content for insert to authenticated
  with check ((select private.perm(client_id, 'content.propose')));
create policy "Cada quien retira su idea" on public.portal_content for delete to authenticated
  using (origin = 'client' and created_by = (select auth.uid()) and status = 'idea');
create policy "Miembros anuncian" on public.portal_posts for insert to authenticated
  with check ((select private.perm(client_id, 'posts.create')));
create policy "Cada quien borra su anuncio" on public.portal_posts for delete to authenticated
  using (origin = 'client' and created_by = (select auth.uid()));
create policy "Miembros suben recursos" on public.portal_resources for insert to authenticated
  with check (
    (select private.perm(client_id, 'resources.upload'))
    and (storage_path is null or storage_path like client_id::text || '/recursos/' || (select auth.uid())::text || '/%')
  );
create policy "Cada quien borra su recurso" on public.portal_resources for delete to authenticated
  using (origin = 'client' and created_by = (select auth.uid()));
create policy "Miembros añaden leads" on public.portal_leads for insert to authenticated
  with check ((select private.perm(client_id, 'leads.add')));
create policy "Miembros editan leads" on public.portal_leads for update to authenticated
  using ((select private.perm(client_id, 'leads.edit'))) with check ((select private.perm(client_id, 'leads.edit')));

-- Archivos: además de sus entregas y su perfil, los recursos si se lo permiten.
alter policy "Miembros suben sus entregas" on storage.objects
  with check (
    bucket_id = 'portal'
    and (select private.member_of_path(name))
    and (storage.foldername(name))[3] = (select auth.uid())::text
    and (
      (storage.foldername(name))[2] = any (array['entregas', 'perfil'])
      or ((storage.foldername(name))[2] = 'recursos' and (select private.perm(split_part(name, '/', 1)::uuid, 'resources.upload')))
    )
  );

-- Pasar los ocultos de antes a permisos (siguen valiendo en perm() mientras existan).
with map(section, k) as (values
  ('cronologia', 'timeline.view'), ('reporte', 'report.view'), ('calendario', 'content.view'), ('rendimiento', 'metrics.view'),
  ('leads', 'leads.view'), ('recursos', 'resources.view'), ('peticiones', 'tasks.view'), ('enviar', 'send'))
update public.portal_clients p set perms = p.perms || coalesce((select jsonb_object_agg(map.k, false) from map where p.hidden ? map.section), '{}'::jsonb)
where jsonb_array_length(p.hidden) > 0;
with map(section, k) as (values
  ('cronologia', 'timeline.view'), ('reporte', 'report.view'), ('calendario', 'content.view'), ('rendimiento', 'metrics.view'),
  ('leads', 'leads.view'), ('recursos', 'resources.view'), ('peticiones', 'tasks.view'), ('enviar', 'send'))
update public.portal_members m set perms = m.perms || coalesce((select jsonb_object_agg(map.k, false) from map where m.hidden ? map.section), '{}'::jsonb)
where jsonb_array_length(m.hidden) > 0;

-- ── El reporte del día: quién lo manda, a qué hora, bloqueos y observaciones ──

create table public.portal_reports (
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  day date not null,
  author text check (char_length(author) <= 120),
  sent_at time,
  blockers text check (char_length(blockers) <= 4000),
  notes text check (char_length(notes) <= 4000),
  source text check (char_length(source) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id, day)
);
alter table public.portal_reports enable row level security;
grant select, insert, update, delete on public.portal_reports to authenticated;
grant all on public.portal_reports to service_role;
create policy "Estudio: todo" on public.portal_reports for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Miembros leen el reporte" on public.portal_reports for select to authenticated using ((select private.perm(client_id, 'report.view')));
create trigger portal_reports_touch before update on public.portal_reports for each row execute function public.portal_touch();
alter publication supabase_realtime add table public.portal_reports;

-- ── Plantillas del estudio (publicaciones y peticiones), para todos los portales ──

create table public.portal_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('content', 'task')),
  name text not null check (char_length(name) between 1 and 120),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 60000),
  created_at timestamptz not null default now()
);
alter table public.portal_templates enable row level security;
grant select, insert, update, delete on public.portal_templates to authenticated;
grant all on public.portal_templates to service_role;
create policy "Estudio: todo" on public.portal_templates for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- ── El conector de Claude: una dirección secreta por portal ──
-- Solo se guarda la huella del secreto. Lo usa la función portal-mcp (con la clave de servicio).

create table private.portal_mcp_keys (
  client_id uuid primary key references public.portal_clients (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create or replace function public.portal_mcp_issue(c uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  t text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
begin
  insert into private.portal_mcp_keys (client_id, token_hash) values (c, encode(extensions.digest(t, 'sha256'), 'hex'))
  on conflict (client_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
  return t;
end $$;

create or replace function public.portal_mcp_client(token text) returns uuid
language sql security definer set search_path = '' as $$
  update private.portal_mcp_keys set last_used_at = now()
  where token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
  returning client_id;
$$;

create or replace function public.portal_mcp_status(c uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('active', true, 'created_at', k.created_at, 'last_used_at', k.last_used_at)
  from private.portal_mcp_keys k where k.client_id = c;
$$;

create or replace function public.portal_mcp_revoke(c uuid) returns void
language sql security definer set search_path = '' as $$
  delete from private.portal_mcp_keys where client_id = c;
$$;

revoke all on function public.portal_mcp_issue(uuid), public.portal_mcp_client(text), public.portal_mcp_status(uuid), public.portal_mcp_revoke(uuid) from public, anon, authenticated;
grant execute on function public.portal_mcp_issue(uuid), public.portal_mcp_client(text), public.portal_mcp_status(uuid), public.portal_mcp_revoke(uuid) to service_role;

-- Las funciones del servidor (portal y portal-mcp) escriben con la clave de servicio y los
-- guardianes de las tablas llaman a funciones de private: necesitan poder usarlas. La clave
-- de servicio ya se salta todas las reglas, así que esto no le da nada nuevo.
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
alter default privileges in schema private grant execute on functions to service_role;
