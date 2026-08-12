/* ================================================================
   main.js - 부팅
   ================================================================ */
function hideSplash() {
  const sp = document.getElementById("splash");
  if (sp) sp.classList.add("hide");
}

/* 저장해둔 데이터가 있으면 먼저 그리고, 서버 응답은 뒤따라 반영한다. */
async function boot(preloaded) {
  document.getElementById("hello").textContent = S.user.name + "님";
  const main = document.getElementById("main");

  if (preloaded) {
    applyRows(preloaded);
    render(); showVersions(); hideSplash();
    return;
  }

  const hadCache = cacheLoad();
  if (hadCache) { render(); showVersions(); hideSplash(); }
  else main.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    await loadAll();
    render(); showVersions();
  } catch (e) {
    if (!hadCache) {
      main.innerHTML = '<div class="empty">데이터를 불러오지 못했어요.<br>' + esc(e.message)
        + '<br><br><button class="mini" onclick="location.reload()">다시 시도</button></div>';
    } else {
      toast("최신 내용을 못 받아왔어요. 저장된 내용을 보여드립니다.", true);
    }
  }
  hideSplash();
}

function showVersions() {
  const want = CONFIG.SERVER_EXPECTED;
  const sv = S.server;
  const box = document.getElementById("ver");
  if (!sv) { box.textContent = CONFIG.APP_VERSION; return; }
  // 화면 버전과 서버 버전은 따로 움직인다. 서버가 요구 버전에 못 미칠 때만 알린다.
  if (sv === want) { box.textContent = CONFIG.APP_VERSION + " (서버 " + sv + ")"; box.classList.remove("bad"); }
  else {
    box.textContent = "서버 " + sv + ", " + want + " 필요. Apps Script를 새 버전으로 재배포하세요";
    box.classList.add("bad");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("ver").textContent = CONFIG.APP_VERSION;
  document.querySelectorAll(".tabbar button").forEach(b => {
    b.onclick = () => {
      if (S.tab === b.dataset.tab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      S.tab = b.dataset.tab;
      render();
    };
  });
  document.getElementById("fab").onclick = openAnalyze;
  document.getElementById("logout").onclick = () => {
    if (confirm("로그아웃할까요?")) logout();
  };

  // 화면을 켜둔 채 날짜가 바뀌면 D-day가 옛날 값으로 남는다. 돌아올 때 다시 그린다.
  let lastDay = fDate(today());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !S.user) return;
    const now = fDate(today());
    if (now !== lastDay) { lastDay = now; render(); }
  });

  const saved = savedAuth();
  if (!saved) { hideSplash(); showLogin(); return; }

  // 저장된 로그인 정보가 있으면 화면부터 띄우고, 확인과 조회를 한 번에 처리한다
  S.user = saved;
  if (cacheLoad()) {
    document.getElementById("app").classList.remove("hide");
    document.getElementById("hello").textContent = S.user.name + "님";
    render(); hideSplash();
  }
  try {
    const out = await api("boot");
    S.user.name = out.name || S.user.name;
    document.getElementById("app").classList.remove("hide");
    await boot(out);
  } catch (e) {
    if (/아이디|비밀번호/.test(e.message)) {
      S.user = null; cacheClear(); localStorage.removeItem(AUTH_KEY);
      document.getElementById("app").classList.add("hide");
      hideSplash(); showLogin();
    } else if (S.cards.length || S.events.length) {
      hideSplash();
      toast("최신 내용을 못 받아왔어요. 저장된 내용을 보여드립니다.", true);
    } else {
      document.getElementById("app").classList.remove("hide");
      document.getElementById("main").innerHTML =
        '<div class="empty">연결하지 못했어요.<br>' + esc(e.message)
        + '<br><br><button class="mini" onclick="location.reload()">다시 시도</button></div>';
      hideSplash();
    }
  }
});
