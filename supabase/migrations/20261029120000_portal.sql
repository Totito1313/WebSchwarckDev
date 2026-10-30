-- Portal de clientes: lo que cada cliente ve en /cliente/ (la app que instala en su teléfono).
--
-- Quién entra:
--   · El estudio (tú) nunca entra con Supabase Auth: el panel habla con el Worker,
--     que usa la clave secreta (se salta RLS) solo tras comprobar la sesión del panel.
--   · Cada cliente es un usuario de Supabase Auth (correo y contraseña que crea el panel)
--     y solo ve lo de los portales donde figura en portal_members.
--
-- Qué guarda:
--   portal_clients      un portal por cliente (enlazado a su ficha de Negocio)
--   portal_members      quién entra en cada portal
--   portal_posts        el tablón (anuncios) y la cronología (lo que hiciste)
--   portal_content      el calendario de contenido; el cliente lo aprueba o pide cambios
--   portal_resources    recursos: archivos, enlaces, vídeos, guías
--   portal_tasks        lo que le pides al cliente; él lo marca como enviado
--   portal_submissions  lo que el cliente te manda: mensajes, enlaces, archivos y vídeos
--   portal_push         suscripciones a notificaciones (de clientes y del estudio)
--
-- Archivos: el depósito privado `portal`, con una carpeta por cliente (<client_id>/...).
-- El cliente solo puede subir a <client_id>/entregas/<su id>/...

-- ── Tablas ──

create table public.portal_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  crm_customer_id text,
  accent text not null default '#00b8d4' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text,
  welcome text check (char_length(welcome) <= 2000),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.portal_members (
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  name text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index portal_members_user_idx on public.portal_members (user_id);

create table public.portal_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  kind text not null default 'update' check (kind in ('announcement', 'update', 'milestone', 'delivery', 'report')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 20000),
  link text check (link is null or link ~ '^https?://'),
  attachments jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index portal_posts_client_idx on public.portal_posts (client_id, occurred_at desc);

create table public.portal_content (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  date date not null,
  time time,
  channel text not null default 'instagram' check (channel in ('instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'web', 'email', 'otro')),
  format text not null default 'post' check (format in ('post', 'carrusel', 'reel', 'historia', 'video', 'articulo', 'otro')),
  status text not null default 'idea' check (status in ('idea', 'production', 'review', 'approved', 'scheduled', 'published')),
  caption text check (char_length(caption) <= 5000),
  notes text check (char_length(notes) <= 5000),
  image_url text,
  link text check (link is null or link ~ '^https?://'),
  client_verdict text check (client_verdict in ('approved', 'changes')),
  client_note text check (char_length(client_note) <= 2000),
  client_verdict_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portal_content_client_idx on public.portal_content (client_id, date);

create table public.portal_resources (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'link' check (kind in ('file', 'link', 'video', 'doc', 'image')),
  category text check (char_length(category) <= 60),
  description text check (char_length(description) <= 2000),
  url text check (url is null or url ~ '^https?://'),
  storage_path text,
  file_name text,
  size bigint,
  mime text,
  created_at timestamptz not null default now()
);
create index portal_resources_client_idx on public.portal_resources (client_id, created_at desc);

create table public.portal_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  due_date date,
  expects text not null default 'any' check (expects in ('any', 'file', 'link', 'text', 'none')),
  -- pending: se lo pediste · submitted: el cliente dice que ya lo mandó · done: lo diste por bueno
  status text not null default 'pending' check (status in ('pending', 'submitted', 'done')),
  client_note text check (char_length(client_note) <= 2000),
  submitted_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portal_tasks_client_idx on public.portal_tasks (client_id, status);

create table public.portal_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  task_id uuid references public.portal_tasks (id) on delete set null,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  author text check (char_length(author) <= 120),
  kind text not null check (kind in ('message', 'link', 'file', 'video')),
  body text check (char_length(body) <= 10000),
  url text check (url is null or url ~ '^https?://'),
  storage_path text,
  file_name text,
  size bigint,
  mime text,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index portal_submissions_client_idx on public.portal_submissions (client_id, created_at desc);
create index portal_submissions_task_idx on public.portal_submissions (task_id);
create index portal_submissions_unseen_idx on public.portal_submissions (created_at) where seen_at is null;

create table public.portal_push (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users (id) on delete cascade,
  client_id uuid references public.portal_clients (id) on delete cascade,
  is_admin boolean not null default false,
  ua text,
  created_at timestamptz not null default now()
);
create index portal_push_client_idx on public.portal_push (client_id);
create index portal_push_user_idx on public.portal_push (user_id);
create index portal_submissions_user_idx on public.portal_submissions (user_id);

-- updated_at al día
create or replace function public.portal_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger portal_content_touch before update on public.portal_content for each row execute function public.portal_touch();
create trigger portal_tasks_touch before update on public.portal_tasks for each row execute function public.portal_touch();

-- El cliente solo puede llevar una tarea de «pendiente» a «enviada» (o deshacerlo):
-- darla por buena es cosa del estudio. Las fechas las pone la base, no el teléfono.
create or replace function public.portal_task_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if new.status not in ('pending', 'submitted') or old.status = 'done' then
      raise exception 'Esta tarea ya no se puede cambiar.';
    end if;
    if new.status is distinct from old.status then
      new.submitted_at := case when new.status = 'submitted' then now() else null end;
    end if;
  end if;
  return new;
end $$;
create trigger portal_tasks_guard before update on public.portal_tasks for each row execute function public.portal_task_guard();

create or replace function public.portal_verdict_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    new.client_verdict_at := case when new.client_verdict is null then null else now() end;
  end if;
  return new;
end $$;
create trigger portal_content_verdict before update on public.portal_content for each row execute function public.portal_verdict_guard();

-- ── Quién es miembro (fuera del esquema expuesto) ──

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_member(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portal_members m
    where m.client_id = c and m.user_id = (select auth.uid())
  );
$$;

-- Para el almacén: la primera carpeta del archivo es el id del portal.
create or replace function private.member_of_path(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.is_member(split_part(object_name, '/', 1)::uuid)
    else false
  end;
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.member_of_path(text) from public;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.member_of_path(text) to authenticated;

-- ── Permisos: nada para anon; el cliente lee lo suyo y toca solo unas columnas ──

alter table public.portal_clients enable row level security;
alter table public.portal_members enable row level security;
alter table public.portal_posts enable row level security;
alter table public.portal_content enable row level security;
alter table public.portal_resources enable row level security;
alter table public.portal_tasks enable row level security;
alter table public.portal_submissions enable row level security;
alter table public.portal_push enable row level security;

revoke all on public.portal_clients, public.portal_members, public.portal_posts, public.portal_content,
  public.portal_resources, public.portal_tasks, public.portal_submissions, public.portal_push from anon, authenticated;
grant all on public.portal_clients, public.portal_members, public.portal_posts, public.portal_content,
  public.portal_resources, public.portal_tasks, public.portal_submissions, public.portal_push to service_role;

grant select on public.portal_clients, public.portal_members, public.portal_posts, public.portal_content,
  public.portal_resources, public.portal_tasks, public.portal_submissions to authenticated;
grant update (last_seen_at) on public.portal_members to authenticated;
grant update (status, client_note) on public.portal_tasks to authenticated;
grant update (client_verdict, client_note) on public.portal_content to authenticated;
grant insert (client_id, task_id, author, kind, body, url, storage_path, file_name, size, mime) on public.portal_submissions to authenticated;
grant delete on public.portal_submissions to authenticated;
grant select, insert, delete on public.portal_push to authenticated;

create policy "Miembros ven su portal" on public.portal_clients
  for select to authenticated using ((select private.is_member(id)));

create policy "Cada quien ve su membresía" on public.portal_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Cada quien marca lo que ya vio" on public.portal_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Miembros leen el tablón" on public.portal_posts
  for select to authenticated using ((select private.is_member(client_id)));

create policy "Miembros leen el calendario" on public.portal_content
  for select to authenticated using ((select private.is_member(client_id)));
create policy "Miembros aprueban el contenido" on public.portal_content
  for update to authenticated using ((select private.is_member(client_id))) with check ((select private.is_member(client_id)));

create policy "Miembros leen los recursos" on public.portal_resources
  for select to authenticated using ((select private.is_member(client_id)));

create policy "Miembros leen sus tareas" on public.portal_tasks
  for select to authenticated using ((select private.is_member(client_id)));
create policy "Miembros marcan sus tareas" on public.portal_tasks
  for update to authenticated using ((select private.is_member(client_id))) with check ((select private.is_member(client_id)));

create policy "Miembros leen lo enviado" on public.portal_submissions
  for select to authenticated using ((select private.is_member(client_id)));
create policy "Miembros envían" on public.portal_submissions
  for insert to authenticated with check (
    (select private.is_member(client_id))
    and user_id = (select auth.uid())
    and (task_id is null or exists (select 1 from public.portal_tasks t where t.id = task_id and t.client_id = portal_submissions.client_id))
    and (storage_path is null or storage_path like client_id::text || '/entregas/' || (select auth.uid())::text || '/%')
  );
create policy "Cada quien borra lo suyo sin ver" on public.portal_submissions
  for delete to authenticated using (user_id = (select auth.uid()) and seen_at is null);

create policy "Cada quien ve sus avisos" on public.portal_push
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Cada quien se suscribe" on public.portal_push
  for insert to authenticated with check (user_id = (select auth.uid()) and is_admin = false and (select private.is_member(client_id)));
create policy "Cada quien se da de baja" on public.portal_push
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── Archivos ──

insert into storage.buckets (id, name, public, file_size_limit)
values ('portal', 'portal', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "Miembros leen los archivos de su portal" on storage.objects
  for select to authenticated using (bucket_id = 'portal' and (select private.member_of_path(name)));
create policy "Miembros suben sus entregas" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'portal'
    and (select private.member_of_path(name))
    and (storage.foldername(name))[2] = 'entregas'
    and (storage.foldername(name))[3] = (select auth.uid())::text
  );
create policy "Cada quien borra sus entregas" on storage.objects
  for delete to authenticated using (bucket_id = 'portal' and owner_id = (select auth.uid())::text);

-- ── Tiempo real: el teléfono se entera al momento de lo nuevo ──

alter publication supabase_realtime add table public.portal_posts, public.portal_content, public.portal_resources, public.portal_tasks;
