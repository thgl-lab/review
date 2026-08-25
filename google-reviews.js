/* ============================================================
 * 여기찜 — 구글 리뷰 보기 (Places API (New))
 * ============================================================
 * ⚠️ API 키 설정 안내
 * GOOGLE_PLACES_API_KEY는 이 파일이 아니라 config.js에 둡니다.
 * config.example.js를 참고해 발급받은 키를 채워 넣고, 구글 클라우드
 * 콘솔에서 "Places API (New)"를 사용 설정한 뒤, 키 제한 > HTTP 리퍼러에
 * 이 페이지를 여는 도메인을 등록하세요 (키가 브라우저에 노출되므로 필수).
 * ============================================================ */

const GOOGLE_TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_MATCH_RADIUS_METERS = 150; // 도보 약 2분 거리
const GOOGLE_REVIEW_CACHE_KEY = "yeogijjim_google_reviews_cache";
const GOOGLE_PHOTO_CACHE_KEY = "yeogijjim_google_photo_cache";
const GOOGLE_PHOTO_MAX_WIDTH_PX = 480;
// 화면에서 쓰는 5개 정보만 요청: 가게이름, 별점, 리뷰 개수, 리뷰내용들, 구글맵 링크
// (매칭 검증용 location, 캐시 키용 id는 별도로 함께 요청)
const GOOGLE_FIELD_MASK = [
  "places.id",
  "places.location",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.reviews",
  "places.googleMapsUri",
].join(",");
// 검색 결과 카드 썸네일용 최소 필드. rating/reviews를 빼서 리뷰 조회보다
// 가벼운 요청으로 유지한다 (카드마다 자동으로 호출되므로).
const GOOGLE_PHOTO_FIELD_MASK = [
  "places.id",
  "places.location",
  "places.displayName",
  "places.photos",
].join(",");

function hasValidGoogleApiKey() {
  return (
    typeof GOOGLE_PLACES_API_KEY !== "undefined" &&
    GOOGLE_PLACES_API_KEY &&
    GOOGLE_PLACES_API_KEY !== "YOUR_GOOGLE_PLACES_API_KEY_HERE"
  );
}

/* ---------- 거리 계산 (Haversine) ---------- */
function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/* ---------- 캐시 (localStorage) ---------- */
function getCachedEntry(cacheKey, placeId) {
  const cache = JSON.parse(localStorage.getItem(cacheKey) || "{}");
  return cache[placeId] || null;
}

function setCachedEntry(cacheKey, placeId, result) {
  if (result.status === "error") return; // 일시적 오류는 캐시하지 않음
  const cache = JSON.parse(localStorage.getItem(cacheKey) || "{}");
  cache[placeId] = result;
  localStorage.setItem(cacheKey, JSON.stringify(cache));
}

function getCachedReview(placeId) {
  return getCachedEntry(GOOGLE_REVIEW_CACHE_KEY, placeId);
}

function setCachedReview(placeId, result) {
  setCachedEntry(GOOGLE_REVIEW_CACHE_KEY, placeId, result);
}

/* ---------- 구글 Places API (New) 호출 ---------- */
async function fetchGoogleReviews(placeName, coord) {
  if (!hasValidGoogleApiKey()) {
    return { status: "error", message: "구글 API 키가 설정되지 않았어요. config.js에 GOOGLE_PLACES_API_KEY를 채워주세요." };
  }

  let res;
  try {
    res = await fetch(GOOGLE_TEXT_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: placeName,
        languageCode: "ko",
        regionCode: "KR",
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: { latitude: coord.lat, longitude: coord.lng },
            radius: GOOGLE_MATCH_RADIUS_METERS,
          },
        },
      }),
    });
  } catch (err) {
    console.error(err);
    return { status: "error", message: "네트워크 오류로 리뷰를 불러오지 못했어요." };
  }

  if (!res.ok) {
    return { status: "error", message: `구글 검색 중 오류가 발생했어요. (HTTP ${res.status})` };
  }

  const data = await res.json();
  const places = data.places || [];

  // locationBias는 결과를 강하게 보장하지 않으므로, 실제 좌표 거리를 다시 검증한다.
  const match = places.find((p) => {
    const loc = p.location;
    return loc && haversineDistanceMeters(coord.lat, coord.lng, loc.latitude, loc.longitude) <= GOOGLE_MATCH_RADIUS_METERS;
  });

  if (!match) {
    return { status: "not_found" };
  }

  return {
    status: "found",
    name: match.displayName?.text || placeName,
    rating: typeof match.rating === "number" ? match.rating : null,
    userRatingCount: match.userRatingCount || 0,
    reviews: (match.reviews || []).map((r) => ({
      author: r.authorAttribution?.displayName || "익명",
      rating: typeof r.rating === "number" ? r.rating : 0,
      relativeTime: r.relativePublishTimeDescription || "",
      text: r.text?.text || "",
    })),
    mapsUri: match.googleMapsUri || "",
  };
}

/* ---------- 구글 Places 사진 조회 (검색 결과 카드 썸네일) ---------- */
function buildPhotoMediaUrl(photoName) {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${GOOGLE_PHOTO_MAX_WIDTH_PX}&key=${GOOGLE_PLACES_API_KEY}`;
}

async function fetchGooglePlacePhoto(placeName, coord) {
  if (!hasValidGoogleApiKey()) return { status: "error", reason: "no_api_key" };

  let res;
  try {
    res = await fetch(GOOGLE_TEXT_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": GOOGLE_PHOTO_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: placeName,
        languageCode: "ko",
        regionCode: "KR",
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: { latitude: coord.lat, longitude: coord.lng },
            radius: GOOGLE_MATCH_RADIUS_METERS,
          },
        },
      }),
    });
  } catch (err) {
    return { status: "error", reason: "network" };
  }

  if (!res.ok) return { status: "error", reason: `http_${res.status}` };

  const data = await res.json();
  const places = data.places || [];
  const match = places.find((p) => {
    const loc = p.location;
    return loc && haversineDistanceMeters(coord.lat, coord.lng, loc.latitude, loc.longitude) <= GOOGLE_MATCH_RADIUS_METERS;
  });

  if (!match) return { status: "not_found", reason: "no_match_nearby" };
  if (!match.photos || !match.photos.length) return { status: "not_found", reason: "no_photos_on_google" };

  return { status: "found", photoUrl: buildPhotoMediaUrl(match.photos[0].name) };
}

/* 검색 결과 카드에 자동으로(클릭 없이) 사진을 채워 넣는다 */
async function loadPlacePhoto(card, place) {
  const wrapEl = card.querySelector(".card-photo");
  const imgEl = card.querySelector(".place-photo");
  if (!wrapEl || !imgEl) return;

  if (!place.id || Number.isNaN(parseFloat(place.y)) || Number.isNaN(parseFloat(place.x))) {
    console.warn(`[여기찜] 사진 조회 생략: "${place.place_name}" — id/좌표 정보가 없어요.`, place);
    return;
  }

  const cached = getCachedEntry(GOOGLE_PHOTO_CACHE_KEY, place.id);
  const result =
    cached ||
    (await fetchGooglePlacePhoto(place.place_name, {
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
    }));
  if (!cached) setCachedEntry(GOOGLE_PHOTO_CACHE_KEY, place.id, result);

  if (result.status !== "found" || !result.photoUrl) {
    console.warn(`[여기찜] 사진 없음: "${place.place_name}" — ${result.reason || result.status}`);
    return;
  }

  imgEl.addEventListener("load", () => wrapEl.classList.add("loaded"), { once: true });
  imgEl.addEventListener(
    "error",
    () => console.warn(`[여기찜] 사진 로드 실패(깨진 링크): "${place.place_name}"`),
    { once: true }
  );
  imgEl.src = result.photoUrl;
  imgEl.hidden = false;
}

/* ---------- 리뷰 패널 렌더링 ---------- */
async function loadReviewPanel(panel, place) {
  panel.innerHTML = `<p class="review-loading">리뷰를 불러오는 중...</p>`;
  panel.dataset.loaded = "true";

  const cached = getCachedReview(place.id);
  const result =
    cached ||
    (await fetchGoogleReviews(place.place_name, {
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
    }));
  if (!cached) setCachedReview(place.id, result);

  renderReviewPanel(panel, result);

  if (result.status === "found" && result.reviews.length > 0) {
    runAiAnalysis(panel, place, result.reviews);
  }
}

function renderReviewPanel(panel, result) {
  if (result.status === "not_found") {
    panel.innerHTML = `<p class="review-empty">구글에서 이 가게를 찾을 수 없어요.</p>`;
    return;
  }
  if (result.status === "error") {
    panel.innerHTML = `<p class="review-empty">${escapeHtml(result.message)}</p>`;
    return;
  }

  const starsLabel = result.rating != null ? `⭐ ${result.rating.toFixed(1)}` : "평점 정보 없음";

  const reviewsHtml = result.reviews.length
    ? result.reviews
        .map(
          (r) => `
        <li class="review-item">
          <div class="review-item-top">
            <span class="review-author">${escapeHtml(r.author)}</span>
            <span class="review-stars">${"⭐".repeat(Math.round(r.rating))}</span>
          </div>
          <p class="review-time">${escapeHtml(r.relativeTime)}</p>
          <p class="review-text">${escapeHtml(r.text)}</p>
        </li>`
        )
        .join("")
    : `<li class="review-item review-item-empty">아직 등록된 리뷰가 없어요.</li>`;

  panel.innerHTML = `
    <h4 class="review-place-name">${escapeHtml(result.name)}</h4>
    <p class="review-summary">${starsLabel} · 리뷰 ${Number(result.userRatingCount).toLocaleString()}개</p>
    <ul class="review-list">${reviewsHtml}</ul>
    ${
      result.mapsUri
        ? `<a class="review-maps-link" href="${escapeHtml(result.mapsUri)}" target="_blank" rel="noopener noreferrer">구글 지도에서 전체 리뷰 보기 →</a>`
        : ""
    }
    ${result.reviews.length > 0 ? `<div class="ai-analysis"></div>` : ""}
  `;
}

/* ---------- 카드 리뷰 패널 토글 ---------- */
function toggleReviewPanel(card) {
  const panel = card.querySelector(".review-panel");
  const hint = card.querySelector(".review-hint");
  if (!panel) return;

  const opening = panel.hidden;
  panel.hidden = !opening;
  card.classList.toggle("panel-open", opening);
  if (hint) hint.textContent = opening ? "리뷰 접기 ▴" : "리뷰 보기 ▾";

  if (opening && panel.dataset.loaded !== "true") {
    loadReviewPanel(panel, JSON.parse(card.dataset.place));
  }
}
