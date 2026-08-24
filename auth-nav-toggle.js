/* ============================================================
 * 여기찜 — 로그인해야 보이는 내비게이션 링크 토글
 * ============================================================
 * class="auth-required-link"가 붙은 요소(맛집주머니로 가는
 * 헤더/탭바 링크 등)를 로그인 상태에 따라 보이거나 숨깁니다.
 * 모든 페이지가 공유하며, auth.js보다 나중에 로드되어야 합니다.
 * ============================================================ */

(function () {
  function toggleAuthLinks(user) {
    document.querySelectorAll(".auth-required-link").forEach((el) => {
      el.hidden = !user;
    });
  }

  if (window.YeogiJjimAuth) {
    window.YeogiJjimAuth.getCurrentUser().then(toggleAuthLinks);
    window.YeogiJjimAuth.onAuthChange(toggleAuthLinks);
  }
})();
