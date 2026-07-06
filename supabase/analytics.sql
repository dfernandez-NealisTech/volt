-- ============================================================================
-- VOLT · Anonymous analytics — Supabase schema + RLS
-- ============================================================================
-- Paste this whole file into the Supabase SQL Editor (project in an EU region)
-- and run it once. It creates a single append-only events table and locks it
-- down so the public anon key shipped in the SPA can ONLY insert rows.
--
--   · The anon key is public by design (it lives in the JS bundle). Safety comes
--     entirely from RLS: INSERT is allowed, everything else is denied.
--   · You read/aggregate from the SQL Editor or dashboard (service_role, which
--     bypasses RLS). The anon role can never SELECT anyone's events.
--   · `ts` (server clock) is the source of truth. `client_ts` is whatever the
--     browser reported and can be spoofed — never trust it for ordering.
-- ============================================================================

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  anon_id     uuid        not null,                       -- random per-device token (localStorage)
  session_id  uuid        not null,                       -- one per page load / tab
  name        text        not null check (char_length(name) between 1 and 64),
  path        text        check (path is null or char_length(path) <= 512),
  props       jsonb       not null default '{}'::jsonb,   -- atomic, free-form payload
  client_ts   timestamptz,                                -- browser clock (untrusted)
  ts          timestamptz not null default now(),         -- server clock (source of truth)
  app_version text        check (app_version is null or char_length(app_version) <= 32)
);

-- Query patterns: by user over time, by event type over time, and inside props.
create index if not exists events_anon_ts_idx  on public.events (anon_id, ts desc);
create index if not exists events_name_ts_idx  on public.events (name, ts desc);
create index if not exists events_ts_idx       on public.events (ts desc);
create index if not exists events_props_gin_idx on public.events using gin (props);

-- ---------------------------------------------------------------------------
-- Row Level Security: the crux of "no backend but safe".
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;

-- Belt-and-braces: revoke everything, then grant only INSERT to the public roles.
revoke all on public.events from anon, authenticated;
grant insert on public.events to anon, authenticated;

-- The SPA (anon role) may insert events, and nothing else.
-- No SELECT / UPDATE / DELETE policy exists, so those are denied by default.
drop policy if exists "anon can insert events" on public.events;
create policy "anon can insert events"
  on public.events
  for insert
  to anon, authenticated
  with check (
    -- Cheap sanity guards to blunt trivial payload abuse from the public key.
    char_length(name) between 1 and 64
    and pg_column_size(props) <= 8192
  );

-- ============================================================================
-- Example read queries (run as service_role in the SQL Editor)
-- ============================================================================
-- Daily active anonymous users:
--   select date_trunc('day', ts) d, count(distinct anon_id)
--   from public.events group by 1 order by 1;
--
-- Marcajes created per day, split by kind:
--   select date_trunc('day', ts) d, props->>'sentido' sentido, count(*)
--   from public.events where name = 'marcaje_creado' group by 1, 2 order by 1;
--
-- Theme / palette popularity:
--   select props->>'tema'  tema,   count(*) from public.events where name = 'tema_cambiado'  group by 1;
--   select props->>'paleta' paleta, count(*) from public.events where name = 'paleta_cambiada' group by 1;
--
-- Most-clicked controls (autocapture):
--   select props->>'label' label, count(*) from public.events
--   where name = 'click' group by 1 order by 2 desc limit 30;
-- ============================================================================

-- ============================================================================
-- Snapshot analytics (the periodic 'snapshot' event)
-- ============================================================================
-- Clients emit a 'snapshot' every ~15 min while their tab is visible. Summing
-- snapshots inside a time bucket gives active users and state distributions.
--
-- Active anonymous users per 15-minute bucket (a timeseries):
--   select date_bin('15 minutes', ts, timestamptz 'epoch') AS bucket,
--          count(distinct anon_id) AS active_users
--   from public.events where name = 'snapshot'
--   group by 1 order by 1;
--
-- Active users "right now" (last 15 minutes):
--   select count(distinct anon_id)
--   from public.events
--   where name = 'snapshot' and ts > now() - interval '15 minutes';
--
-- Users per theme, using each user's MOST RECENT snapshot (current mix):
--   select props->>'theme' AS theme, count(*) AS users
--   from (
--     select distinct on (anon_id) anon_id, props
--     from public.events where name = 'snapshot'
--     order by anon_id, ts desc
--   ) latest
--   group by 1 order by 2 desc;
--
-- Palette mix over time (stacked-area friendly):
--   select date_bin('15 minutes', ts, timestamptz 'epoch') AS bucket,
--          props->>'palette' AS palette,
--          count(distinct anon_id) AS users
--   from public.events where name = 'snapshot'
--   group by 1, 2 order by 1;
--
-- Logged-in vs anonymous, and average schedules configured, per day:
--   select date_trunc('day', ts) AS d,
--          count(distinct anon_id) filter (where (props->>'logged_in')::bool) AS logged_in,
--          round(avg((props->>'schedules_count')::int), 1) AS avg_schedules
--   from public.events where name = 'snapshot'
--   group by 1 order by 1;
-- ============================================================================

-- ============================================================================
-- Login funnel and error rates (semantic events)
-- ============================================================================
-- Login success vs failure, and failures by cause:
--   select name, props->>'motivo' AS motivo, count(*)
--   from public.events where name in ('login_ok', 'login_fallido')
--   group by 1, 2 order by 1, 3 desc;
--
-- Logout breakdown (user-initiated vs forced 401 expiry):
--   select props->>'reason' AS reason, count(*)
--   from public.events where name = 'logout' group by 1;
--
-- Marcaje success rate per day:
--   select date_trunc('day', ts) AS d,
--          count(*) filter (where name = 'marcaje_creado')  AS ok,
--          count(*) filter (where name = 'marcaje_fallido') AS fail
--   from public.events
--   where name in ('marcaje_creado', 'marcaje_fallido')
--   group by 1 order by 1;
--
-- Top runtime errors:
--   select props->>'msg' AS msg, count(*)
--   from public.events where name = 'app_error' group by 1 order by 2 desc limit 30;
-- ============================================================================

-- ============================================================================
-- Usage & performance (usage events)
-- ============================================================================
-- Marcaje POST latency percentiles (ms) per day:
--   select date_trunc('day', ts) AS d,
--          percentile_cont(0.5)  within group (order by (props->>'ms')::numeric) AS p50,
--          percentile_cont(0.95) within group (order by (props->>'ms')::numeric) AS p95
--   from public.events
--   where name in ('marcaje_creado', 'marcaje_fallido') and props ? 'ms'
--   group by 1 order by 1;
--
-- Week navigation direction mix:
--   select props->>'direccion' AS direccion, count(*)
--   from public.events where name = 'semana_navegada' group by 1 order by 2 desc;
--
-- Settings activity (what users customise):
--   select name, count(*) from public.events
--   where name in ('horario_anadido', 'horario_eliminado', 'horario_marcaje_anadido',
--                  'horario_marcaje_eliminado', 'teletrabajo_cambiado', 'horario_editado',
--                  'aleatoriedad_cambiada')
--   group by 1 order by 2 desc;
--
-- Randomness range chosen (most recent per user):
--   select (props->>'min')::int AS min, (props->>'max')::int AS max, count(*) AS users
--   from (select distinct on (anon_id) anon_id, props
--         from public.events where name = 'aleatoriedad_cambiada'
--         order by anon_id, ts desc) latest
--   group by 1, 2 order by 3 desc;
-- ============================================================================
