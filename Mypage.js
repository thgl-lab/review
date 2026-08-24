/* ============================================================
 * 여기찜 — 맛집주머니 (로그인한 사용자만 열람 가능)
 * ============================================================
 * 내가 담은 맛집을 Supabase saved_places 테이블에서 불러옵니다.
 * 조회 시 user_id로 따로 거르지 않고 전체를 요청하며, RLS 정책이
 * 알아서 본인 소유 행만 돌려줍니다. (saved-places-store.js#listMine)
 *
 * 상황 태그(situation_tags)는 담을 때는 비워두고, 이 화면에서
 * 카드마다 칩을 눌러 나중에 붙입니다. 상단 필터 바에서 태그
 * 하나를 고르면 그 태그가 붙은 카드만 보여줍니다.
 * ============================================================ */

const el = {};
let guardModalOpened = false;
let allRows = [];
let activeFilter = null; // null = 전체

document.addEventListener("DOMContentLoaded", () => {
  el.loginRequired = document.getElementById("loginRequired");
  el.listWrap = document.getElementById("listWrap");
  el.tagFilterBar = document.getElementById("tagFilterBar");
  el.cardGrid = document.getElementById("cardGrid");
  el.emptyState = document.getElementById("emptyState");
  el.filterEmptyState = document.getElementById("filterEmptyState");
  el.resultMeta = document.getElementById("resultMeta");

  buildFilterBar();
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
    await loadList();
    return;
  }

  el.loginRequired.hidden = false;
  el.listWrap.hidden = true;

  if (!guardModalOpened) {
    guardModalOpened = true;
    window.YeogiJjimAuth.openLoginModal("맛집주머니를 보려면 로그인이 필요해요.");
  }
}

/* ---------- 상단 상황 태그 필터 바 ---------- */
function getTagFromUrl() {
  const tag = new URLSearchParams(window.location.search).get("tag");
  return tag && (window.SITUATION_TAGS || []).includes(tag) ? tag : null;
}

function buildFilterBar() {
  const tags = window.SITUATION_TAGS || [];
  activeFilter = getTagFromUrl();
  el.tagFilterBar.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "tag-filter-chip" + (activeFilter ? "" : " active");
  allChip.textContent = "전체";
  allChip.dataset.tag = "";
  el.tagFilterBar.appendChild(allChip);

  tags.forEach((tag) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-filter-chip" + (tag === activeFilter ? " active" : "");
    chip.textContent = tag;
    chip.dataset.tag = tag;
    el.tagFilterBar.appendChild(chip);
  });

  el.tagFilterBar.addEventListener("click", (e) => {
    const chip = e.target.closest(".tag-filter-chip");
    if (!chip) return;

    activeFilter = chip.dataset.tag || null;
    el.tagFilterBar.querySelectorAll(".tag-filter-chip").forEach((c) => {
      c.classList.toggle("active", c === chip);
    });
    renderList();
  });
}

/* ---------- 목록 불러오기 + 렌더링 ---------- */
async function loadList() {
  allRows = await window.YeogiJjimSaves.listMine();
  renderList();
}

function renderList() {
  el.cardGrid.innerHTML = "";

  if (allRows.length === 0) {
    el.emptyState.hidden = false;
    el.filterEmptyState.hidden = true;
    el.resultMeta.textContent = "";
    return;
  }
  el.emptyState.hidden = true;

  const visibleRows = activeFilter
    ? allRows.filter((row) => (row.situation_tags || []).includes(activeFilter))
    : allRows;

  if (visibleRows.length === 0) {
    el.filterEmptyState.hidden = false;
    el.filterEmptyState.textContent = `"${activeFilter}" 태그를 붙인 맛집이 아직 없어요. 카드에서 태그를 눌러 붙여보세요.`;
    el.resultMeta.textContent = "";
    return;
  }
  el.filterEmptyState.hidden = true;

  el.resultMeta.textContent = activeFilter
    ? `"${activeFilter}" 태그 · ${visibleRows.length}곳`
    : `담은 맛집 ${visibleRows.length}곳`;

  visibleRows.forEach((row) => el.cardGrid.appendChild(buildCard(row)));
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
    <div class="tag-edit-row"></div>
    <div class="card-footer">
      <a class="place-link" href="${escapeHtml(googleMapsUrl(row))}" target="_blank" rel="noopener noreferrer">구글맵 보기</a>
    </div>
  `;

  renderTagEditRow(card, row);

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

    allRows = allRows.filter((r) => r.id !== row.id);
    renderList();
  });

  return card;
}

/* ---------- 카드 안 상황 태그 편집 ---------- */
function renderTagEditRow(card, row) {
  const wrap = card.querySelector(".tag-edit-row");
  const tags = window.SITUATION_TAGS || [];
  wrap.innerHTML = "";

  tags.forEach((tag) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-edit-chip" + ((row.situation_tags || []).includes(tag) ? " active" : "");
    chip.textContent = tag;
    chip.addEventListener("click", () => toggleTag(row, tag, chip));
    wrap.appendChild(chip);
  });
}

async function toggleTag(row, tag, chip) {
  if (chip.disabled) return;
  const current = row.situation_tags || [];
  const nextTags = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];

  chip.disabled = true;
  const { error } = await window.YeogiJjimSaves.updateTags(row.id, nextTags);
  chip.disabled = false;

  if (error) {
    console.error("[여기찜] 상황 태그 수정 실패", error);
    alert("태그 저장 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
    return;
  }

  row.situation_tags = nextTags;
  chip.classList.toggle("active", nextTags.includes(tag));

  // 필터가 걸려있는 상태에서 태그를 뗐다면 이 카드는 더 이상 보이면 안 되므로 다시 그린다.
  if (activeFilter && !nextTags.includes(tag)) {
    renderList();
  }
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
