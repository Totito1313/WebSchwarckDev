-- Portal v5: Negocio dentro de la app del cliente, reuniones y valoraciones.
--
--   portal_projects   el proyecto de Negocio de cada cliente: etapas, avance, horas y próximas
--                     entregas. Lo escribe Negocio (con la cuenta del estudio); el cliente lo lee.
--   portal_documents  facturas, cotizaciones, propuestas y recibos publicados en su portal, con
--                     su estado y el enlace para pagar o firmar (el de /documento/#…).
--   portal_meetings   reuniones: el cliente las pide (hasta tres horarios) y el estudio confirma,
--                     propone otra hora o la rechaza. El estudio también las agenda directamente.
--   portal_ratings    la valoración del mes de cada persona (1 a 5 y un comentario).
--   portal_posts.source  de dónde salió un avance o hito (negocio:stage:<id>): no se repite.
--
-- Permisos nuevos: project.view y docs.view (ver; sí si nadie lo cambia), meetings.request y
-- rating.send (sí si nadie lo cambia; «Solo lectura» no). La app y la función `portal` usan la
-- misma regla (src/portal/brand.js y supabase/functions/portal/index.ts).
--
-- Mientras esta migración no esté aplicada la app sigue igual: lo nuevo no aparece.

-- ── Permisos ──

create or replace function private.perm_default(k text) returns boolean
language sql immutable set search_path = '' as $$
  select k like '%.view' or k in ('content.approve', 'content.reject', 'comment', 'tasks.submit', 'send', 'business.edit', 'meetings.request', 'rating.send');
$$;

-- ── Avances que vienen de Negocio: una sola vez cada uno ──

alter table public.portal_posts add column if not exists source text check (char_length(source) <= 120);
create unique index if not exists portal_posts_source_idx on public.portal_posts (client_id, source) where source is not null;

-- ── El proyecto ──

create table public.portal_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  crm_project_id text not null check (char_length(crm_project_id) between 1 and 80),
  name text not null check (char_length(name) between 1 and 200),
  code text check (char_length(code) <= 12),
  status text not null default 'active' check (status in ('pending', 'active', 'paused', 'completed')),
  -- [{ "name": "Arranque", "done": true, "done_at": "2026-11-02T15:00:00Z" }, …]
  stages jsonb not null default '[]'::jsonb check (jsonb_typeof(stages) = 'array' and pg_column_size(stages) < 20000),
  tasks_done integer not null default 0 check (tasks_done >= 0),
  tasks_total integer not null default 0 check (tasks_total >= 0),
  minutes_month integer not null default 0 check (minutes_month >= 0),
  minutes_total integer not null default 0 check (minutes_total >= 0),
  start_date date,
  due_date date,
  -- Lo próximo con fecha: [{ "title": "Entrega del diseño", "due": "2026-12-01", "status": "doing" }, …]
  upcoming jsonb not null default '[]'::jsonb check (jsonb_typeof(upcoming) = 'array' and pg_column_size(upcoming) < 20000),
  description text check (char_length(description) <= 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, crm_project_id)
);

-- ── Facturas, cotizaciones y propuestas ──

create table public.portal_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  crm_doc_id text not null check (char_length(crm_doc_id) between 1 and 80),
  type text not null check (type in ('invoice', 'quote', 'proposal', 'receipt')),
  number text check (char_length(number) <= 40),
  title text check (char_length(title) <= 200),
  issue_date date,
  due_date date,
  currency text not null default 'USD' check (char_length(currency) between 1 and 8),
  total numeric(14, 2) not null default 0,
  paid numeric(14, 2) not null default 0,
  -- open: por pagar o por responder · partial: pagada en parte · paid: pagada · viewed: la abrió
  -- accepted / declined: firmó o rechazó · expired: venció sin respuesta · void: anulada
  status text not null default 'open' check (status in ('open', 'partial', 'paid', 'viewed', 'accepted', 'declined', 'expired', 'void')),
  url text check (url is null or url ~ '^https://'),
  locked boolean not null default false,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, crm_doc_id)
);

-- ── Reuniones ──

create table public.portal_meetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  origin text not null default 'studio' check (origin in ('studio', 'client')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  author text check (char_length(author) <= 120),
  topic text not null check (char_length(topic) between 1 and 200),
  notes text check (char_length(notes) <= 2000),
  mode text not null default 'video' check (mode in ('video', 'call', 'in_person')),
  options timestamptz[] not null default '{}' check (cardinality(options) <= 3),
  starts_at timestamptz,
  duration integer not null default 30 check (duration between 10 and 480),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'done')),
  link text check (link is null or link ~ '^https?://'),
  place text check (char_length(place) <= 300),
  studio_note text check (char_length(studio_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'confirmed' or starts_at is not null)
);
create index portal_meetings_client_idx on public.portal_meetings (client_id, starts_at);
create index portal_meetings_created_by_idx on public.portal_meetings (created_by);

-- ── Valoración del mes ──

create table public.portal_ratings (
  client_id uuid not null references public.portal_clients (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author text check (char_length(author) <= 120),
  score smallint not null check (score between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id, month, user_id)
);
create index portal_ratings_user_idx on public.portal_ratings (user_id);

-- ── Fechas de cambio ──

create trigger portal_projects_touch before update on public.portal_projects for each row execute function public.portal_touch();
create trigger portal_documents_touch before update on public.portal_documents for each row execute function public.portal_touch();
create trigger portal_meetings_touch before update on public.portal_meetings for each row execute function public.portal_touch();
create trigger portal_ratings_touch before update on public.portal_ratings for each row execute function public.portal_touch();

-- ── Lo que pone la base, no el cliente ──

-- Una reunión que pide el cliente siempre entra como petición suya, sin hora fijada.
-- Sin «security definer»: dentro de una así, current_user es el dueño y nunca 'authenticated'.
create or replace function private.portal_meeting_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated' and not private.is_admin() then
    if tg_op = 'INSERT' then
      new.origin := 'client';
      new.created_by := auth.uid();
      new.status := 'requested';
      new.starts_at := null;
      new.link := null;
      new.studio_note := null;
      new.author := (select coalesce(nullif(m.name, ''), m.email) from public.portal_members m where m.client_id = new.client_id and m.user_id = auth.uid());
      if cardinality(new.options) = 0 then
        raise exception 'Propón al menos un horario.' using errcode = '22023';
      end if;
    else
      -- El cliente solo cancela la suya, y solo mientras no haya pasado.
      if (to_jsonb(new) - array['status', 'updated_at']) is distinct from (to_jsonb(old) - array['status', 'updated_at'])
        or new.status <> 'cancelled' or old.status not in ('requested', 'confirmed') then
        raise exception 'No puedes cambiar eso.' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger portal_meetings_guard before insert or update on public.portal_meetings for each row execute function private.portal_meeting_guard();

-- Cada quien valora por sí mismo, el mes que corre o el anterior, y su nombre lo pone la base.
create or replace function private.portal_rating_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  this_month date := date_trunc('month', (now() at time zone 'America/Caracas'))::date;
begin
  if current_user = 'authenticated' and not private.is_admin() then
    new.user_id := auth.uid();
    if new.month not in (this_month, (this_month - interval '1 month')::date) then
      raise exception 'Ese mes ya no se puede valorar.' using errcode = '42501';
    end if;
    new.author := (select coalesce(nullif(m.name, ''), m.email) from public.portal_members m where m.client_id = new.client_id and m.user_id = auth.uid());
  end if;
  return new;
end $$;
create trigger portal_ratings_guard before insert or update on public.portal_ratings for each row execute function private.portal_rating_guard();

-- ── Reglas ──

alter table public.portal_projects enable row level security;
alter table public.portal_documents enable row level security;
alter table public.portal_meetings enable row level security;
alter table public.portal_ratings enable row level security;

grant select, insert, update, delete on public.portal_projects, public.portal_documents, public.portal_meetings, public.portal_ratings to authenticated;
revoke all on public.portal_projects, public.portal_documents, public.portal_meetings, public.portal_ratings from anon;
grant all on public.portal_projects, public.portal_documents, public.portal_meetings, public.portal_ratings to service_role;

create policy "Estudio: todo" on public.portal_projects for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_documents for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_meetings for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Estudio: todo" on public.portal_ratings for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Miembros ven su proyecto" on public.portal_projects for select to authenticated
  using (not hidden and (select private.perm(client_id, 'project.view')));
create policy "Miembros ven sus documentos" on public.portal_documents for select to authenticated
  using ((select private.perm(client_id, 'docs.view')));

create policy "Miembros ven las reuniones" on public.portal_meetings for select to authenticated
  using ((select private.is_member(client_id)));
create policy "Miembros piden reuniones" on public.portal_meetings for insert to authenticated
  with check ((select private.perm(client_id, 'meetings.request')));
create policy "Cada quien cancela su reunión" on public.portal_meetings for update to authenticated
  using (created_by = (select auth.uid()) and (select private.is_member(client_id)))
  with check (created_by = (select auth.uid()) and (select private.is_member(client_id)));

create policy "Cada quien ve su valoración" on public.portal_ratings for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_member(client_id)));
create policy "Miembros valoran" on public.portal_ratings for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.perm(client_id, 'rating.send')));
create policy "Cada quien cambia su valoración" on public.portal_ratings for update to authenticated
  using (user_id = (select auth.uid()) and (select private.perm(client_id, 'rating.send')))
  with check (user_id = (select auth.uid()) and (select private.perm(client_id, 'rating.send')));

-- ── Tiempo real y avisos ──

alter publication supabase_realtime add table public.portal_projects, public.portal_documents, public.portal_meetings, public.portal_ratings;

create trigger portal_documents_hook after insert or update of status on public.portal_documents for each row execute function private.portal_hook();
create trigger portal_meetings_hook after insert or update of status, starts_at on public.portal_meetings for each row execute function private.portal_hook();
create trigger portal_ratings_hook after insert or update of score, comment on public.portal_ratings for each row execute function private.portal_hook();
