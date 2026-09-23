-- GardaWarga - Supabase database
-- Jalankan seluruh file ini di Supabase SQL Editor.
-- Password JANGAN disimpan di tabel ini. Login memakai Supabase Auth.

create extension if not exists pgcrypto;

-- =========================
-- ENUM
-- =========================
do $$ begin
  create type public.user_role as enum ('warga', 'petugas');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pengaduan_status as enum ('Dikirim', 'Diterima', 'Diproses', 'Selesai');
exception when duplicate_object then null;
end $$;

-- =========================
-- PROFILES / AKUN WARGA
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  email text unique,
  hp text default '-',
  rt text default '-',
  rw text default '-',
  role public.user_role not null default 'warga',
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Otomatis membuat profil ketika akun Supabase Auth dibuat.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nama, email, hp, rt, rw, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', split_part(coalesce(new.email, 'Warga'), '@', 1)),
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'hp', '-'),
    coalesce(new.raw_user_meta_data->>'rt', '-'),
    coalesce(new.raw_user_meta_data->>'rw', '-'),
    case
      when lower(new.email) = '24@gmail.com' then 'petugas'::public.user_role
      else 'warga'::public.user_role
    end
  )
  on conflict (id) do update set
    nama = excluded.nama,
    email = excluded.email,
    hp = excluded.hp,
    rt = excluded.rt,
    rw = excluded.rw;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =========================
-- JADWAL KEGIATAN
-- =========================
create table if not exists public.jadwal (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  tanggal date not null,
  waktu text,
  lokasi text,
  deskripsi text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- NOTIFIKASI
-- Bisa dibuat berbeda-beda dan dapat ditujukan ke satu warga
-- atau semua warga.
-- =========================
create table if not exists public.notifikasi (
  id uuid primary key default gen_random_uuid(),
  judul text,
  isi text not null,
  waktu_text text,
  target_user_id uuid references public.profiles(id) on delete cascade,
  read_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- =========================
-- PENGADUAN
-- =========================
create table if not exists public.pengaduan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nama text not null,
  email text,
  kategori text not null,
  judul text,
  lokasi text not null,
  deskripsi text not null,
  foto_url text,
  foto_nama text,
  status public.pengaduan_status not null default 'Dikirim',
  diproses_oleh uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- FORUM
-- =========================
create table if not exists public.forum_topik (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  judul text not null,
  isi text not null,
  dipin boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_komentar (
  id uuid primary key default gen_random_uuid(),
  topik_id uuid not null references public.forum_topik(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  isi text not null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_like (
  id uuid primary key default gen_random_uuid(),
  topik_id uuid not null references public.forum_topik(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(topik_id, user_id)
);

-- =========================
-- BERITA / INFORMASI
-- =========================
create table if not exists public.berita (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null,
  gambar_url text,
  penulis_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- PROGRAM
-- =========================
create table if not exists public.program (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  deskripsi text not null,
  gambar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- INDEX
-- =========================
create index if not exists idx_jadwal_tanggal on public.jadwal(tanggal);
create index if not exists idx_notifikasi_target on public.notifikasi(target_user_id, created_at desc);
create index if not exists idx_pengaduan_user on public.pengaduan(user_id, created_at desc);
create index if not exists idx_pengaduan_status on public.pengaduan(status);
create index if not exists idx_forum_topik_created on public.forum_topik(created_at desc);
create index if not exists idx_forum_komentar_topik on public.forum_komentar(topik_id, created_at);
create index if not exists idx_berita_published on public.berita(published_at desc);

-- =========================
-- UPDATED_AT
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_jadwal_updated_at on public.jadwal;
create trigger trg_jadwal_updated_at before update on public.jadwal
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_pengaduan_updated_at on public.pengaduan;
create trigger trg_pengaduan_updated_at before update on public.pengaduan
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_forum_topik_updated_at on public.forum_topik;
create trigger trg_forum_topik_updated_at before update on public.forum_topik
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_forum_komentar_updated_at on public.forum_komentar;
create trigger trg_forum_komentar_updated_at before update on public.forum_komentar
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_berita_updated_at on public.berita;
create trigger trg_berita_updated_at before update on public.berita
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_program_updated_at on public.program;
create trigger trg_program_updated_at before update on public.program
for each row execute procedure public.set_updated_at();

-- =========================
-- HELPER ROLE
-- =========================
create or replace function public.is_petugas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'petugas'
  );
$$;

-- =========================
-- ROW LEVEL SECURITY
-- =========================
alter table public.profiles enable row level security;
alter table public.jadwal enable row level security;
alter table public.notifikasi enable row level security;
alter table public.pengaduan enable row level security;
alter table public.forum_topik enable row level security;
alter table public.forum_komentar enable row level security;
alter table public.forum_like enable row level security;
alter table public.berita enable row level security;
alter table public.program enable row level security;

-- PROFILE
drop policy if exists "profile_select_authenticated" on public.profiles;
create policy "profile_select_authenticated"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profile_insert_own" on public.profiles;
create policy "profile_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profile_update_own_or_staff" on public.profiles;
create policy "profile_update_own_or_staff"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_petugas())
with check (id = auth.uid() or public.is_petugas());

-- JADWAL: semua bisa melihat, petugas mengelola
drop policy if exists "jadwal_select_authenticated" on public.jadwal;
create policy "jadwal_select_authenticated"
on public.jadwal for select
to authenticated
using (true);

drop policy if exists "jadwal_staff_insert" on public.jadwal;
create policy "jadwal_staff_insert"
on public.jadwal for insert
to authenticated
with check (public.is_petugas());

drop policy if exists "jadwal_staff_update" on public.jadwal;
create policy "jadwal_staff_update"
on public.jadwal for update
to authenticated
using (public.is_petugas())
with check (public.is_petugas());

drop policy if exists "jadwal_staff_delete" on public.jadwal;
create policy "jadwal_staff_delete"
on public.jadwal for delete
to authenticated
using (public.is_petugas());

-- NOTIFIKASI: notifikasi umum (target null) + milik sendiri
drop policy if exists "notifikasi_select" on public.notifikasi;
create policy "notifikasi_select"
on public.notifikasi for select
to authenticated
using (target_user_id is null or target_user_id = auth.uid() or public.is_petugas());

drop policy if exists "notifikasi_staff_insert" on public.notifikasi;
create policy "notifikasi_staff_insert"
on public.notifikasi for insert
to authenticated
with check (public.is_petugas());

drop policy if exists "notifikasi_own_update" on public.notifikasi;
create policy "notifikasi_own_update"
on public.notifikasi for update
to authenticated
using (target_user_id = auth.uid() or public.is_petugas())
with check (target_user_id = auth.uid() or public.is_petugas());

drop policy if exists "notifikasi_staff_delete" on public.notifikasi;
create policy "notifikasi_staff_delete"
on public.notifikasi for delete
to authenticated
using (public.is_petugas());

-- PENGADUAN: warga hanya melihat miliknya, petugas melihat semua
drop policy if exists "pengaduan_select" on public.pengaduan;
create policy "pengaduan_select"
on public.pengaduan for select
to authenticated
using (user_id = auth.uid() or public.is_petugas());

drop policy if exists "pengaduan_insert_own" on public.pengaduan;
create policy "pengaduan_insert_own"
on public.pengaduan for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "pengaduan_staff_update" on public.pengaduan;
create policy "pengaduan_staff_update"
on public.pengaduan for update
to authenticated
using (public.is_petugas())
with check (public.is_petugas());

drop policy if exists "pengaduan_staff_delete" on public.pengaduan;
create policy "pengaduan_staff_delete"
on public.pengaduan for delete
to authenticated
using (public.is_petugas());

-- FORUM TOPIK
drop policy if exists "forum_topik_select" on public.forum_topik;
create policy "forum_topik_select"
on public.forum_topik for select
to authenticated
using (deleted_at is null or public.is_petugas());

drop policy if exists "forum_topik_insert" on public.forum_topik;
create policy "forum_topik_insert"
on public.forum_topik for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "forum_topik_update_own_or_staff" on public.forum_topik;
create policy "forum_topik_update_own_or_staff"
on public.forum_topik for update
to authenticated
using (user_id = auth.uid() or public.is_petugas())
with check (user_id = auth.uid() or public.is_petugas());

drop policy if exists "forum_topik_delete_own_or_staff" on public.forum_topik;
create policy "forum_topik_delete_own_or_staff"
on public.forum_topik for delete
to authenticated
using (user_id = auth.uid() or public.is_petugas());

-- KOMENTAR FORUM
drop policy if exists "forum_komentar_select" on public.forum_komentar;
create policy "forum_komentar_select"
on public.forum_komentar for select
to authenticated
using (deleted_at is null or public.is_petugas());

drop policy if exists "forum_komentar_insert" on public.forum_komentar;
create policy "forum_komentar_insert"
on public.forum_komentar for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "forum_komentar_update_own_or_staff" on public.forum_komentar;
create policy "forum_komentar_update_own_or_staff"
on public.forum_komentar for update
to authenticated
using (user_id = auth.uid() or public.is_petugas())
with check (user_id = auth.uid() or public.is_petugas());

drop policy if exists "forum_komentar_delete_own_or_staff" on public.forum_komentar;
create policy "forum_komentar_delete_own_or_staff"
on public.forum_komentar for delete
to authenticated
using (user_id = auth.uid() or public.is_petugas());

-- LIKE
drop policy if exists "forum_like_select" on public.forum_like;
create policy "forum_like_select"
on public.forum_like for select
to authenticated
using (true);

drop policy if exists "forum_like_insert_own" on public.forum_like;
create policy "forum_like_insert_own"
on public.forum_like for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "forum_like_delete_own_or_staff" on public.forum_like;
create policy "forum_like_delete_own_or_staff"
on public.forum_like for delete
to authenticated
using (user_id = auth.uid() or public.is_petugas());

-- BERITA
drop policy if exists "berita_select" on public.berita;
create policy "berita_select"
on public.berita for select
to authenticated
using (published_at is not null or public.is_petugas());

drop policy if exists "berita_staff_insert" on public.berita;
create policy "berita_staff_insert"
on public.berita for insert
to authenticated
with check (public.is_petugas());

drop policy if exists "berita_staff_update" on public.berita;
create policy "berita_staff_update"
on public.berita for update
to authenticated
using (public.is_petugas())
with check (public.is_petugas());

drop policy if exists "berita_staff_delete" on public.berita;
create policy "berita_staff_delete"
on public.berita for delete
to authenticated
using (public.is_petugas());

-- PROGRAM
drop policy if exists "program_select" on public.program;
create policy "program_select"
on public.program for select
to authenticated
using (true);

drop policy if exists "program_staff_insert" on public.program;
create policy "program_staff_insert"
on public.program for insert
to authenticated
with check (public.is_petugas());

drop policy if exists "program_staff_update" on public.program;
create policy "program_staff_update"
on public.program for update
to authenticated
using (public.is_petugas())
with check (public.is_petugas());

drop policy if exists "program_staff_delete" on public.program;
create policy "program_staff_delete"
on public.program for delete
to authenticated
using (public.is_petugas());

-- =========================
-- DATA AWAL
-- =========================
insert into public.jadwal (judul, tanggal, waktu, lokasi, deskripsi)
select 'Kerja Bakti Bersih Lingkungan', '2026-09-20', '07.00–10.00 WIB', 'RT 01–05',
       'Bawa sapu, ember, dan kantong sampah.'
where not exists (
  select 1 from public.jadwal where judul = 'Kerja Bakti Bersih Lingkungan' and tanggal = '2026-09-20'
);

insert into public.jadwal (judul, tanggal, waktu, lokasi, deskripsi)
select 'Rapat Warga Bulanan', '2026-09-28', '19.00 WIB', 'Balai Warga',
       'Evaluasi kebersihan & rencana Oktober.'
where not exists (
  select 1 from public.jadwal where judul = 'Rapat Warga Bulanan' and tanggal = '2026-09-28'
);

insert into public.notifikasi (judul, isi, waktu_text)
select 'Perubahan jadwal', 'Jadwal kerja bakti berubah menjadi Sabtu 20 Sept', '2 jam lalu'
where not exists (
  select 1 from public.notifikasi
  where isi = 'Jadwal kerja bakti berubah menjadi Sabtu 20 Sept'
);

insert into public.notifikasi (judul, isi, waktu_text)
select 'Rapat warga', 'Rapat RT besok pukul 19.00 di Balai Warga', '5 jam lalu'
where not exists (
  select 1 from public.notifikasi
  where isi = 'Rapat RT besok pukul 19.00 di Balai Warga'
);

insert into public.notifikasi (judul, isi, waktu_text)
select 'Pengumuman', 'Pembayaran iuran bulan September', '1 hari lalu'
where not exists (
  select 1 from public.notifikasi
  where isi = 'Pembayaran iuran bulan September'
);
