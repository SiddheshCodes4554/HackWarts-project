-- Community + Marketplace schema for Supabase (PostgreSQL)
-- Run this in Supabase SQL editor before using /community and /marketplace.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  crop_tag text not null,
  district text not null,
  status text not null check (status in ('safe', 'warning', 'blocked')) default 'safe',
  media_url text,
  media_type text default 'text',
  summary text,
  ai_tags text[] default '{}',
  ai_suggestion text,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'upvote',
  created_at timestamptz not null default now(),
  unique (post_id, user_id, reaction_type)
);

create table if not exists public.post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  crop text not null,
  quantity numeric not null,
  min_price numeric not null,
  district text not null,
  quality text,
  latitude double precision,
  longitude double precision,
  status text not null default 'open' check (status in ('open', 'active', 'sold', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  price numeric not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  bid_id uuid not null references public.bids(id) on delete cascade,
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  price numeric not null,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_shares enable row level security;
alter table public.listings enable row level security;
alter table public.bids enable row level security;
alter table public.transactions enable row level security;

-- Community: authenticated read/write.
drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select on public.community_posts
for select to authenticated using (status <> 'blocked');

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists comments_rw on public.comments;
create policy comments_rw on public.comments
for all to authenticated using (true) with check (auth.uid() = user_id);

drop policy if exists reactions_rw on public.post_reactions;
create policy reactions_rw on public.post_reactions
for all to authenticated using (true) with check (auth.uid() = user_id);

drop policy if exists shares_rw on public.post_shares;
create policy shares_rw on public.post_shares
for all to authenticated using (true) with check (auth.uid() = user_id);

-- Marketplace.
drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings
for select to authenticated using (true);

drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings
for insert to authenticated with check (auth.uid() = farmer_id);

drop policy if exists listings_update_owner on public.listings;
create policy listings_update_owner on public.listings
for update to authenticated using (auth.uid() = farmer_id);

drop policy if exists bids_select on public.bids;
create policy bids_select on public.bids
for select to authenticated using (true);

drop policy if exists bids_insert on public.bids;
create policy bids_insert on public.bids
for insert to authenticated with check (auth.uid() = buyer_id);

drop policy if exists bids_update_open on public.bids;
create policy bids_update_open on public.bids
for update to authenticated using (true);

drop policy if exists tx_select on public.transactions;
create policy tx_select on public.transactions
for select to authenticated using (auth.uid() = farmer_id or auth.uid() = buyer_id);

drop policy if exists tx_insert on public.transactions;
create policy tx_insert on public.transactions
for insert to authenticated with check (auth.uid() = farmer_id);
