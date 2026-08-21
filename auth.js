/* ============================================================
 * 여기찜 — 로그인 / 회원가입 (Supabase Auth)
 * ============================================================
 * ⚠️ 설정 안내
 * SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY는 config.js에 둡니다.
 * config.example.js를 config.js로 복사한 뒤 값을 채우고,
 * 각 HTML 페이지에서 이 스크립트보다 먼저
 *   1) config.js
 *   2) https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
 * 를 로드하세요. 또한 로그인 버튼이 나타날 자리에
 *   <div id="authArea"></div>
 * 를 넣어두면 이 스크립트가 알아서 채워줍니다.
 *
 * 다른 기능에서 로그인 여부를 확인하려면:
 *   const user = await window.YeogiJjimAuth.getCurrentUser();
 *   if (!user) { ... 로그인 필요 안내 ... }
 * 로그인 상태가 바뀔 때마다 알림을 받고 싶다면:
 *   window.YeogiJjimAuth.onAuthChange((user) => { ... });
 * ============================================================ */

(function () {
  function hasValidSupabaseConfig() {
    return (
      typeof SUPABASE_URL !== "undefined" &&
      typeof SUPABASE_PUBLISHABLE_KEY !== "undefined" &&
      SUPABASE_URL &&
      SUPABASE_PUBLISHABLE_KEY &&
      SUPABASE_URL !== "YOUR_SUPABASE_PROJECT_URL_HERE" &&
      SUPABASE_PUBLISHABLE_KEY !== "YOUR_SUPABASE_PUBLISHABLE_KEY_HERE"
    );
  }

  if (!hasValidSupabaseConfig()) {
    console.warn(
      "[여기찜] SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY가 설정되지 않아 로그인 기능을 사용할 수 없어요. config.example.js를 config.js로 복사한 뒤 값을 채워주세요."
    );
    window.YeogiJjimAuth = {
      getClient: () => null,
      getCurrentUser: async () => null,
      getSession: async () => null,
      onAuthChange: () => () => {},
      signOut: async () => {},
      openLoginModal: () => {},
    };
    return;
  }

  if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
    console.error("[여기찜] supabase-js 라이브러리를 불러오지 못했어요. CDN 스크립트가 auth.js보다 먼저 로드되었는지 확인해주세요.");
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  /* ---------- 에러 메시지 한국어 변환 ---------- */
  function translateAuthError(error) {
    if (!error) return "문제가 발생했어요. 잠시 후 다시 시도해주세요.";
    const code = error.code || "";
    const msg = (error.message || "").toLowerCase();

    if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
      return "이메일 또는 비밀번호가 올바르지 않아요.";
    }
    if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) {
      return "이미 가입된 이메일이에요.";
    }
    if (code === "weak_password" || msg.includes("password should be at least")) {
      return "비밀번호는 6자 이상으로 입력해주세요.";
    }
    if (code === "email_address_invalid" || msg.includes("unable to validate email") || msg.includes("invalid email")) {
      return "이메일 형식을 확인해주세요.";
    }
    if (code === "over_email_send_rate_limit" || msg.includes("rate limit")) {
      return "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
    }
    if (code === "signup_disabled") {
      return "현재 회원가입이 열려있지 않아요.";
    }
    if (msg.includes("failed to fetch") || msg.includes("network")) {
      return "네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
    }
    return "문제가 발생했어요. 잠시 후 다시 시도해주세요.";
  }

  /* ---------- 스타일 주입 ---------- */
  const style = document.createElement("style");
  style.textContent = `
    .yj-auth-login-btn {
      font-family: 'Wanted Sans Variable', -apple-system, sans-serif;
      font-size: 13.5px;
      font-weight: 700;
      background: var(--coral, #FD7979);
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 12px;
      line-height: normal;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .yj-auth-login-btn:hover { transform: translateY(-2px); }

    .yj-auth-user {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'Wanted Sans Variable', -apple-system, sans-serif;
      font-size: 13.5px;
      color: var(--warmgray, #4A3F3B);
    }
    .yj-auth-user strong { color: var(--coral, #FD7979); }
    .yj-auth-logout-btn {
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 700;
      background: #fff;
      color: var(--warmgray, #4A3F3B);
      border: 1.5px solid var(--pink, #FDACAC);
      padding: 7px 14px;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .yj-auth-logout-btn:hover { background: var(--pink, #FDACAC); }

    .yj-auth-overlay {
      position: fixed;
      inset: 0;
      background: rgba(74, 63, 59, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 1000;
    }
    .yj-auth-overlay[hidden] { display: none; }

    .yj-auth-modal {
      width: 100%;
      max-width: 360px;
      background: #fff;
      border-radius: 20px;
      padding: 28px 24px;
      box-shadow: 0 24px 48px -16px rgba(74, 63, 59, 0.35);
      position: relative;
    }

    .yj-auth-close {
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
    .yj-auth-close:hover { opacity: 1; }

    .yj-auth-modal h2 {
      font-family: 'MitmiFont', 'Wanted Sans Variable', sans-serif;
      font-weight: 400;
      font-size: 22px;
      color: var(--warmgray, #4A3F3B);
      margin: 0 0 6px;
    }
    .yj-auth-modal .yj-auth-desc {
      font-size: 13px;
      color: var(--warmgray, #4A3F3B);
      opacity: 0.7;
      margin: 0 0 20px;
      line-height: 1.5;
    }

    .yj-auth-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
    }
    .yj-auth-field label {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--warmgray, #4A3F3B);
    }
    .yj-auth-field input {
      font-family: 'Wanted Sans Variable', -apple-system, sans-serif;
      font-size: 15px;
      padding: 12px 14px;
      border: 1.5px solid var(--pink, #FDACAC);
      border-radius: 12px;
      background: var(--cream, #FEEAC9);
      color: var(--warmgray, #4A3F3B);
      outline: none;
    }
    .yj-auth-field input:focus { border-color: var(--coral, #FD7979); }

    .yj-auth-error {
      font-size: 13px;
      font-weight: 600;
      color: var(--coral, #FD7979);
      margin: -4px 0 14px;
      line-height: 1.5;
      min-height: 0;
    }
    .yj-auth-error:empty { display: none; }

    .yj-auth-actions {
      display: flex;
      gap: 10px;
      margin-top: 4px;
    }
    .yj-auth-actions button {
      flex: 1;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      padding: 12px 10px;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }
    .yj-auth-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
    .yj-auth-signin {
      background: var(--coral, #FD7979);
      color: #fff;
      border: none;
    }
    .yj-auth-signup {
      background: #fff;
      color: var(--coral, #FD7979);
      border: 1.5px solid var(--coral, #FD7979);
    }
  `;
  document.head.appendChild(style);

  /* ---------- 모달 DOM 생성 ---------- */
  const overlay = document.createElement("div");
  overlay.className = "yj-auth-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="yj-auth-modal" role="dialog" aria-modal="true" aria-labelledby="yjAuthTitle">
      <button type="button" class="yj-auth-close" aria-label="닫기">✕</button>
      <h2 id="yjAuthTitle">로그인 · 회원가입</h2>
      <p class="yj-auth-desc">이메일과 비밀번호로 로그인하거나,<br>처음이라면 회원가입 후 바로 이용해보세요.</p>
      <form id="yjAuthForm" novalidate>
        <div class="yj-auth-field">
          <label for="yjAuthEmail">이메일</label>
          <input type="email" id="yjAuthEmail" autocomplete="email" required>
        </div>
        <div class="yj-auth-field">
          <label for="yjAuthPassword">비밀번호</label>
          <input type="password" id="yjAuthPassword" autocomplete="current-password" required minlength="6">
        </div>
        <p class="yj-auth-error" id="yjAuthError"></p>
        <div class="yj-auth-actions">
          <button type="submit" class="yj-auth-signin" id="yjAuthSignInBtn">로그인</button>
          <button type="button" class="yj-auth-signup" id="yjAuthSignUpBtn">회원가입</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const form = overlay.querySelector("#yjAuthForm");
  const emailInput = overlay.querySelector("#yjAuthEmail");
  const passwordInput = overlay.querySelector("#yjAuthPassword");
  const errorEl = overlay.querySelector("#yjAuthError");
  const signInBtn = overlay.querySelector("#yjAuthSignInBtn");
  const signUpBtn = overlay.querySelector("#yjAuthSignUpBtn");
  const closeBtn = overlay.querySelector(".yj-auth-close");

  function openModal(message) {
    errorEl.textContent = message || "";
    form.reset();
    overlay.hidden = false;
    emailInput.focus();
  }
  function closeModal() {
    overlay.hidden = true;
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  closeBtn.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  function setBusy(busy) {
    signInBtn.disabled = busy;
    signUpBtn.disabled = busy;
  }

  async function handleSignIn(e) {
    e.preventDefault();
    errorEl.textContent = "";
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    setBusy(true);
    const { error } = await client.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) {
      errorEl.textContent = translateAuthError(error);
      return;
    }
    closeModal();
  }

  async function handleSignUp() {
    errorEl.textContent = "";
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      errorEl.textContent = "이메일과 비밀번호를 모두 입력해주세요.";
      return;
    }

    setBusy(true);
    const { data, error } = await client.auth.signUp({ email, password });
    setBusy(false);

    if (error) {
      errorEl.textContent = translateAuthError(error);
      return;
    }

    if (data.session) {
      closeModal();
      return;
    }

    errorEl.style.color = "";
    errorEl.textContent = "가입 확인 메일이 발송되었어요. 메일함을 확인해주세요.";
  }

  form.addEventListener("submit", handleSignIn);
  signUpBtn.addEventListener("click", handleSignUp);

  /* ---------- 로그인 상태 UI (authArea) ---------- */
  function renderAuthAreas(user) {
    const areas = document.querySelectorAll("#authArea, .yj-auth-area");
    areas.forEach((area) => {
      area.innerHTML = "";
      if (user) {
        const displayName = (user.user_metadata && user.user_metadata.name) || (user.email || "").split("@")[0];
        const wrap = document.createElement("div");
        wrap.className = "yj-auth-user";
        wrap.innerHTML = `<span><strong>${escapeHtml(displayName)}</strong>님</span>`;
        const logoutBtn = document.createElement("button");
        logoutBtn.type = "button";
        logoutBtn.className = "yj-auth-logout-btn";
        logoutBtn.textContent = "로그아웃";
        logoutBtn.addEventListener("click", () => client.auth.signOut());
        wrap.appendChild(logoutBtn);
        area.appendChild(wrap);
      } else {
        const loginBtn = document.createElement("button");
        loginBtn.type = "button";
        loginBtn.className = "yj-auth-login-btn";
        loginBtn.textContent = "로그인";
        loginBtn.addEventListener("click", () => openModal());
        area.appendChild(loginBtn);
      }
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /* ---------- 세션 구독 ---------- */
  const changeListeners = new Set();

  client.auth.onAuthStateChange((_event, session) => {
    const user = session ? session.user : null;
    renderAuthAreas(user);
    changeListeners.forEach((cb) => cb(user));
  });

  /* ---------- 다른 기능에서 가져다 쓰는 공개 API ---------- */
  window.YeogiJjimAuth = {
    getClient: () => client,
    getCurrentUser: async () => {
      const { data } = await client.auth.getSession();
      return data.session ? data.session.user : null;
    },
    getSession: async () => {
      const { data } = await client.auth.getSession();
      return data.session;
    },
    onAuthChange: (callback) => {
      changeListeners.add(callback);
      return () => changeListeners.delete(callback);
    },
    signOut: () => client.auth.signOut(),
    openLoginModal: openModal,
  };
})();
