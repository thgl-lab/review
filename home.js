/* ============================================================
 * 여기찜 — 홈 화면: 인기 랭킹 TOP5 + 로그인 맞춤 추천
 * ============================================================
 * 인기 랭킹: Supabase Postgres 함수 top_saved_places()를 호출합니다.
 *   이 함수는 SECURITY DEFINER로 saved_places의 RLS를 우회해
 *   "가게별로 담긴 횟수"만 집계해서 돌려주고, 누가 담았는지는
 *   전혀 내보내지 않습니다. (top-saved-places-function.sql 참고)
 *
 * 맞춤 추천: 로그인한 사용자 본인의 saved_places를 읽습니다.
 *   user_id로 따로 거르지 않고 select만 보내도 RLS 정책 덕분에
 *   본인이 담은 행만 돌아옵니다. 그중 가장 자주 담은 카테고리를 찾고,
 *   카카오 로컬 API로 같은 카테고리의 다른 가게를 검색해 이미 담은
 *   곳은 제외하고 보여줍니다.
 * ============================================================ */

const HOME_KEYWORD_ENDPOINT = "https://dapi.kakao.com/v2/local/search/keyword.json";
const HOME_FOOD_CATEGORY_CODE = "FD6";

function homeHasValidApiKey() {
  return (
    typeof KAKAO_REST_API_KEY !== "undefined" &&
    KAKAO_REST_API_KEY &&
    KAKAO_REST_API_KEY !== "YOUR_KAKAO_REST_API_KEY_HERE"
  );
}

document.addEventListener("DOMContentLoaded", () => {
  initRanking();
  initRecommend();
});

/* ---------- 인기 랭킹 TOP5 ---------- */
async function initRanking() {
  const grid = document.getElementById("rankGrid");
  const empty = document.getElementById("rankEmpty");
  if (!grid || !window.YeogiJjimAuth) return;

  const client = window.YeogiJjimAuth.getClient();
  if (!client) return;

  const { data, error } = await client.rpc("top_saved_places", { p_limit: 5 });

  if (error) {
    console.error("[여기찜] 인기 랭킹 조회 실패", error);
    empty.hidden = false;
    empty.textContent = "랭킹을 불러오지 못했어요.";
    return;
  }

  if (!data || data.length === 0) {
    empty.hidden = false;
    return;
  }

  const user = await window.YeogiJjimAuth.getCurrentUser();
  const savedIds = user && window.YeogiJjimSaves
    ? await window.YeogiJjimSaves.listSavedIds(user.id)
    : new Set();

  grid.innerHTML = "";
  data.forEach((row, i) => {
    const card = buildRankCard(row, i + 1, savedIds.has(String(row.kakao_place_id)));
    grid.appendChild(card);
    if (typeof loadPlacePhoto === "function") loadPlacePhoto(card, rankRowToPlace(row));
  });
}

function buildRankCard(row, rank, isSaved) {
  const card = document.createElement("article");
  card.className = "rank-card";

  const categoryChip = leafCategory(row.category_name);

  card.innerHTML = `
    <div class="card-photo">
      <span class="photo-fallback" aria-hidden="true">🍽️</span>
      <img class="place-photo" alt="" loading="lazy" hidden>
    </div>
    <span class="rank-badge">${rank}위</span>
    <div class="rank-card-top">
      <span class="rank-category">${escapeHtml(categoryChip)}</span>
      <span class="rank-count">🔥 ${Number(row.save_count).toLocaleString()}번 담김</span>
    </div>
    <h3 class="rank-name">${escapeHtml(row.place_name)}</h3>
    <p class="rank-address">${escapeHtml(row.address || "주소 정보 없음")}</p>
    <div class="rank-actions">
      <button type="button" class="rank-save-btn ${isSaved ? "saved" : ""}">${isSaved ? "담음 ✓" : "담기"}</button>
      ${kakaoMapLink(row.place_url, row.place_name, row.lat, row.lng)}
    </div>
  `;

  card.querySelector(".rank-save-btn").addEventListener("click", (e) => handleSaveClick(e.currentTarget, rankRowToPlace(row)));
  return card;
}

function rankRowToPlace(row) {
  return {
    id: row.kakao_place_id,
    place_name: row.place_name,
    category_name: row.category_name,
    road_address_name: row.address,
    x: row.lng,
    y: row.lat,
    place_url: row.place_url,
    phone: row.phone,
  };
}

/* ---------- 맞춤 추천 ---------- */
let recommendRunToken = 0;

async function initRecommend() {
  const section = document.getElementById("recommendSection");
  const grid = document.getElementById("recommendGrid");
  const empty = document.getElementById("recommendEmpty");
  const sub = document.getElementById("recommendSub");
  if (!section || !window.YeogiJjimAuth) return;

  const els = { section, grid, empty, sub };

  window.YeogiJjimAuth.onAuthChange((user) => renderRecommend(user, els));
  const user = await window.YeogiJjimAuth.getCurrentUser();
  await renderRecommend(user, els);
}

async function renderRecommend(user, els) {
  const myToken = ++recommendRunToken;

  if (!user) {
    els.section.hidden = true;
    els.grid.innerHTML = "";
    return;
  }

  els.section.hidden = false;
  els.grid.innerHTML = "";
  els.empty.hidden = true;

  const client = window.YeogiJjimAuth.getClient();
  const { data: mine, error } = await client
    .from("saved_places")
    .select("kakao_place_id, category_name");

  if (myToken !== recommendRunToken) return;

  if (error) {
    console.error("[여기찜] 맞춤 추천용 데이터 조회 실패", error);
    els.empty.hidden = false;
    els.empty.textContent = "추천을 불러오지 못했어요.";
    return;
  }

  if (!mine || mine.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent = "아직 담은 맛집이 없어요. 맛집을 담으면 취향에 맞는 추천을 받아볼 수 있어요.";
    return;
  }

  const savedIds = new Set(mine.map((r) => String(r.kakao_place_id)));
  const topCategory = mostFrequentCategory(mine);

  if (!topCategory) {
    els.empty.hidden = false;
    els.empty.textContent = "카테고리를 분석할 수 없어요.";
    return;
  }

  els.sub.textContent = `자주 담은 "${topCategory}" 카테고리에서 골라봤어요.`;

  if (!homeHasValidApiKey()) {
    els.empty.hidden = false;
    els.empty.textContent = "카카오 API 키가 설정되지 않아 추천을 불러올 수 없어요.";
    return;
  }

  const places = await fetchCategoryPlaces(topCategory, savedIds);
  if (myToken !== recommendRunToken) return;

  if (places.length === 0) {
    els.empty.hidden = false;
    els.empty.textContent = `"${topCategory}" 카테고리에서 새로 추천할 만한 곳을 찾지 못했어요.`;
    return;
  }

  places.slice(0, 5).forEach((place) => {
    els.grid.appendChild(buildRecommendCard(place));
  });
}

function mostFrequentCategory(rows) {
  const counts = new Map();
  rows.forEach((r) => {
    const leaf = leafCategory(r.category_name);
    if (!leaf) return;
    counts.set(leaf, (counts.get(leaf) || 0) + 1);
  });

  let top = null;
  let topCount = 0;
  counts.forEach((count, category) => {
    if (count > topCount) {
      top = category;
      topCount = count;
    }
  });
  return top;
}

async function fetchCategoryPlaces(categoryQuery, excludeIds) {
  const url = new URL(HOME_KEYWORD_ENDPOINT);
  url.searchParams.set("query", categoryQuery);
  url.searchParams.set("category_group_code", HOME_FOOD_CATEGORY_CODE);
  url.searchParams.set("size", "15");

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const documents = data.documents || [];
    return documents.filter((place) => !excludeIds.has(String(place.id)));
  } catch (err) {
    console.error("[여기찜] 맞춤 추천 검색 실패", err);
    return [];
  }
}

function buildRecommendCard(place) {
  const card = document.createElement("article");
  card.className = "rank-card";

  const categoryChip = leafCategory(place.category_name);
  const address = place.road_address_name || place.address_name || "주소 정보 없음";

  card.innerHTML = `
    <div class="rank-card-top">
      <span class="rank-category">${escapeHtml(categoryChip)}</span>
    </div>
    <h3 class="rank-name">${escapeHtml(place.place_name)}</h3>
    <p class="rank-address">${escapeHtml(address)}</p>
    <div class="rank-actions">
      <button type="button" class="rank-save-btn">담기</button>
      ${kakaoMapLink(place.place_url, place.place_name, place.y, place.x)}
    </div>
  `;

  card.querySelector(".rank-save-btn").addEventListener("click", (e) => handleSaveClick(e.currentTarget, place));
  return card;
}

/* ---------- 담기 공통 처리 ---------- */
async function handleSaveClick(btn, place) {
  await window.YeogiJjimSaveFlow.handleSaveClick(btn, place);
}

/* ---------- 유틸 ---------- */
function kakaoMapUrl(placeUrl, name, lat, lng) {
  if (placeUrl) return placeUrl;
  if (lat && lng) return `https://map.kakao.com/link/map/${encodeURIComponent(name || "")},${lat},${lng}`;
  if (name) return `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;
  return "";
}

function kakaoMapLink(placeUrl, name, lat, lng) {
  const url = kakaoMapUrl(placeUrl, name, lat, lng);
  if (!url) return "";
  return `<a class="rank-map-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">카카오맵에서 보기</a>`;
}

function leafCategory(categoryName) {
  const segments = (categoryName || "").split(">").map((s) => s.trim()).filter(Boolean);
  return segments[segments.length - 1] || "기타";
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
