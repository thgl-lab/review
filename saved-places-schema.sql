-- ============================================================
-- 여기찜 · saved_places 테이블 (담기/찜 기능)
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행하세요.
-- ============================================================

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kakao_place_id text not null,        -- 가게 고유번호 (카카오 place.id)
  place_name text not null,            -- 가게 이름
  category_name text,                  -- 카테고리
  address text,                        -- 주소
  lat double precision,                -- 좌표 (위도)
  lng double precision,                -- 좌표 (경도)
  place_url text,                      -- 카카오맵 링크
  phone text,                          -- 전화번호
  created_at timestamptz not null default now(),  -- 담은 시간 (자동)
  unique (user_id, kakao_place_id)     -- 같은 사람이 같은 가게 중복 담기 방지
);

create index if not exists saved_places_user_id_idx on public.saved_places (user_id);

alter table public.saved_places enable row level security;

-- 본인이 담은 목록만 조회 가능
create policy "saved_places_select_own"
  on public.saved_places for select
  to authenticated
  using (auth.uid() = user_id);

-- 본인 이름으로만 담기(삽입) 가능
create policy "saved_places_insert_own"
  on public.saved_places for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 본인이 담은 것만 삭제(찜 해제) 가능
create policy "saved_places_delete_own"
  on public.saved_places for delete
  to authenticated
  using (auth.uid() = user_id);
