-- Portal de clientes, versión 2.
--
-- · El estudio entra en la misma app con su cuenta de Supabase (app_metadata.role = 'admin')
--   y gestiona todo desde el teléfono: las reglas le dan acceso completo.
-- · Trabajo del estudio (el reporte diario), marketing (rendimiento y leads), comentarios,
--   perfil del cliente y de su negocio, y un calendario de contenido más detallado.
-- · Los avisos push salen de la base: cada cambio que importa llama a la función `portal`
--   (pg_net), y un trabajo diario (pg_cron) recuerda las peticiones que vencen.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ── El estudio ──

create or replace function private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- ── Columnas nuevas ──

alter table public.portal_clients
  add column description text check (char_length(description) <= 2000),
  add column industry text check (char_length(industry) <= 80),
  add column website text check (char_length(website) <= 300),
  add column instagram text check (char_length(instagram) <= 120),
  add column facebook text check (char_length(facebook) <= 300),
  add column tiktok text check (char_length(tiktok) <= 120),
  add column phone text check (char_length(phone) <= 40),
  add column email text check (char_length(email) <= 200),
  add column address text check (char_length(address) <= 300),
  add column hours text check (char_length(hours) <= 300);

alter table public.portal_members
  add column phone text check (char_length(phone) <= 40),
  add column position text check (char_length(position) <= 80),
  add column avatar_path text,
  add column prefs jsonb not null default '{}'::jsonb;

alter table public.portal_posts add column notify boolean not null default true;
alter table public.portal_resources add column notify boolean not null default true;
alter table public.portal_tasks
  add column notify boolean not null default true,
  add column priority text not null default 'normal' check (priority in ('low', 'normal', 'high'));

alter table public.portal_content
  add column objective text check (char_length(objective) <= 500),
  add column pillar text check (char_length(pillar) <= 80),
  add column funnel text check (funnel in ('atraccion', 'autoridad', 'conversion', 'comunidad')),
  add column cta text check (char_length(cta) <= 200),
  add column hashtags text check (char_length(hashtags) <= 1000),
  add column script text check (char_length(script) <= 8000),
  add column duration text check (char_length(duration) <= 40),
  add column campaign text check (char_length(campaign) <= 120),
  add column assets jsonb not null default '[]'::jsonb,
  add column refs jsonb not null default '[]'::jsonb,
  add column notify boolean not null default true;

-- ── Tablas nuevas ──

-- Lo que hace el estudio: cada día forma el reporte diario de la cronología.
create table public.portal_work (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  status text not null default 'done' check (status in ('planned', 'doing', 'done')),
  day date not null default (now() at time zone 'America/Caracas')::date,
  minutes integer check (minutes between 0 and 1440),
  category text check (char_length(category) <= 60),
  link text check (link is null or link ~ '^https?://'),
  source text check (char_length(source) <= 120),
  done_at timestamptz,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portal_work_client_idx on public.portal_work (client_id, day desc);
create unique index portal_work_source_idx on public.portal_work (client_id, source) where source is not null;

-- Rendimiento del mes, en total o por red.
create table public.portal_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  channel text not null default 'total' check (channel in ('total', 'instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'web', 'google', 'email', 'otro')),
  reach integer check (reach >= 0),
  impressions integer check (impressions >= 0),
  engagement integer check (engagement >= 0),
  followers integer check (followers >= 0),
  new_followers integer,
  clicks integer check (clicks >= 0),
  leads integer check (leads >= 0),
  sales numeric(14, 2) check (sales >= 0),
  spend numeric(14, 2) check (spend >= 0),
  posts integer check (posts >= 0),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month, channel)
);

create table public.portal_leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  contact text check (char_length(contact) <= 200),
  source text not null default 'instagram' check (source in ('instagram', 'facebook', 'tiktok', 'whatsapp', 'web', 'google', 'referido', 'otro')),
  stage text not null default 'nuevo' check (stage in ('nuevo', 'contactado', 'calificado', 'propuesta', 'ganado', 'perdido')),
  value numeric(14, 2) check (value >= 0),
  date date not null default (now() at time zone 'America/Caracas')::date,
  campaign text check (char_length(campaign) <= 120),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portal_leads_client_idx on public.portal_leads (client_id, date desc);

-- Conversación sobre una publicación, una petición, un anuncio o un trabajo.
create table public.portal_comments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  target text not null check (target in ('content', 'task', 'post', 'work')),
  target_id uuid not null,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  author text check (char_length(author) <= 120),
  from_studio boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index portal_comments_target_idx on public.portal_comments (client_id, target, target_id, created_at);
create index portal_comments_user_idx on public.portal_comments (user_id);

create trigger portal_work_touch before update on public.portal_work for each row execute function public.portal_touch();
create trigger portal_metrics_touch before update on public.portal_metrics for each row execute function public.portal_touch();
create trigger portal_leads_touch before update on public.portal_leads for each row execute function public.portal_touch();

-- Un trabajo hecho guarda cuándo se hizo.
create or replace function public.portal_work_done() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.done_at := coalesce(new.done_at, now());
  elsif new.status <> 'done' then
    new.done_at := null;
  end if;
  return new;
end $$;
create trigger portal_work_done before insert or update on public.portal_work for each row execute function public.portal_work_done();

-- ── Las guardas del cliente ahora distinguen al estudio ──

create or replace function public.portal_task_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and not private.is_admin() then
    if new.status not in ('pending', 'submitted') or old.status = 'done' then
      raise exception 'Esta tarea ya no se puede cambiar.';
    end if;
    if new.status is distinct from old.status then
      new.submitted_at := case when new.status = 'submitted' then now() else null end;
    end if;
  end if;
  return new;
end $$;

create or replace function public.portal_verdict_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and not private.is_admin() then
    new.client_verdict_at := case when new.client_verdict is null then null else now() end;
  end if;
  return new;
end $$;

-- Lo que un cliente puede cambiar de cada fila (el resto, solo el estudio).
create or replace function private.portal_guard_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and not private.is_admin() then
    if (to_jsonb(new) - tg_argv) is distinct from (to_jsonb(old) - tg_argv) then
      raise exception 'No puedes cambiar eso.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.portal_guard_columns() from public;

create trigger portal_clients_cols before update on public.portal_clients for each row
  execute function private.portal_guard_columns('description', 'industry', 'website', 'instagram', 'facebook', 'tiktok', 'phone', 'email', 'address', 'hours', 'logo_url');
create trigger portal_members_cols before update on public.portal_members for each row
  execute function private.portal_guard_columns('name', 'phone', 'position', 'avatar_path', 'prefs', 'last_seen_at');
create trigger portal_tasks_cols before update on public.portal_tasks for each row
  execute function private.portal_guard_columns('status', 'client_note', 'submitted_at', 'updated_at');
create trigger portal_content_cols before update on public.portal_content for each row
  execute function private.portal_guard_columns('client_verdict', 'client_note', 'client_verdict_at', 'updated_at');

-- ── Permisos: las filas las deciden las reglas; las columnas, las guardas ──

grant select, insert, update, delete on public.portal_clients, public.portal_members, public.portal_posts, public.portal_content,
  public.portal_resources, public.portal_tasks, public.portal_submissions, public.portal_push, public.portal_work,
  public.portal_metrics, public.portal_leads, public.portal_comments to authenticated;
revoke all on public.portal_work, public.portal_metrics, public.portal_leads, public.portal_comments from anon;
grant all on public.portal_work, public.portal_metrics, public.portal_leads, public.portal_comments to service_role;

alter table public.portal_work enable row level security;
alter table public.portal_metrics enable row level security;
alter table public.portal_leads enable row level security;
alter table public.portal_comments enable row level security;

-- El estudio, todo.
create policy "Estudio: todo" on public.portal_clients for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_members for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_posts for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_content for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_resources for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_tasks for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_submissions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_push for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_work for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_metrics for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_leads for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_comments for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- El cliente: ver lo suyo, editar su perfil y el de su negocio, y conversar.
create policy "Miembros editan su negocio" on public.portal_clients
  for update to authenticated using ((select private.is_member(id))) with check ((select private.is_member(id)));
create policy "Miembros leen el trabajo" on public.portal_work
  for select to authenticated using ((select private.is_member(client_id)));
create policy "Miembros leen el rendimiento" on public.portal_metrics
  for select to authenticated using ((select private.is_member(client_id)));
create policy "Miembros leen sus leads" on public.portal_leads
  for select to authenticated using ((select private.is_member(client_id)));
create policy "Miembros leen los comentarios" on public.portal_comments
  for select to authenticated using ((select private.is_member(client_id)));
create policy "Miembros comentan" on public.portal_comments
  for insert to authenticated with check ((select private.is_member(client_id)) and user_id = (select auth.uid()) and from_studio = false);
create policy "Cada quien borra sus comentarios" on public.portal_comments
  for delete to authenticated using (user_id = (select auth.uid()));
-- Los compañeros de portal se ven entre sí (nombre y foto en los comentarios).
create policy "Miembros ven a su equipo" on public.portal_members
  for select to authenticated using ((select private.is_member(client_id)));

-- Archivos: el estudio, todo; el cliente sube también su foto de perfil y el logo de su negocio.
alter policy "Miembros suben sus entregas" on storage.objects
  with check (
    bucket_id = 'portal'
    and (select private.member_of_path(name))
    and (storage.foldername(name))[2] in ('entregas', 'perfil')
    and (storage.foldername(name))[3] = (select auth.uid())::text
  );
create policy "Estudio: archivos" on storage.objects
  for all to authenticated using (bucket_id = 'portal' and (select private.is_admin())) with check (bucket_id = 'portal' and (select private.is_admin()));

alter publication supabase_realtime add table public.portal_work, public.portal_metrics, public.portal_leads, public.portal_comments, public.portal_submissions;

-- ── Avisos ──

-- Ajustes de la función `portal` (secreto del gancho y claves VAPID), en Vault. Solo la
-- clave secreta de Supabase (la que tiene la función) puede leerlos.
create or replace function public.portal_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('portal_hook_secret', 'portal_vapid_public', 'portal_vapid_private');
$$;
revoke all on function public.portal_settings() from public, anon, authenticated;
grant execute on function public.portal_settings() to service_role;

-- Cada cambio que importa se manda a la función, que decide a quién avisar.
create or replace function private.portal_hook() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  secret text;
  target text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'portal_hook_secret';
  select decrypted_secret into target from vault.decrypted_secrets where name = 'portal_hook_url';
  if secret is null or target is null then
    return null;
  end if;
  perform net.http_post(
    url := target,
    body := jsonb_build_object(
      'action', 'event',
      'table', tg_table_name,
      'op', tg_op,
      'record', to_jsonb(new),
      'old', case when tg_op = 'UPDATE' then to_jsonb(old) end,
      'actor', case when private.is_admin() then 'studio' when auth.uid() is not null then 'client' else 'system' end,
      'actor_id', auth.uid()
    ),
    headers := jsonb_build_object('content-type', 'application/json', 'x-portal-hook', secret),
    timeout_milliseconds := 8000
  );
  return null;
end $$;
revoke all on function private.portal_hook() from public;

create trigger portal_posts_hook after insert on public.portal_posts for each row execute function private.portal_hook();
create trigger portal_resources_hook after insert on public.portal_resources for each row execute function private.portal_hook();
create trigger portal_tasks_hook after insert or update of status on public.portal_tasks for each row execute function private.portal_hook();
create trigger portal_content_hook after insert or update of status, client_verdict on public.portal_content for each row execute function private.portal_hook();
create trigger portal_work_hook after insert or update of status on public.portal_work for each row execute function private.portal_hook();
create trigger portal_submissions_hook after insert on public.portal_submissions for each row execute function private.portal_hook();
create trigger portal_comments_hook after insert on public.portal_comments for each row execute function private.portal_hook();
create trigger portal_metrics_hook after insert or update on public.portal_metrics for each row execute function private.portal_hook();

-- Cada mañana (9:00 en Venezuela) se recuerdan las peticiones que vencen hoy o mañana, o ya vencieron.
create or replace function private.portal_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare
  secret text;
  target text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'portal_hook_secret';
  select decrypted_secret into target from vault.decrypted_secrets where name = 'portal_hook_url';
  if secret is null or target is null then
    return;
  end if;
  perform net.http_post(
    url := target,
    body := jsonb_build_object('action', 'reminders'),
    headers := jsonb_build_object('content-type', 'application/json', 'x-portal-hook', secret),
    timeout_milliseconds := 20000
  );
end $$;
revoke all on function private.portal_reminders() from public;

select cron.schedule('portal-recordatorios', '0 13 * * *', 'select private.portal_reminders()');
