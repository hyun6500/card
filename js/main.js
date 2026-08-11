/* ================================================================
   main.js - 부팅
   ================================================================ */
async function boot() {
  document.getElementById("hello").textContent = S.user.name + "님";
  document.getElementById("main").innerHTML = '<div class="loading">불러오는 중...</div>';
  try {
    await loadAll();
    render();
    showVersions();
  } catch (e) {
    document.getElementById("main").innerHTML =
      '<div class="empty">데이터를 불러오지 못했어요.<br>' + esc(e.message) + '</div>';
  }
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

  if (await tryAutoLogin()) {
    document.getElementById("login").classList.add("hide");
    document.getElementById("app").classList.remove("hide");
    await boot();
  } else {
    showLogin();
  }
});
