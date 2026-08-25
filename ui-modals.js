/* ============================================================
 * 여기찜 — 담기/취소용 공용 모달 (상황 태그 선택 + 확인창)
 * ============================================================
 * window.SITUATION_TAGS(situation-tags.js)를 사용하므로 이 스크립트보다
 * situation-tags.js가 먼저 로드되어 있어야 합니다.
 *
 * window.YeogiJjimTagPicker.open(placeName)
 *   → Promise<string[] | null>. 태그 없이 "담기"를 눌러도 빈 배열([])이
 *     반환되며, X/배경 클릭/Esc로 닫으면 담기 자체를 취소한 것으로 보고
 *     null을 반환합니다.
 *
 * window.YeogiJjimConfirm.ask(message)
 *   → Promise<boolean>. 확인을 누르면 true, 취소/X/배경 클릭/Esc는 false.
 * ============================================================ */

(function () {
  const style = document.createElement("style");
  style.textContent = `
    .yj-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(74, 63, 59, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 1000;
    }
    .yj-modal-overlay[hidden] { display: none; }

    .yj-modal-box {
      width: 100%;
      max-width: 360px;
      background: #fff;
      border-radius: 20px;
      padding: 28px 24px;
      box-shadow: 0 24px 48px -16px rgba(74, 63, 59, 0.35);
      position: relative;
      font-family: 'Wanted Sans Variable', -apple-system, sans-serif;
    }

    .yj-modal-close {
      position: absolute;
      top: 14px;
      right: 16px;
      border: none;
      background: none;
      font-size: 18px;
      line-height: 1;
      color: var(--warmgray, #4A3F3B);
      opacity: 0.5;
      cursor: pointer;
      padding: 4px;
    }
    .yj-modal-close:hover { opacity: 1; }

    .yj-modal-box h2 {
      font-family: 'MitmiFont', 'Wanted Sans Variable', sans-serif;
      font-weight: 400;
      font-size: 21px;
      color: var(--warmgray, #4A3F3B);
      margin: 0 0 6px;
    }
    .yj-modal-desc {
      font-size: 13px;
      color: var(--warmgray, #4A3F3B);
      opacity: 0.75;
      margin: 0 0 18px;
      line-height: 1.5;
    }

    .yj-tag-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 22px;
    }
    .yj-tag-chip {
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      border: 1.5px solid var(--pink, #FDACAC);
      background: #fff;
      color: var(--warmgray, #4A3F3B);
      padding: 9px 15px;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    }
    .yj-tag-chip.active {
      background: var(--coral, #FD7979);
      border-color: var(--coral, #FD7979);
      color: #fff;
    }

    .yj-modal-actions {
      display: flex;
      gap: 10px;
    }
    .yj-modal-actions button {
      flex: 1;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      padding: 12px 10px;
      border-radius: 12px;
      cursor: pointer;
      border: none;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }
    .yj-modal-primary {
      background: var(--coral, #FD7979);
      color: #fff;
    }
    .yj-modal-secondary {
      background: #fff;
      color: var(--warmgray, #4A3F3B);
      border: 1.5px solid var(--pink, #FDACAC) !important;
    }
  `;
  document.head.appendChild(style);

  function buildOverlay(bodyHtml) {
    const overlay = document.createElement("div");
    overlay.className = "yj-modal-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="yj-modal-box" role="dialog" aria-modal="true">
        <button type="button" class="yj-modal-close" aria-label="닫기">✕</button>
        ${bodyHtml}
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function wireDismiss(overlay, onDismiss) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) onDismiss();
    });
    overlay.querySelector(".yj-modal-close").addEventListener("click", onDismiss);
    function onKeydown(e) {
      if (e.key === "Escape" && !overlay.hidden) onDismiss();
    }
    document.addEventListener("keydown", onKeydown);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /* ---------- 상황 태그 선택 모달 ---------- */
  const tagOverlay = buildOverlay(`
    <h2>어떤 상황에서 담나요?</h2>
    <p class="yj-modal-desc" id="yjTagDesc"></p>
    <div class="yj-tag-chips" id="yjTagChips"></div>
    <div class="yj-modal-actions">
      <button type="button" class="yj-modal-primary" id="yjTagConfirm">담기</button>
    </div>
  `);
  const tagDesc = tagOverlay.querySelector("#yjTagDesc");
  const tagChipsWrap = tagOverlay.querySelector("#yjTagChips");
  const tagConfirmBtn = tagOverlay.querySelector("#yjTagConfirm");
  let tagResolve = null;
  let tagSelected = new Set();

  function closeTagPicker(result) {
    tagOverlay.hidden = true;
    if (tagResolve) {
      const resolve = tagResolve;
      tagResolve = null;
      resolve(result);
    }
  }

  wireDismiss(tagOverlay, () => closeTagPicker(null));
  tagConfirmBtn.addEventListener("click", () => closeTagPicker(Array.from(tagSelected)));

  window.YeogiJjimTagPicker = {
    open(placeName) {
      tagSelected = new Set();
      tagDesc.textContent = placeName
        ? `"${placeName}" — 태그는 안 골라도 담을 수 있고, 나중에 맛집주머니에서 바꿀 수 있어요.`
        : "태그는 안 골라도 담을 수 있고, 나중에 맛집주머니에서 바꿀 수 있어요.";

      const tags = window.SITUATION_TAGS || [];
      tagChipsWrap.innerHTML = "";
      tags.forEach((tag) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "yj-tag-chip";
        chip.textContent = tag;
        chip.addEventListener("click", () => {
          if (tagSelected.has(tag)) tagSelected.delete(tag);
          else tagSelected.add(tag);
          chip.classList.toggle("active", tagSelected.has(tag));
        });
        tagChipsWrap.appendChild(chip);
      });

      tagOverlay.hidden = false;
      return new Promise((resolve) => {
        tagResolve = resolve;
      });
    },
  };

  /* ---------- 확인 모달 ---------- */
  const confirmOverlay = buildOverlay(`
    <h2 id="yjConfirmTitle">확인해주세요</h2>
    <p class="yj-modal-desc" id="yjConfirmDesc"></p>
    <div class="yj-modal-actions">
      <button type="button" class="yj-modal-secondary" id="yjConfirmCancel">취소</button>
      <button type="button" class="yj-modal-primary" id="yjConfirmOk">확인</button>
    </div>
  `);
  const confirmDesc = confirmOverlay.querySelector("#yjConfirmDesc");
  const confirmOkBtn = confirmOverlay.querySelector("#yjConfirmOk");
  const confirmCancelBtn = confirmOverlay.querySelector("#yjConfirmCancel");
  let confirmResolve = null;

  function closeConfirm(result) {
    confirmOverlay.hidden = true;
    if (confirmResolve) {
      const resolve = confirmResolve;
      confirmResolve = null;
      resolve(result);
    }
  }

  wireDismiss(confirmOverlay, () => closeConfirm(false));
  confirmOkBtn.addEventListener("click", () => closeConfirm(true));
  confirmCancelBtn.addEventListener("click", () => closeConfirm(false));

  window.YeogiJjimConfirm = {
    ask(message) {
      confirmDesc.textContent = message || "";
      confirmOverlay.hidden = false;
      return new Promise((resolve) => {
        confirmResolve = resolve;
      });
    },
  };
})();
