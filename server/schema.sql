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
  gemini_api_key text,
  is_blocked boolean not null default false,
  block_reason text,
  created_at timestamptz default now()
);

alter table if exists users add column if not exists phone_number text;
alter table if exists users add column if not exists profession text;
alter table if exists users add column if not exists coins integer not null default 50;
alter table if exists users add column if not exists gemini_api_key text;

create table if not exists user_onboarding (
  user_id text primary key references users(id) on delete cascade,
  answers jsonb not null,
  ai_result jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  offer_type text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  fixed_question_count integer,
  fixed_difficulty text,
  fixed_exam_type text,
  status text not null default 'active',
  created_by text references users(id) on delete set null,
  created_at timestamptz default now(),
  cancelled_at timestamptz
);

alter table if exists offers add column if not exists offer_type text;
alter table if exists offers add column if not exists starts_at timestamptz;
alter table if exists offers add column if not exists ends_at timestamptz;
alter table if exists offers add column if not exists fixed_question_count integer;
alter table if exists offers add column if not exists fixed_difficulty text;
alter table if exists offers add column if not exists fixed_exam_type text;
alter table if exists offers add column if not exists status text;
alter table if exists offers add column if not exists created_by text;
alter table if exists offers add column if not exists created_at timestamptz;
alter table if exists offers add column if not exists cancelled_at timestamptz;

create table if not exists offer_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  offer_type text not null,
  days integer,
  fixed_question_count integer,
  fixed_difficulty text,
  fixed_exam_type text,
  created_by text references users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists offer_templates add column if not exists name text;
alter table if exists offer_templates add column if not exists offer_type text;
alter table if exists offer_templates add column if not exists days integer;
alter table if exists offer_templates add column if not exists fixed_question_count integer;
alter table if exists offer_templates add column if not exists fixed_difficulty text;
alter table if exists offer_templates add column if not exists fixed_exam_type text;
alter table if exists offer_templates add column if not exists created_by text;
alter table if exists offer_templates add column if not exists created_at timestamptz;
alter table if exists offer_templates add column if not exists updated_at timestamptz;

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  category text not null,
  message text not null,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by text references users(id) on delete set null
);

alter table if exists feedback add column if not exists reviewed_at timestamptz;
alter table if exists feedback add column if not exists reviewed_by text;

create table if not exists published_tests (
  id uuid primary key default gen_random_uuid(),
  created_by text references users(id) on delete set null,
  title text not null,
  description text,
  topic text not null,
  sub_topics text[] default '{}',
  difficulty text not null,
  exam_type text,
  question_count integer not null default 10,
  total_time integer,
  pass_mark integer not null default 60,
  reward_type text not null default 'certificate',
  reward_coins integer not null default 0,
  status text not null default 'published',
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists published_test_questions (
  id uuid primary key default gen_random_uuid(),
  published_test_id uuid not null references published_tests(id) on delete cascade,
  topic text,
  question text not null,
  options jsonb not null,
  answer text not null,
  explanation text,
  difficulty text,
  position integer default 1
);

alter table if exists tests add column if not exists published_test_id uuid references published_tests(id) on delete set null;

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  published_test_id uuid not null references published_tests(id) on delete cascade,
  test_id uuid references tests(id) on delete set null,
  certificate_data jsonb not null,
  issued_at timestamptz default now(),
  unique (user_id, published_test_id)
);

create table if not exists task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  published_test_id uuid not null references published_tests(id) on delete cascade,
  test_id uuid references tests(id) on delete set null,
  score integer not null,
  coins_awarded integer not null default 0,
  certificate_id uuid references certificates(id) on delete set null,
  completed_at timestamptz default now(),
  unique (user_id, published_test_id)
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
values ('admin-1', 'AKSHARA Admin', 'siva636938@gmail.com', 'admin', 'admin123')
on conflict (id) do update
set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  password = excluded.password;
