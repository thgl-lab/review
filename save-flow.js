/* ============================================================
 * 여기찜 — 담기/취소 공용 처리
 * ============================================================
 * place-search.js, home.js의 "담기" 버튼이 공유합니다.
 * - 담을 때: 상황 태그 선택 모달을 띄운 뒤 그 태그로 저장합니다.
 *   모달을 닫으면(X/배경/Esc) 담기 자체를 취소합니다.
 * - 취소할 때: 확인 모달에서 "확인"을 눌러야 실제로 취소됩니다.
 *
 * auth.js, saved-places-store.js, ui-modals.js가 먼저 로드되어
 * 있어야 합니다.
 * ============================================================ */

window.YeogiJjimSaveFlow = (function () {
  async function handleSaveClick(btn, place) {
    const auth = window.YeogiJjimAuth;
    const user = auth ? await auth.getCurrentUser() : null;

    if (!user) {
      if (auth) auth.openLoginModal("로그인하면 담을 수 있어요.");
      return;
    }

    if (btn.disabled || !window.YeogiJjimSaves) return;
    const wasSaved = btn.classList.contains("saved");

    if (wasSaved) {
      await handleUnsave(btn, place, user);
    } else {
      await handleSave(btn, place, user);
    }
  }

  async function handleUnsave(btn, place, user) {
    const ok = window.YeogiJjimConfirm
      ? await window.YeogiJjimConfirm.ask(`"${place.place_name}" 담기를 취소할까요?`)
      : true;
    if (!ok) return;

    btn.disabled = true;
    const { error } = await window.YeogiJjimSaves.unsave(user.id, place.id);
    btn.disabled = false;

    if (error) {
      console.error("[여기찜] 담기 취소 실패", error);
      alert("취소 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    btn.classList.remove("saved");
    btn.textContent = "담기";
  }

  async function handleSave(btn, place, user) {
    let tags = [];
    if (window.YeogiJjimTagPicker) {
      const picked = await window.YeogiJjimTagPicker.open(place.place_name);
      if (picked === null) return; // 태그 선택 창을 닫음 = 담기 취소
      tags = picked;
    }

    btn.disabled = true;
    const { error } = await window.YeogiJjimSaves.save(user.id, place, tags);
    btn.disabled = false;

    if (error) {
      console.error("[여기찜] 담기 처리 실패", error);
      alert("담기 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    btn.classList.add("saved");
    btn.textContent = "담음 ✓";
  }

  return { handleSaveClick };
})();
