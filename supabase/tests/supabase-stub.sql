-- Minimal stand-in for Supabase's auth schema and roles, so the migrations can
-- be tested on a plain Postgres. auth.uid() reads the same claim Supabase sets.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant select on tables to anon, authenticated;
create role service_role nologin;
grant usage on schema public to service_role;
-- Like hosted Supabase: new functions are executable by anon, authenticated and service_role unless
-- revoked from each (0049: revoking from public alone isn't enough).
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
