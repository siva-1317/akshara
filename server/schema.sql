create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  phone_number text,
  profession text,
  coins integer not null default 50,
  role text not null default 'user',
  password text,
  is_blocked boolean not null default false,
  block_reason text,
  created_at timestamptz default now()
);

alter table if exists users add column if not exists phone_number text;
alter table if exists users add column if not exists profession text;
alter table if exists users add column if not exists coins integer not null default 50;

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  topic text not null,
  sub_topics text[] default '{}',
  difficulty text not null,
  score integer default 0,
  time integer,
  date timestamptz default now(),
  exam_type text,
  question_count integer,
  total_time integer,
  weak_topics text[] default '{}',
  evaluation_explanation text
);

alter table if exists tests add column if not exists sub_topics text[] default '{}';

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  topic text,
  question text not null,
  options jsonb not null,
  answer text not null,
  explanation text,
  difficulty text,
  position integer default 1
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  user_answer text,
  is_correct boolean default false,
  created_at timestamptz default now(),
  unique (test_id, question_id, user_id)
);

create table if not exists unblock_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz default now()
);

create table if not exists coin_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  requested_coins integer not null,
  reason text,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text references users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  category text not null,
  message text not null,
  created_at timestamptz default now()
);

insert into topics (name)
values
  ('JavaScript'),
  ('React'),
  ('Node.js'),
  ('SQL'),
  ('Aptitude')
on conflict (name) do nothing;

insert into users (id, name, email, role, password)
values ('admin-1', 'AKSHARA Admin', 'admin@gmail.com', 'admin', 'admin123')
on conflict (id) do update
set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  password = excluded.password;
