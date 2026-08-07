/* ================================================================
   auth.js — 아이디/비밀번호 로그인 (가족용 간단 인증)
   비밀번호 검증은 Apps Script 서버에서 하고,
   통과한 자격은 이 기기 localStorage에 보관해 자동 로그인한다.
   ================================================================ */
const AUTH_KEY = "cardapp_auth";

function savedAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; }
}

async function tryAutoLogin() {
  const a = savedAuth();
  if (!a) return false;
  S.user = a;
  try {
    await api("login");
    return true;
  } catch (e) {
    S.user = null;
    localStorage.removeItem(AUTH_KEY);
    return false;
  }
}

function showLogin() {
  const box = document.getElementById("login");
  box.classList.remove("hide");
  document.getElementById("app").classList.add("hide");
  const idI = document.getElementById("li-id"), pwI = document.getElementById("li-pw");
  const btn = document.getElementById("li-btn"), err = document.getElementById("li-err");

  async function go() {
    const id = idI.value.trim(), pw = pwI.value;
    if (!id || !pw) { err.textContent = "아이디와 비밀번호를 입력하세요."; return; }
    btn.disabled = true; btn.textContent = "확인 중...";
    err.textContent = "";
    S.user = { id, pw };
    try {
      const out = await api("login");
      S.user.name = out.name || id;
      localStorage.setItem(AUTH_KEY, JSON.stringify(S.user));
      box.classList.add("hide");
      document.getElementById("app").classList.remove("hide");
      await boot();
    } catch (e) {
      S.user = null;
      err.textContent = e.message.indexOf("아이디") >= 0 || e.message.indexOf("비밀번호") >= 0
        ? e.message : "로그인에 실패했습니다. " + e.message;
    }
    btn.disabled = false; btn.textContent = "들어가기";
  }
  btn.onclick = go;
  pwI.onkeydown = e => { if (e.key === "Enter") go(); };
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  location.reload();
}
