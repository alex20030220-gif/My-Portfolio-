create table public.contact_requests (
  id uuid primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text check (phone is null or char_length(phone) between 7 and 40),
  request text not null check (char_length(request) between 20 and 5000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  consent boolean not null default true check (consent),
  client_hash text not null check (char_length(client_hash) = 64)
);
comment on table public.contact_requests is 'Private portfolio enquiries. Review in the Supabase Table Editor; set status to contacted or closed after follow-up.';
comment on column public.contact_requests.client_hash is 'Daily salted abuse-prevention hash; no raw IP address is stored.';
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from public, anon, authenticated;
grant select, insert, update, delete on public.contact_requests to service_role;
create index contact_requests_inbox on public.contact_requests (created_at desc);
create index contact_requests_rate_limit on public.contact_requests (client_hash, created_at desc);

create function public.submit_portfolio_contact(
  p_submission_id uuid, p_name text, p_email text, p_phone text,
  p_request text, p_client_hash text
) returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_hash, 0));
  if exists (select 1 from public.contact_requests where id = p_submission_id and client_hash = p_client_hash) then
    return p_submission_id;
  end if;
  if (select count(*) from public.contact_requests where client_hash = p_client_hash and created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.contact_requests (id, name, email, phone, request, client_hash)
  values (p_submission_id, p_name, p_email, nullif(p_phone, ''), p_request, p_client_hash);
  return p_submission_id;
end;
$$;
revoke all on function public.submit_portfolio_contact(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_portfolio_contact(uuid, text, text, text, text, text) to service_role;
