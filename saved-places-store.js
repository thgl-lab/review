/* ============================================================
 * 여기찜 — 담기(찜) 데이터 저장소 (Supabase saved_places 테이블)
 * ============================================================
 * place-search.js / home.js / Mypage.js가 공통으로 사용합니다.
 * 이 스크립트보다 먼저 config.js, supabase-js, auth.js가
 * 로드되어 있어야 합니다.
 *
 * 테이블 생성 SQL: saved-places-schema.sql 참고
 * ============================================================ */

window.YeogiJjimSaves = (function () {
  function getClient() {
    return window.YeogiJjimAuth ? window.YeogiJjimAuth.getClient() : null;
  }

  function toRow(userId, place) {
    return {
      user_id: userId,
      kakao_place_id: String(place.id),
      place_name: place.place_name,
      category_name: place.category_name || null,
      address: place.road_address_name || place.address_name || null,
      lat: place.y ? Number(place.y) : null,
      lng: place.x ? Number(place.x) : null,
      place_url: place.place_url || null,
      phone: place.phone || null,
      situation_tags: [],
    };
  }

  /* 로그인한 사용자가 담은 가게의 kakao_place_id 집합 */
  async function listSavedIds(userId) {
    const client = getClient();
    if (!client || !userId) return new Set();

    const { data, error } = await client
      .from("saved_places")
      .select("kakao_place_id")
      .eq("user_id", userId);

    if (error) {
      console.error("[여기찜] 담은 가게 id 조회 실패", error);
      return new Set();
    }
    return new Set((data || []).map((row) => row.kakao_place_id));
  }

  async function save(userId, place) {
    const client = getClient();
    if (!client || !userId) return { error: new Error("로그인이 필요해요.") };
    return client.from("saved_places").insert(toRow(userId, place));
  }

  async function unsave(userId, kakaoPlaceId) {
    const client = getClient();
    if (!client || !userId) return { error: new Error("로그인이 필요해요.") };
    return client
      .from("saved_places")
      .delete()
      .eq("user_id", userId)
      .eq("kakao_place_id", String(kakaoPlaceId));
  }

  /* 맛집주머니(Mypage)용 — user_id로 직접 거르지 않고 RLS에 맡긴다.
     "select * from saved_places"만 보내도 정책상 본인 행만 돌아온다. */
  async function listMine() {
    const client = getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("saved_places")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[여기찜] 맛집주머니 조회 실패", error);
      return [];
    }
    return data || [];
  }

  /* 맛집주머니(Mypage)용 삭제 — 행의 id(PK)만 지정하고, 소유권 확인은 RLS에 맡긴다. */
  async function removeById(id) {
    const client = getClient();
    if (!client) return { error: new Error("로그인이 필요해요.") };
    return client.from("saved_places").delete().eq("id", id);
  }

  /* 맛집주머니(Mypage)용 — 상황 태그 전체 교체 (행의 id(PK) 기준, 소유권 확인은 RLS에 맡긴다). */
  async function updateTags(id, tags) {
    const client = getClient();
    if (!client) return { error: new Error("로그인이 필요해요.") };
    return client.from("saved_places").update({ situation_tags: tags }).eq("id", id);
  }

  return { listSavedIds, save, unsave, listMine, removeById, updateTags };
})();
