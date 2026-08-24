/* ============================================================
 * 여기찜 — 맛집주머니 (로그인한 사용자만 열람 가능)
 * ============================================================
 * 내가 담은 맛집을 Supabase saved_places 테이블에서 불러옵니다.
 * 조회 시 user_id로 따로 거르지 않고 전체를 요청하며, RLS 정책이
 * 알아서 본인 소유 행만 돌려줍니다. (saved-places-store.js#listMine)
 * ============================================================ */

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

async function applyAuthState(user) {
  if (user) {
    guardModalOpened = false;
    el.loginRequired.hidden = true;
    el.listWrap.hidden = false;
    await renderList();
    return;
  }

  el.loginRequired.hidden = false;
  el.listWrap.hidden = true;

  if (!guardModalOpened) {
    guardModalOpened = true;
    window.YeogiJjimAuth.openLoginModal("맛집주머니를 보려면 로그인이 필요해요.");
  }
}

/* ---------- 목록 렌더링 ---------- */
async function renderList() {
  const list = await window.YeogiJjimSaves.listMine();
  el.cardGrid.innerHTML = "";

  if (list.length === 0) {
    el.emptyState.hidden = false;
    el.resultMeta.textContent = "";
    return;
  }

  el.emptyState.hidden = true;
  el.resultMeta.textContent = `담은 맛집 ${list.length}곳`;
  list.forEach((row) => el.cardGrid.appendChild(buildCard(row)));
}

function buildCard(row) {
  const card = document.createElement("article");
  card.className = "place-card";

  const categorySegments = (row.category_name || "").split(">").map((s) => s.trim());
  const categoryChip = categorySegments[categorySegments.length - 1] || "기타";
  const address = row.address || "주소 정보 없음";

  card.innerHTML = `
    <button type="button" class="remove-x" aria-label="찜 삭제">✕</button>
    <div class="card-top">
      <span class="category-chip">${escapeHtml(categoryChip)}</span>
      <span class="saved-date">${formatSavedDate(row.created_at)}</span>
    </div>
    <h3 class="place-name">${escapeHtml(row.place_name)}</h3>
    <p class="place-address">${escapeHtml(address)}</p>
    <p class="place-category">${escapeHtml(row.category_name || "")}</p>
    <div class="card-footer">
      <a class="place-link" href="${escapeHtml(googleMapsUrl(row))}" target="_blank" rel="noopener noreferrer">구글맵 보기</a>
    </div>
  `;

  card.querySelector(".remove-x").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;

    const { error } = await window.YeogiJjimSaves.removeById(row.id);
    if (error) {
      console.error("[여기찜] 맛집주머니 삭제 실패", error);
      alert("삭제 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
      btn.disabled = false;
      return;
    }

    card.remove();
    const remaining = el.cardGrid.children.length;
    el.resultMeta.textContent = remaining > 0 ? `담은 맛집 ${remaining}곳` : "";
    if (remaining === 0) el.emptyState.hidden = false;
  });

  return card;
}

/* ---------- 유틸 ---------- */
function formatSavedDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day} 담음`;
}

function googleMapsUrl(row) {
  const query = row.lat && row.lng
    ? `${row.lat},${row.lng}`
    : `${row.place_name || ""} ${row.address || ""}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
