-- efacture — schéma Supabase (synchronisation du stockage local)
-- À exécuter dans l'éditeur SQL du projet (SQL Editor > New query > Run).
--
-- L'application garde ses données sur l'appareil (IndexedDB) et les
-- synchronise ici. Les tables reprennent le format local : un identifiant
-- texte, l'objet complet en JSON, un horodatage. Chaque ligne appartient à
-- l'utilisateur connecté (auth.uid()) et n'est visible que de lui.

create extension if not exists "pgcrypto";

-- Profil du commerce (un par utilisateur)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Reçus (lignes d'articles incluses dans data). deleted = tombstone.
create table if not exists public.invoices (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists invoices_owner_updated on public.invoices (owner_id, updated_at);

-- Prix de vente par produit
create table if not exists public.product_prices (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists product_prices_owner_updated on public.product_prices (owner_id, updated_at);

-- updated_at suit chaque écriture (sert au rapatriement incrémental)
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_invoices_updated on public.invoices;
create trigger trg_invoices_updated before update on public.invoices for each row execute function public.set_updated_at();
drop trigger if exists trg_prices_updated on public.product_prices;
create trigger trg_prices_updated before update on public.product_prices for each row execute function public.set_updated_at();

-- Sécurité : chacun ne voit que ses lignes
alter table public.profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.product_prices enable row level security;

drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "invoices_own" on public.invoices;
create policy "invoices_own" on public.invoices for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "product_prices_own" on public.product_prices;
create policy "product_prices_own" on public.product_prices for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Temps réel : utile pour voir un autre appareil ajouter un reçu
alter table public.invoices replica identity full;
alter table public.product_prices replica identity full;
alter table public.profiles replica identity full;
do $$
begin
  begin alter publication supabase_realtime add table public.invoices; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.product_prices; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;

-- Photos : bucket privé, chemin = <uid>/<photoId>
insert into storage.buckets (id, name, public, file_size_limit)
values ('receipt-photos', 'receipt-photos', false, 5242880)
on conflict (id) do nothing;

drop policy if exists "photos_read_own" on storage.objects;
create policy "photos_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'receipt-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_write_own" on storage.objects;
create policy "photos_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipt-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_update_own" on storage.objects;
create policy "photos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'receipt-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_delete_own" on storage.objects;
create policy "photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipt-photos' and (storage.foldername(name))[1] = auth.uid()::text);
