/* ============================================================
 * 여기찜 — 맛집 담기 (카카오 로컬 API 검색)
 * ============================================================
 * ⚠️ API 키 설정 안내
 * REST API 키는 이 파일이 아니라 config.js에 둡니다. config.js는
 * .gitignore에 등록되어 있어 커밋되지 않습니다. config.example.js를
 * 복사해 config.js로 저장한 뒤 키를 채워 넣고, place-search.html에서
 * config.js를 이 스크립트보다 먼저 로드하세요.
 * ============================================================ */

/* ---------- 상수 ---------- */
const KEYWORD_ENDPOINT = "https://dapi.kakao.com/v2/local/search/keyword.json";
const CATEGORY_ENDPOINT = "https://dapi.kakao.com/v2/local/search/category.json";
const FOOD_CATEGORY_CODE = "FD6"; // 음식점 카테고리 코드
const PAGE_SIZE = 15;
const CATEGORY_RADIUS = 2000; // m, 카테고리 검색 반경
const DEFAULT_COORD = { x: 126.9779692, y: 37.5662952 }; // 서울시청 (위치 접근 실패 시 대체 좌표)
const SAVED_PLACES_KEY = "yeogijjim_saved_places";

function hasValidApiKey() {
  return (
    typeof KAKAO_REST_API_KEY !== "undefined" &&
    KAKAO_REST_API_KEY &&
    KAKAO_REST_API_KEY !== "YOUR_KAKAO_REST_API_KEY_HERE"
  );
}

/* ---------- 상태 ---------- */
const state = {
  mode: "keyword", // 'keyword' | 'category'
  page: 1,
  isEnd: false,
  loading: false,
  lastQueryLabel: "",
  coord: null,
};

/* ---------- DOM ---------- */
const el = {
  tabs: null,
  keywordForm: null,
  categoryForm: null,
  keywordInput: null,
  onlyFood: null,
  keywordSearchBtn: null,
  locateBtn: null,
  locateStatus: null,
  resultMeta: null,
  cardGrid: null,
  loadMoreBtn: null,
  emptyState: null,
  errorState: null,
  keyWarning: null,
};

document.addEventListener("DOMContentLoaded", () => {
  el.tabs = document.querySelectorAll(".tab");
  el.keywordForm = document.getElementById("keywordForm");
  el.categoryForm = document.getElementById("categoryForm");
  el.keywordInput = document.getElementById("keywordInput");
  el.onlyFood = document.getElementById("onlyFood");
  el.keywordSearchBtn = document.getElementById("keywordSearchBtn");
  el.locateBtn = document.getElementById("locateBtn");
  el.locateStatus = document.getElementById("locateStatus");
  el.resultMeta = document.getElementById("resultMeta");
  el.cardGrid = document.getElementById("cardGrid");
  el.loadMoreBtn = document.getElementById("loadMoreBtn");
  el.emptyState = document.getElementById("emptyState");
  el.errorState = document.getElementById("errorState");
  el.keyWarning = document.getElementById("keyWarning");

  if (!hasValidApiKey()) {
    el.keyWarning.hidden = false;
  }

  el.tabs.forEach((btn) => btn.addEventListener("click", () => switchMode(btn.dataset.mode)));

  el.keywordForm.addEventListener("submit", (e) => {
    e.preventDefault();
    runKeywordSearch(true);
  });

  el.onlyFood.addEventListener("change", () => {
    if (el.keywordInput.value.trim()) runKeywordSearch(true);
  });

  el.locateBtn.addEventListener("click", handleLocate);

  el.loadMoreBtn.addEventListener("click", () => {
    if (state.mode === "keyword") runKeywordSearch(false);
    else runCategorySearch(false);
  });

  el.cardGrid.addEventListener("click", (e) => {
    const saveBtn = e.target.closest(".save-btn");
    if (saveBtn) {
      toggleSave(saveBtn);
      return;
    }

    if (e.target.closest("a")) return; // 카카오맵 링크 등은 그대로 동작
    if (e.target.closest(".review-panel")) return; // 열린 리뷰 패널 내부 클릭은 무시

    const card = e.target.closest(".place-card");
    if (card) toggleReviewPanel(card);
  });
});

/* ---------- 탭 전환 ---------- */
function switchMode(mode) {
  state.mode = mode;
  el.tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
  el.keywordForm.hidden = mode !== "keyword";
  el.categoryForm.hidden = mode !== "category";
  resetResults();
}

/* ---------- 결과 초기화 ---------- */
function resetResults() {
  state.page = 1;
  state.isEnd = false;
  el.cardGrid.innerHTML = "";
  el.resultMeta.textContent = "";
  el.loadMoreBtn.hidden = true;
  el.emptyState.hidden = true;
  el.errorState.hidden = true;
}

/* ---------- 키워드 검색 ---------- */
async function runKeywordSearch(isNewQuery) {
  const query = el.keywordInput.value.trim();
  if (!query) {
    el.keywordInput.focus();
    return;
  }
  if (isNewQuery) {
    resetResults();
    state.lastQueryLabel = `"${query}" 검색 결과`;
  }
  if (state.loading || state.isEnd) return;

  const params = {
    query,
    page: state.page,
    size: PAGE_SIZE,
  };
  if (el.onlyFood.checked) params.category_group_code = FOOD_CATEGORY_CODE;

  await runSearch(KEYWORD_ENDPOINT, params, el.keywordSearchBtn);
}

/* ---------- 카테고리 검색 (음식점, 내 위치 기준) ---------- */
function handleLocate() {
  el.locateStatus.textContent = "위치 확인 중...";
  el.locateBtn.disabled = true;

  if (!navigator.geolocation) {
    state.coord = DEFAULT_COORD;
    el.locateStatus.textContent = "위치 정보를 지원하지 않아 서울시청 기준으로 검색해요.";
    startCategorySearch();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.coord = { x: pos.coords.longitude, y: pos.coords.latitude };
      el.locateStatus.textContent = "내 위치 기준으로 검색했어요.";
      startCategorySearch();
    },
    () => {
      state.coord = DEFAULT_COORD;
      el.locateStatus.textContent = "위치 접근이 거부되어 서울시청 기준으로 검색해요.";
      startCategorySearch();
    },
    { timeout: 5000 }
  );
}

function startCategorySearch() {
  el.locateBtn.disabled = false;
  resetResults();
  state.lastQueryLabel = "근처 음식점 검색 결과";
  runCategorySearch(true);
}

async function runCategorySearch() {
  if (!state.coord) {
    handleLocate();
    return;
  }
  if (state.loading || state.isEnd) return;

  const params = {
    category_group_code: FOOD_CATEGORY_CODE,
    x: state.coord.x,
    y: state.coord.y,
    radius: CATEGORY_RADIUS,
    sort: "distance",
    page: state.page,
    size: PAGE_SIZE,
  };

  await runSearch(CATEGORY_ENDPOINT, params, el.locateBtn);
}

/* ---------- 공통 요청 처리 ---------- */
async function runSearch(endpoint, params, triggerBtn) {
  if (!hasValidApiKey()) {
    showError("카카오 REST API 키가 설정되지 않았어요. config.example.js를 config.js로 복사한 뒤 키를 채워주세요.");
    return;
  }

  state.loading = true;
  if (triggerBtn) triggerBtn.disabled = true;
  el.loadMoreBtn.disabled = true;
  el.loadMoreBtn.textContent = "불러오는 중...";
  el.errorState.hidden = true;

  const url = new URL(endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        showError("인증에 실패했어요. REST API 키가 올바른지, 카카오 디벨로퍼스에 도메인이 등록되어 있는지 확인해주세요.");
      } else {
        showError(`검색 중 오류가 발생했어요. (HTTP ${res.status})`);
      }
      return;
    }

    const data = await res.json();
    renderResults(data);
  } catch (err) {
    showError("네트워크 오류로 검색에 실패했어요. 잠시 후 다시 시도해주세요.");
    console.error(err);
  } finally {
    state.loading = false;
    if (triggerBtn) triggerBtn.disabled = false;
    el.loadMoreBtn.disabled = false;
    el.loadMoreBtn.textContent = "더 보기";
  }
}

/* ---------- 결과 렌더링 ---------- */
function renderResults(data) {
  const places = data.documents || [];
  const meta = data.meta || {};

  if (state.page === 1) {
    el.cardGrid.innerHTML = "";
  }

  if (places.length === 0 && state.page === 1) {
    el.emptyState.hidden = false;
    el.resultMeta.textContent = "";
    el.loadMoreBtn.hidden = true;
    return;
  }

  el.emptyState.hidden = true;
  el.resultMeta.textContent = `${state.lastQueryLabel} · 총 ${Number(meta.pageable_count || 0).toLocaleString()}건`;

  const savedIds = getSavedIds();
  places.forEach((place) => {
    el.cardGrid.appendChild(buildCard(place, savedIds.has(place.id)));
  });

  state.isEnd = !!meta.is_end;
  el.loadMoreBtn.hidden = state.isEnd;
  if (!state.isEnd) state.page += 1;
}

function buildCard(place, isSaved) {
  const card = document.createElement("article");
  card.className = "place-card";

  const categorySegments = (place.category_name || "").split(">").map((s) => s.trim());
  const categoryChip = categorySegments[categorySegments.length - 1] || "기타";
  const address = place.road_address_name || place.address_name || "주소 정보 없음";

  card.innerHTML = `
    <div class="card-top">
      <span class="category-chip">${escapeHtml(categoryChip)}</span>
      <button type="button" class="save-btn ${isSaved ? "saved" : ""}" data-id="${escapeHtml(place.id)}">
        ${isSaved ? "담음 ✓" : "담기"}
      </button>
    </div>
    <h3 class="place-name">${escapeHtml(place.place_name)}</h3>
    <p class="place-address">${escapeHtml(address)}</p>
    <p class="place-category">${escapeHtml(place.category_name || "")}</p>
    <div class="card-footer">
      ${place.phone ? `<span class="place-phone">${escapeHtml(place.phone)}</span>` : "<span></span>"}
      <a class="place-link" href="${escapeHtml(place.place_url)}" target="_blank" rel="noopener noreferrer">카카오맵에서 보기</a>
    </div>
    <p class="review-hint">리뷰 보기 ▾</p>
    <div class="review-panel" hidden></div>
  `;

  card.dataset.place = JSON.stringify(place);
  card.querySelector(".save-btn").dataset.place = JSON.stringify(place);
  return card;
}

/* ---------- 담기 (localStorage 임시 저장) ---------- */
function getSavedIds() {
  const list = JSON.parse(localStorage.getItem(SAVED_PLACES_KEY) || "[]");
  return new Set(list.map((p) => p.id));
}

function toggleSave(btn) {
  const place = JSON.parse(btn.dataset.place);
  const list = JSON.parse(localStorage.getItem(SAVED_PLACES_KEY) || "[]");
  const idx = list.findIndex((p) => p.id === place.id);

  if (idx >= 0) {
    list.splice(idx, 1);
    btn.classList.remove("saved");
    btn.textContent = "담기";
  } else {
    list.push(place);
    btn.classList.add("saved");
    btn.textContent = "담음 ✓";
  }
  localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(list));
}

/* ---------- 에러 표시 ---------- */
function showError(message) {
  el.errorState.hidden = false;
  el.errorState.textContent = message;
  el.emptyState.hidden = true;
}

/* ---------- 유틸 ---------- */
function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
