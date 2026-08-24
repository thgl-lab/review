-- ============================================================
-- 여기찜 · saved_places에 상황 태그(situation_tags) 컬럼 추가
-- ============================================================
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행하세요.
-- saved-places-schema.sql을 이미 실행한 뒤에 추가로 실행하는
-- 마이그레이션입니다.
--
-- 상황 태그는 8개 고정값 중 다중 선택입니다 (PRD 6.2):
--   혼밥 · 카공 · 데이트 · 가족 모임 · 친구 모임 · 회식/술자리 · 기념일 · 비즈니스
-- 값 자체를 DB에서 강제하진 않고(고정 목록은 situation-tags.js에서 관리),
-- 빈 배열을 기본값으로 둡니다 — 담을 때는 태그 없이 저장되고,
-- 마이페이지에서 나중에 붙입니다.
-- ============================================================

alter table public.saved_places
  add column if not exists situation_tags text[] not null default '{}';

-- 마이페이지에서 태그를 나중에 편집할 수 있으려면 update 권한이 필요한데,
-- 기존 saved-places-schema.sql에는 select/insert/delete 정책만 있고
-- update 정책이 없었습니다 (RLS가 켜져 있으면 정책이 없는 작업은 전부 막힙니다).
create policy "saved_places_update_own"
  on public.saved_places for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 태그로 필터링할 때 빠르게 찾도록 GIN 인덱스 추가
create index if not exists saved_places_situation_tags_idx
  on public.saved_places using gin (situation_tags);
