-- ===================================================================
-- MRZN APPS & GAMES — SUPABASE SCHEMA
-- এই পুরো ফাইলটা Supabase Dashboard → SQL Editor -এ পেস্ট করে RUN করুন
-- ===================================================================

-- 1. PROFILES টেবিল (auth.users এর extension)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- নতুন ইউজার সাইনআপ করলেই অটো প্রোফাইল রো তৈরি হবে
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. APPS টেবিল (আপনার পাবলিশ করা অ্যাপ/গেম)
create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  category text not null default 'Tools',
  icon_url text,
  screenshots text[] default '{}',
  download_url text,
  developer_note text,
  created_at timestamptz default now()
);

alter table public.apps enable row level security;

create policy "apps are viewable by everyone"
  on public.apps for select using (true);

create policy "only admins can insert apps"
  on public.apps for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "only admins can update apps"
  on public.apps for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "only admins can delete apps"
  on public.apps for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));


-- 3. REVIEWS টেবিল (পাবলিক রেটিং + কমেন্ট)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique (app_id, user_id)  -- প্রতি ইউজার প্রতি অ্যাপে একটাই রিভিউ দিতে পারবে
);

alter table public.reviews enable row level security;

create policy "reviews are viewable by everyone"
  on public.reviews for select using (true);

create policy "logged in users can add review"
  on public.reviews for insert
  with check (auth.uid() = user_id);

create policy "users can update own review"
  on public.reviews for update
  using (auth.uid() = user_id);

create policy "users can delete own review"
  on public.reviews for delete
  using (auth.uid() = user_id);


-- 4. RATINGS SUMMARY VIEW (প্রতিটা অ্যাপের average rating + count, দ্রুত লোডের জন্য)
create or replace view public.app_ratings as
select
  app_id,
  round(avg(rating)::numeric, 1) as avg_rating,
  count(*) as review_count,
  count(*) filter (where rating = 5) as r5,
  count(*) filter (where rating = 4) as r4,
  count(*) filter (where rating = 3) as r3,
  count(*) filter (where rating = 2) as r2,
  count(*) filter (where rating = 1) as r1
from public.reviews
group by app_id;


-- 5. রিভিউ লেখকের নাম সহ দেখানোর জন্য ভিউ (join profiles)
create or replace view public.reviews_with_user as
select
  r.id, r.app_id, r.user_id, r.rating, r.comment, r.created_at,
  p.username
from public.reviews r
join public.profiles p on p.id = r.user_id
order by r.created_at desc;


-- ===================================================================
-- ৬. নিজেকে অ্যাডমিন বানাতে (একবার সাইনআপ করার পর এই লাইন চালান,
--    ইমেইলটা আপনার নিজের একাউন্টের ইমেইল দিয়ে বদলে দিন):
--
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'your-admin-email@example.com');
-- ===================================================================


-- ৭. (ঐচ্ছিক) স্ক্রিনশট/আইকনের জন্য Storage bucket বানাতে চাইলে:
-- Supabase Dashboard → Storage → New bucket → নাম দিন "app-assets", Public করে দিন।
