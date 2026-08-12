/* ================================================================
   auth.js - 아이디/비밀번호 로그인 (가족용 간단 인증)
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

  const btn = document.getElementById("li-btn");
  const err = document.getElementById("li-err");
  const loginBox = document.getElementById("li-login");
  const signupBox = document.getElementById("li-signup");
  let mode = "login";

  // 서버가 가입을 받는지, 초대 코드가 필요한지 먼저 확인한다
  api("config", {}, { tries: 2 }).then(c => {
    if (!c.signup) document.getElementById("li-seg").classList.add("hide");
    if (c.invite) document.getElementById("su-invite-wrap").classList.remove("hide");
  }).catch(() => { });

  document.querySelectorAll("#li-seg .seg-btn").forEach(b => {
    b.onclick = () => {
      mode = b.dataset.mode;
      document.querySelectorAll("#li-seg .seg-btn").forEach(x => x.classList.toggle("on", x === b));
      loginBox.classList.toggle("hide", mode !== "login");
      signupBox.classList.toggle("hide", mode !== "signup");
      btn.textContent = mode === "login" ? "들어가기" : "가입하고 시작하기";
      err.textContent = "";
    };
  });

  async function enter(id, pw, name) {
    S.user = { id, pw, name: name || id };
    // 로그인 확인과 데이터 조회를 한 번에 받아 첫 화면을 빨리 띄운다
    const out = await api("boot");
    S.user.name = out.name || id;
    localStorage.setItem(AUTH_KEY, JSON.stringify(S.user));
    box.classList.add("hide");
    document.getElementById("app").classList.remove("hide");
    await boot(out);
  }

  async function go() {
    err.textContent = "";
    btn.disabled = true;
    const label = mode === "login" ? "들어가기" : "가입하고 시작하기";
    btn.textContent = mode === "login" ? "확인 중..." : "가입 중...";
    try {
      if (mode === "login") {
        const id = document.getElementById("li-id").value.trim();
        const pw = document.getElementById("li-pw").value;
        if (!id || !pw) throw new Error("아이디와 비밀번호를 입력하세요.");
        await enter(id, pw);
      } else {
        const id = document.getElementById("su-id").value.trim();
        const pw = document.getElementById("su-pw").value;
        const name = document.getElementById("su-name").value.trim();
        const invite = document.getElementById("su-invite").value.trim();
        if (!id || !pw || !name) throw new Error("아이디, 비밀번호, 이름을 모두 입력하세요.");
        await api("signup", { newId: id, newPw: pw, newName: name, invite });
        await enter(id, pw, name);
      }
    } catch (e) {
      S.user = null;
      err.textContent = e.message;
    }
    btn.disabled = false;
    btn.textContent = label;
  }

  btn.onclick = go;
  ["li-pw", "su-name", "su-invite"].forEach(k => {
    const elm = document.getElementById(k);
    if (elm) elm.onkeydown = e => { if (e.key === "Enter") go(); };
  });
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  cacheClear();
  location.reload();
}
