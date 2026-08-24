-- ============================================================
-- 여기찜 · 인기 랭킹 집계 함수 (RLS는 그대로 켜둔 채로)
-- ============================================================
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행하세요.
--
-- saved_places는 "본인 것만 select 가능"하도록 RLS가 걸려있어서,
-- 일반 쿼리로는 "전체 사용자가 가장 많이 담은 가게" 같은 집계를 낼 수
-- 없습니다. 그래서 이 함수 하나만 SECURITY DEFINER로 만들어 테이블
-- 소유자(postgres) 권한으로 실행되게 하고, 함수 안에서는 오직
-- "가게 정보 + 담긴 횟수"만 집계해서 반환합니다.
-- user_id(누가 담았는지)는 이 함수의 select 목록에 전혀 등장하지
-- 않으므로 절대 밖으로 나가지 않습니다. saved_places 테이블 자체의
-- RLS 정책(select/insert/delete 본인 것만)은 전혀 건드리지 않습니다.
-- ============================================================

create or replace function public.top_saved_places(p_limit int default 5)
returns table (
  kakao_place_id text,
  place_name text,
  category_name text,
  address text,
  lat double precision,
  lng double precision,
  place_url text,
  phone text,
  save_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    kakao_place_id,
    max(place_name) as place_name,
    max(category_name) as category_name,
    max(address) as address,
    max(lat) as lat,
    max(lng) as lng,
    max(place_url) as place_url,
    max(phone) as phone,
    count(*) as save_count
  from public.saved_places
  group by kakao_place_id
  order by save_count desc, place_name asc
  limit greatest(p_limit, 0);
$$;

-- 익명(비로그인) 방문자도 홈 화면 랭킹을 볼 수 있어야 하므로 anon도 포함
revoke all on function public.top_saved_places(int) from public;
grant execute on function public.top_saved_places(int) to anon, authenticated;
