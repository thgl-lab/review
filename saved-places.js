/* ============================================================
 * 여기찜 — 찜 목록 (로그인한 사용자만 열람 가능)
 * ============================================================
 * 담은 맛집은 place-search.js와 동일하게 이 브라우저의
 * localStorage(SAVED_PLACES_KEY)에 저장된 목록을 그대로 보여줍니다.
 * ============================================================ */

const SAVED_PLACES_KEY = "yeogijjim_saved_places";

const el = {};
let guardModalOpened = false;

document.addEventListener("DOMContentLoaded", () => {
  el.loginRequired = document.getElementById("loginRequired");
  el.listWrap = document.getElementById("listWrap");
  el.cardGrid = document.getElementById("cardGrid");
  el.emptyState = document.getElementById("emptyState");
  el.resultMeta = document.getElementById("resultMeta");

  init();
});

async function init() {
  if (!window.YeogiJjimAuth) return;

  const user = await window.YeogiJjimAuth.getCurrentUser();
  applyAuthState(user);
  window.YeogiJjimAuth.onAuthChange(applyAuthState);
}

function applyAuthState(user) {
  if (user) {
    guardModalOpened = false;
    el.loginRequired.hidden = true;
    el.listWrap.hidden = false;
    renderList();
    return;
  }

  el.loginRequired.hidden = false;
  el.listWrap.hidden = true;

  if (!guardModalOpened) {
    guardModalOpened = true;
    window.YeogiJjimAuth.openLoginModal("찜 목록을 보려면 로그인이 필요해요.");
  }
}

/* ---------- 목록 렌더링 ---------- */
function getSavedList() {
  return JSON.parse(localStorage.getItem(SAVED_PLACES_KEY) || "[]");
}

function setSavedList(list) {
  localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(list));
}

function renderList() {
  const list = getSavedList();
  el.cardGrid.innerHTML = "";

  if (list.length === 0) {
    el.emptyState.hidden = false;
    el.resultMeta.textContent = "";
    return;
  }

  el.emptyState.hidden = true;
  el.resultMeta.textContent = `담은 맛집 ${list.length}곳`;
  list.forEach((place) => el.cardGrid.appendChild(buildCard(place)));
}

function buildCard(place) {
  const card = document.createElement("article");
  card.className = "place-card";

  const categorySegments = (place.category_name || "").split(">").map((s) => s.trim());
  const categoryChip = categorySegments[categorySegments.length - 1] || "기타";
  const address = place.road_address_name || place.address_name || "주소 정보 없음";

  card.innerHTML = `
    <div class="card-top">
      <span class="category-chip">${escapeHtml(categoryChip)}</span>
      <button type="button" class="remove-btn">찜 해제</button>
    </div>
    <h3 class="place-name">${escapeHtml(place.place_name)}</h3>
    <p class="place-address">${escapeHtml(address)}</p>
    <p class="place-category">${escapeHtml(place.category_name || "")}</p>
    <div class="card-footer">
      ${place.phone ? `<span class="place-phone">${escapeHtml(place.phone)}</span>` : "<span></span>"}
      <a class="place-link" href="${escapeHtml(place.place_url)}" target="_blank" rel="noopener noreferrer">카카오맵에서 보기</a>
    </div>
  `;

  card.querySelector(".remove-btn").addEventListener("click", () => {
    setSavedList(getSavedList().filter((p) => p.id !== place.id));
    renderList();
  });

  return card;
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
