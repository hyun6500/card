/* ================================================================
   main.js - 부팅
   ================================================================ */
async function boot() {
  document.getElementById("hello").textContent = S.user.name + "님";
  document.getElementById("main").innerHTML = '<div class="loading">불러오는 중...</div>';
  try {
    await loadAll();
    render();
  } catch (e) {
    document.getElementById("main").innerHTML =
      '<div class="empty">데이터를 불러오지 못했어요.<br>' + esc(e.message) + '</div>';
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
  document.getElementById("logout").onclick = () => {
    if (confirm("로그아웃할까요?")) logout();
  };

  if (await tryAutoLogin()) {
    document.getElementById("login").classList.add("hide");
    document.getElementById("app").classList.remove("hide");
    await boot();
  } else {
    showLogin();
  }
});
