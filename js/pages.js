/* ================================================================
   pages.js - 탭 렌더링과 모달
   탭: cards(내 카드) / promo(프로모션) / archive(아카이브)
   ================================================================ */

function render() {
  const main = document.getElementById("main");
  main.innerHTML = "";
  if (S.tab === "cards") renderCards(main);
  else if (S.tab === "promo") renderPromo(main);
  else if (S.tab === "report") renderReport(main);
  else renderArchive(main);
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab));
  window.scrollTo(0, 0);
}

/* ================================================================
   탭 1 - 내 카드
   ================================================================ */
function renderCards(main) {
  const sum = summary();
  const mine = S.cards.filter(c => c.owner === S.user.name && c.status !== "해지");

  main.appendChild(el(`
    <section class="hero">
      <div class="hero-label">도전 중인 혜택으로 들어올 돈</div>
      <div class="hero-num">${fWonFull(sum.expect)}<span class="won">원</span></div>
      <div class="hero-sub">받은 캐시백 ${fWonFull(sum.got)}원 | 참여 중 ${S.events.filter(e => e.status === "신청").length}건${sum.maybe ? " | 고민 중 " + fWon(sum.maybe) : ""}${sum.todo ? " | 확인할 것 " + sum.todo + "건" : ""}</div>
    </section>`));

  if (sum.urgent.length) {
    const u = sum.urgent[0];
    main.appendChild(el(`
      <section class="alert tapcard" data-ev="${u.ev.no}" tabindex="0" role="button">
        <span class="alert-dot"></span>
        <div><b>${esc(u.ev.issuer)} ${esc(u.b.kind || "혜택")}</b> 결제 마감 D-${u.dd}
        <div class="alert-sub">${u.b.need ? fWon(Math.max(0, u.b.need - (u.b.spent || 0))) + " 더 쓰면 " + fWon(u.b.back) : esc(u.b.summary || "")}</div></div>
        <span class="chev">&gt;</span>
      </section>`));
    main.lastChild.onclick = () => openEventDetail(u.ev.no);
  }

  const head = el(`<div class="sec-head"><h2>내 카드</h2><button class="mini" id="add-card">+ 카드 추가</button></div>`);
  main.appendChild(head);
  head.querySelector("#add-card").onclick = () => openCardForm(null);

  if (!mine.length) {
    main.appendChild(el(`<div class="empty">아직 등록한 카드가 없어요.<br>+ 카드 추가를 누르거나, 프로모션 탭에서 이벤트를 신청하면 카드가 자동으로 등록됩니다.</div>`));
  }

  mine.forEach(c => {
    const col = CONFIG.ISSUER_COLORS[c.issuer] || ["#333", "#666"];
    const img = cardImg(c);
    const j = judge(c.issuer, {});
    const dd = c.lastUse ? daysTo(addMonths(c.lastUse, CONFIG.DEFAULTS.noUse)) : null;
    const evs = S.events.filter(e => e.status === "신청" && e.issuer === c.issuer);
    const qs = evs.map(quitSafeDay).filter(Boolean);
    const qsMax = qs.length ? maxDate(qs) : null;
    const card = el(`
      <section class="ccard" style="--c1:${col[0]};--c2:${col[1]}">
        <div class="ccard-visual${img ? " has-img" : ""}">
          ${img ? `<img class="ccard-photo" src="${esc(img)}" alt="" referrerpolicy="no-referrer" onerror="this.closest('.ccard-visual').classList.remove('has-img');this.remove()">` : ""}
          <div class="ccard-issuer">${esc(c.issuer)}</div>
          <div class="ccard-name">${esc(c.name || "카드명 미입력")}</div>
          <div class="ccard-foot">
            <span>${esc(c.brand || "")}</span>
            <span class="ccard-chip"></span>
          </div>
        </div>
        <div class="ccard-info">
          <div class="row"><span>상태</span><b>${esc(c.status)}${c.status === "사용중" ? ' <i class="dot ok"></i>' : ""}</b></div>
          <div class="row"><span>최근 사용</span><b>${fDateK(c.lastUse)}</b></div>
          ${evs.length ? `<div class="row"><span>참여 프로모션</span><b>${evs.map(e => esc(e.platform || e.name)).join(", ")}</b></div>` : ""}
          ${qsMax ? `<div class="row warn"><span>해지 금지</span><b>${fDateK(qsMax)}까지 (캐시백 회수 방지)</b></div>` : ""}
          ${c.fee ? `<div class="row"><span>연회비</span><b>${fWon(c.fee)}</b></div>` : ""}
          <div class="ccard-btns">
            <button class="mini" data-act="use">오늘 사용 기록</button>
            <button class="mini ghost" data-act="edit">정보 수정</button>
          </div>
        </div>
      </section>`);
    card.querySelector('[data-act="use"]').onclick = async () => {
      try {
        await api("update", { table: "카드", no: c.no, fields: { "최근사용일": fDate(today()) } });
        toast(c.issuer + " 최근 사용일을 오늘로 기록했어요.");
        await loadAll(); render();
      } catch (e) { toast(e.message, true); }
    };
    card.querySelector('[data-act="edit"]').onclick = () => openCardForm(c);
    main.appendChild(card);
  });

  /* 카드사별 응모 가능 현황 */
  main.appendChild(el(`<div class="sec-head"><h2>카드사별 응모 가능</h2><span class="sec-sub">내 이력 기준 | 기본 조건</span></div>`));
  const grid = el(`<section class="issuer-grid"></section>`);
  CONFIG.ISSUERS.forEach(iss => {
    const j = judge(iss, {});
    const cell = el(`
      <div class="issuer-cell ${j.ok ? "ok" : "wait"}">
        <b>${esc(iss)}</b>
        <span>${j.ok ? "지금 가능" : "D-" + j.wait}</span>
        ${!j.ok && j.blocking.length ? `<small>${esc(j.blocking[0].label)}</small>` : ""}
      </div>`);
    grid.appendChild(cell);
  });
  main.appendChild(grid);
}

/* ---------- 카드 추가/수정 폼 ---------- */
function openCardForm(c) {
  const isNew = !c;
  c = c || { issuer: "", name: "", brand: "", channel: "온라인", issued: "", fee: "", lastUse: "", status: "사용중", quit: "", memo: "", image: "" };
  const m = openModal(`
    <h3>${isNew ? "카드 추가" : "카드 정보 수정"}</h3>
    <label>카드사<select id="cf-issuer">${CONFIG.ISSUERS.map(i => `<option ${i === c.issuer ? "selected" : ""}>${i}</option>`).join("")}</select></label>
    <label>카드명
      <div class="withbtn">
        <input id="cf-name" value="${esc(c.name)}" placeholder="예: zgm.일본여행카드">
        <button class="mini" id="cf-find">불러오기</button>
      </div>
    </label>
    <div id="cf-found"></div>
    <div class="two">
      <label>국제브랜드<select id="cf-brand"><option value=""></option>${CONFIG.BRANDS.map(b => `<option ${b === c.brand ? "selected" : ""}>${b}</option>`).join("")}</select></label>
      <label>발급채널<select id="cf-ch"><option ${c.channel === "온라인" ? "selected" : ""}>온라인</option><option ${c.channel === "오프라인" ? "selected" : ""}>오프라인</option></select></label>
    </div>
    <div class="two">
      <label>발급일<input id="cf-issued" type="date" value="${fDate(c.issued)}"></label>
      <label>연회비(원)<input id="cf-fee" type="number" value="${esc(c.fee)}"></label>
    </div>
    <div class="two">
      <label>최근 사용일<input id="cf-use" type="date" value="${fDate(c.lastUse)}"></label>
      <label>상태<select id="cf-status">${["사용중", "보유(미사용)", "해지"].map(s => `<option ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    </div>
    <label>해지일 (해지한 경우)<input id="cf-quit" type="date" value="${fDate(c.quit)}"></label>
    <label>카드 표지 이미지 주소 (선택)
      <input id="cf-image" value="${esc(c.image || "")}" placeholder="https://... .jpg">
    </label>
    <div id="cf-prev">${c.image ? `<img class="cf-prev-img" src="${esc(c.image)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('이 주소로는 이미지를 불러오지 못했어요.'))">` : ""}</div>
    <p class="hint">카드사 홈페이지나 카드고릴라에서 카드 그림을 길게 눌러 "이미지 주소 복사"한 값을 넣으면 됩니다. 주소만 저장하고 이미지는 어디에도 보관하지 않습니다.</p>
    <label>메모<input id="cf-memo" value="${esc(c.memo)}"></label>
    <div class="modal-btns">
      ${isNew ? "" : '<button class="mini ghost danger" id="cf-del">삭제</button>'}
      <button class="cta" id="cf-save">저장</button>
    </div>`);
  bindCardFinder(m);
  m.querySelector("#cf-save").onclick = async () => {
    const fields = {
      "카드사": m.querySelector("#cf-issuer").value, "카드명": m.querySelector("#cf-name").value.trim(),
      "브랜드": m.querySelector("#cf-brand").value, "발급채널": m.querySelector("#cf-ch").value,
      "발급일": m.querySelector("#cf-issued").value, "연회비": m.querySelector("#cf-fee").value,
      "최근사용일": m.querySelector("#cf-use").value, "상태": m.querySelector("#cf-status").value,
      "해지일": m.querySelector("#cf-quit").value, "메모": m.querySelector("#cf-memo").value,
      "이미지": m.querySelector("#cf-image").value.trim()
    };
    if (!fields["카드사"]) { toast("카드사를 선택하세요.", true); return; }
    try {
      if (isNew) await api("add", { table: "카드", fields });
      else await api("update", { table: "카드", no: c.no, fields });
      closeModal(); toast("저장했어요.");
      await loadAll(); render();
    } catch (e) { toast(e.message, true); }
  };
  if (!isNew) m.querySelector("#cf-del").onclick = async () => {
    if (!confirm(c.issuer + " " + (c.name || "") + " 카드를 삭제할까요?\n(이력 보존이 필요하면 삭제 대신 상태를 '해지'로 바꾸세요)")) return;
    try {
      await api("del", { table: "카드", no: c.no });
      closeModal(); toast("삭제했어요.");
      await loadAll(); render();
    } catch (e) { toast(e.message, true); }
  };
}

/* 카드명으로 카드 정보 불러오기 */
function bindCardFinder(m) {
  const btn = m.querySelector("#cf-find");
  const out = m.querySelector("#cf-found");
  if (!btn) return;

  btn.onclick = async () => {
    const q = m.querySelector("#cf-name").value.trim();
    if (!q) { toast("카드명을 먼저 입력하세요.", true); return; }
    btn.disabled = true; btn.textContent = "찾는 중";
    out.innerHTML = '<div class="find-load">카드사 홈페이지와 공시 자료를 찾고 있어요...</div>';
    try {
      const r = await api("cardinfo", { query: q });
      if (!r.candidates || !r.candidates.length) {
        out.innerHTML = '<div class="find-load">찾지 못했어요. 카드명을 정확히 적거나 직접 입력해 주세요.'
          + (r.grounded === false ? '<br>지금은 웹 검색 없이 찾는 중이라 덜 알려진 카드는 못 찾습니다.' : "") + "</div>";
      } else {
        out.innerHTML = `
          ${r.grounded === false ? '<div class="find-load warn">웹 검색이 막혀 있어 AI가 아는 범위로만 찾았습니다. 연회비와 실적 조건은 반드시 카드사 페이지에서 확인하세요.</div>' : ""}
          <div class="find-list">
            ${r.candidates.map((c, i) => `
              <button class="find-item" data-i="${i}">
                <div class="find-top"><b>${esc(c.name)}</b>${c.confidence === "추정" ? '<span class="pill wait">추정</span>' : ""}</div>
                ${c.image ? `<img class="find-img" src="${esc(c.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
                <div class="find-meta">${esc(c.issuer || "카드사 미상")}${c.brands ? " | " + esc(c.brands) : ""}${c.fee != null ? " | 연회비 " + fWonFull(c.fee) + "원" : ""}${c.prevSpend ? " | 전월실적 " + esc(c.prevSpend) : ""}</div>
                ${c.benefit ? `<div class="find-ben">${esc(c.benefit)}</div>` : ""}
              </button>`).join("")}
          </div>
          <p class="hint">연회비와 실적 조건은 자주 바뀝니다. 채워진 값은 카드사 페이지에서 한 번 확인해 주세요.</p>`;
        out.querySelectorAll(".find-item").forEach(b => {
          b.onclick = () => {
            const c = r.candidates[+b.dataset.i];
            if (c.issuer && CONFIG.ISSUERS.indexOf(c.issuer) >= 0) m.querySelector("#cf-issuer").value = c.issuer;
            m.querySelector("#cf-name").value = c.name;
            const firstBrand = (c.brands || "").split(",")[0].trim();
            if (CONFIG.BRANDS.indexOf(firstBrand) >= 0) m.querySelector("#cf-brand").value = firstBrand;
            if (c.fee != null) m.querySelector("#cf-fee").value = c.fee;
            if (c.image) {
              m.querySelector("#cf-image").value = c.image;
              m.querySelector("#cf-prev").innerHTML =
                `<img class="cf-prev-img" src="${esc(c.image)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('이 주소로는 이미지를 불러오지 못했어요.'))">`;
            }
            const memo = m.querySelector("#cf-memo");
            const bits = [c.prevSpend ? "전월실적 " + c.prevSpend : "", c.feeNote, c.benefit].filter(Boolean).join(" / ");
            if (bits && !memo.value) memo.value = bits;
            out.innerHTML = '<div class="find-done">채웠습니다. 값을 확인하고 저장하세요.</div>';
          };
        });
      }
    } catch (e) {
      const quota = /한도/.test(e.message);
      out.innerHTML = '<div class="find-load' + (quota ? " warn" : "") + '">' + esc(e.message) +
        (quota ? "<br>그동안은 아래 칸에 직접 입력하시면 됩니다." : "") + "</div>";
    }
    btn.disabled = false; btn.textContent = "불러오기";
  };
}

/* ================================================================
   탭 2 - 프로모션 (후보군 / 참여 중 / 공고 분석)
   ================================================================ */
function renderPromo(main) {
  const btn = el(`<section class="analyze-cta"><button class="cta big" id="go-analyze">공고 분석하기<span>이벤트 텍스트나 화면 캡처를 넣으면 조건을 읽어드려요</span></button></section>`);
  main.appendChild(btn);
  btn.querySelector("#go-analyze").onclick = openAnalyze;

  const active = S.events.filter(e => e.owner === S.user.name && e.status === "신청");
  const cand = S.events.filter(e => e.owner === S.user.name && e.status === "후보");

  main.appendChild(el(`<div class="sec-head"><h2>참여 중</h2><span class="sec-sub">${active.length}건</span></div>`));
  if (!active.length) main.appendChild(el(`<div class="empty">참여 중인 프로모션이 없어요.<br>후보군에서 신청 처리를 하면 여기로 올라옵니다.</div>`));
  active.forEach(ev => main.appendChild(promoCard(ev, true)));

  main.appendChild(el(`<div class="sec-head"><h2>후보군</h2><span class="sec-sub">${cand.length}건</span></div>`));
  if (!cand.length) main.appendChild(el(`<div class="empty">공고 분석 후 "후보군에 담기"를 누르면 여기에 모입니다.</div>`));
  cand.forEach(ev => main.appendChild(promoCard(ev, false)));
}

function promoCard(ev, isActive) {
  const v = verdictOf(ev);
  const bens = ev.data.benefits || [];
  const tries = bens.filter(b => pickKey(b) === "try");
  const others = bens.filter(b => pickKey(b) !== "try");
  const total = bens.filter(b => pickKey(b) !== "skip").reduce((s, b) => s + Number(b.back || 0), 0);
  const tryTotal = tries.reduce((s, b) => s + Number(b.back || 0), 0);
  const endDD = ev.endApply ? daysTo(ev.endApply) : null;
  const thumb = issuerImg(ev.issuer);

  let benRows = "";
  tries.forEach((b, i) => {
    const st = benState(b);
    const pct = b.need ? Math.min(100, Math.round((Number(b.spent || 0) / Number(b.need)) * 100)) : (b.paidDate ? 100 : 0);
    const left = b.need ? Math.max(0, Number(b.need) - Number(b.spent || 0)) : 0;
    const openTodos = (b.todos || []).filter(t => !t.done);
    benRows += `
      <div class="ben ${st.cls}">
        <div class="ben-top">
          <b>${esc(b.kind || "혜택" + (i + 1))}</b>
          <span class="pill ${st.cls}">${st.txt}</span>
        </div>
        <div class="ben-sum">${esc(b.summary || "")}</div>
        ${b.need ? `
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div class="ben-nums">
            <span>${fWon(b.spent || 0)} / ${fWon(b.need)}${left && !b.paidDate ? ", " + fWon(left) + " 남음" : ""}</span>
            <b class="green">+${fWon(b.back)}</b>
          </div>` : (b.back ? `<div class="ben-nums"><span>${esc(b.when || "")}</span><b class="green">+${fWon(b.back)}</b></div>` : "")}
        ${b.payE ? `<div class="ben-date">결제 마감 ${fDateK(b.payE)}${b.when ? " | 지급 " + esc(b.when) : ""}</div>` : ""}
        ${b.keep ? `<div class="ben-keep">유지: ${esc(b.keep)}</div>` : ""}
        ${openTodos.length ? `<div class="ben-todo">확인할 것 ${openTodos.length}건: ${esc(openTodos.map(t => t.t).join(", ")).slice(0, 70)}</div>` : ""}
      </div>`;
  });

  const otherLine = others.length ? `
    <div class="ben-others">
      ${others.map(b => `<span class="tag ${pickOf(b).cls}">${esc(b.kind || "혜택")} ${pickOf(b).label}</span>`).join("")}
    </div>` : "";

  const c = el(`
    <section class="promo tapcard ${v.cls}" tabindex="0" role="button">
      <div class="promo-head">
        ${thumb ? `<img class="thumb" src="${esc(thumb)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
        <div>
          <div class="promo-issuer">${esc(ev.issuer)}${ev.platform ? " | " + esc(ev.platform) : ""}${ev.brand ? " | " + esc(ev.brand) : ""}</div>
          <div class="promo-name">${esc(ev.name)}</div>
        </div>
        <span class="pill ${v.cls}">${v.txt}</span>
      </div>
      ${!isActive && v.cls === "wait" && v.j.blocking.length ? `<div class="promo-block">${esc(v.j.blocking[0].label)}, ${fDateK(v.j.openDay)}부터 가능</div>` : ""}
      ${!isActive && v.cls === "no" ? `<div class="promo-block bad">${esc(v.j.hardBlock)}</div>` : ""}
      ${endDD != null && endDD >= 0 && ev.status !== "완료" ? `<div class="promo-apply">응모 마감 ${fDateK(ev.endApply)} (D-${endDD})${ev.confirmed ? ' | <span class="green">상담 확인됨</span>' : ""}</div>` : ""}
      <div class="promo-total">
        <span>도전 중 ${tries.length}건${others.length ? " / 전체 " + bens.length + "건" : ""}</span>
        <b class="green">${fWon(tryTotal)}${tryTotal !== total ? ' <em class="sub-amt">최대 ' + fWon(total) + "</em>" : ""}</b>
      </div>
      ${benRows || '<div class="ben-none">아직 도전할 혜택을 고르지 않았어요.</div>'}
      ${otherLine}
    </section>`);
  c.onclick = () => openEventDetail(ev.no);
  c.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEventDetail(ev.no); } };
  return c;
}

/* ---------- 이벤트 상세 모달 (유의사항 + 상태 전환 + 진행 입력) ---------- */
function openEventDetail(no) {
  const ev = S.events.find(e => e.no === String(no));
  if (!ev) return;
  const v = verdictOf(ev);
  const bens = ev.data.benefits || [];
  const qs = quitSafeDay(ev);

  let benHtml = "";
  bens.forEach((b, i) => {
    const st = benState(b);
    const dd = b.payE ? daysTo(b.payE) : null;
    const pct = b.need ? Math.min(100, Math.round((Number(b.spent || 0) / Number(b.need)) * 100)) : (b.paidDate ? 100 : 0);
    const left = b.need ? Math.max(0, Number(b.need) - Number(b.spent || 0)) : 0;
    benHtml += `
      <div class="ben pick-${pickKey(b)} ${st.cls}" data-i="${i}">
        <div class="ben-top">
          <b>${esc(b.kind || "혜택" + (i + 1))}</b>
          <b class="green">+${fWon(b.back)}</b>
        </div>
        <div class="ben-sum">${esc(b.summary || "")}</div>
        <div class="picks">
          ${Object.keys(PICKS).map(k => `<button class="chip pk ${pickKey(b) === k ? "on " + PICKS[k].cls : ""}" data-pick="${k}">${PICKS[k].label}</button>`).join("")}
        </div>
        <div class="ben-body">
          <div class="ben-state">
            <span class="pill ${st.cls}">${st.txt}</span>
            ${b.payS || b.payE ? `<span class="ben-date">결제 기간 ${fDateK(b.payS)} ~ ${fDateK(b.payE)}${dd != null && dd >= 0 ? " (D-" + dd + ")" : ""}${b.when ? " | 지급 " + esc(b.when) : ""}</span>` : ""}
          </div>
          ${b.need ? `
            <div class="bar"><i style="width:${pct}%"></i></div>
            <div class="ben-nums"><span>${fWon(b.spent || 0)} / ${fWon(b.need)}${left && !b.paidDate ? ", " + fWon(left) + " 남음" : ""}</span></div>` : ""}
          ${b.keep ? `<div class="ben-keep">유지: ${esc(b.keep)}</div>` : ""}
          ${(b.todos || []).length ? `
            <div class="todos">
              <b>확인할 것</b>
              ${b.todos.map((t, k) => `
                <label class="todo${t.done ? " done" : ""}">
                  <input type="checkbox" data-todo="${k}" ${t.done ? "checked" : ""}>
                  <span>${esc(t.t)}</span>
                </label>`).join("")}
            </div>` : ""}
          <div class="ben-edit">
            ${b.need ? `<label>지금까지 쓴 돈<input type="number" data-f="spent" value="${b.spent || 0}"></label>` : ""}
            <label>돈 들어온 날<input type="date" data-f="paidDate" value="${fDate(b.paidDate)}"></label>
            <label>들어온 금액<input type="number" data-f="paidAmt" value="${b.paidAmt || ""}" placeholder="${b.back || ""}"></label>
          </div>
          <div class="ben-help">${b.need
      ? "쓴 돈을 적으면 진행바와 남은 금액이 바뀝니다. "
      : ""}캐시백이 실제로 들어오면 날짜와 금액을 적으세요. 그 날짜가 이 카드사의 수혜 이력이 되어 다음 이벤트 응모 가능일과 해지 가능일 계산에 쓰입니다.</div>
        </div>
      </div>`;
  });

  const cautions = (ev.data.cautions || []).map(t => `<li>${esc(t)}</li>`).join("");

  const m = openModal(`
    <div class="promo-head">
      <div>
        <div class="promo-issuer">${esc(ev.issuer)}${ev.platform ? " | " + esc(ev.platform) : ""}${ev.brand ? " | " + esc(ev.brand) : ""}</div>
        <h3 style="margin:2px 0 0">${esc(ev.name)}</h3>
      </div>
      <span class="pill ${v.cls}">${v.txt}</span>
    </div>
    ${ev.endApply ? `<div class="promo-apply">응모 마감 ${fDateK(ev.endApply)}</div>` : ""}
    ${qs ? `<div class="promo-block bad">${fDateK(qs)}까지 해지 금지 - 어기면 받은 캐시백 전액 회수</div>` : ""}
    <div class="detail-bens">${benHtml || '<div class="empty">혜택 정보가 없습니다.</div>'}</div>
    ${cautions ? `<h4>꼭 알아야 할 것</h4><ul class="cautions">${cautions}</ul>` : ""}
    ${srcBlock(ev)}
    <label class="chk"><input type="checkbox" id="ed-confirm" ${ev.confirmed ? "checked" : ""}> 전화 상담으로 대상자 최종 확인함</label>
    <div class="modal-btns wrapbtns">
      ${ev.status === "후보" ? '<button class="cta" id="ed-apply">신청 완료 처리</button>' : ""}
      ${ev.status === "신청" ? '<button class="cta" id="ed-done">모두 받았어요, 아카이브로</button>' : ""}
      ${ev.status !== "포기" && ev.status !== "완료" ? '<button class="mini ghost" id="ed-drop">포기</button>' : ""}
      ${ev.status === "완료" || ev.status === "포기" ? '<button class="mini ghost" id="ed-revive">참여 중으로 복원</button>' : ""}
      <button class="mini ghost danger" id="ed-del">기록 삭제</button>
      <button class="mini ghost" id="ed-save">입력값 저장</button>
    </div>`);

  bindSrcBlock(m);

  /* 도전 / 고민 중 / 관심없음 */
  m.querySelectorAll(".ben[data-i]").forEach(div => {
    const i = +div.dataset.i;
    div.querySelectorAll(".pk").forEach(btn => {
      btn.onclick = async () => {
        const k = btn.dataset.pick;
        bens[i].pick = k;
        div.className = div.className.replace(/pick-\w+/, "pick-" + k);
        div.querySelectorAll(".pk").forEach(x => {
          x.className = "chip pk" + (x === btn ? " on " + PICKS[k].cls : "");
        });
        try { await quietSave(); } catch (e) { toast(e.message, true); }
      };
    });
    div.querySelectorAll("[data-todo]").forEach(cb => {
      cb.onchange = async () => {
        bens[i].todos[+cb.dataset.todo].done = cb.checked;
        cb.closest(".todo").classList.toggle("done", cb.checked);
        try { await quietSave(); } catch (e) { toast(e.message, true); }
      };
    });
  });

  /* 화면을 다시 그리지 않고 조용히 저장 */
  async function quietSave() {
    await api("update", { table: "이벤트", no: ev.no, fields: packEventFields(ev) });
    S.dirty = true;
  }

  async function saveData(extra) {
    m.querySelectorAll(".ben[data-i]").forEach(div => {
      const i = +div.dataset.i;
      div.querySelectorAll("input[data-f]").forEach(inp => {
        const f = inp.dataset.f;
        bens[i][f] = inp.type === "number" ? (inp.value === "" ? null : Number(inp.value)) : inp.value;
      });
    });
    ev.confirmed = m.querySelector("#ed-confirm").checked;
    Object.assign(ev, extra || {});
    await api("update", { table: "이벤트", no: ev.no, fields: packEventFields(ev) });
    await loadAll(); render();
  }

  m.querySelector("#ed-save").onclick = async () => {
    try { await saveData(); toast("저장했어요."); closeModal(); } catch (e) { toast(e.message, true); }
  };
  const ap = m.querySelector("#ed-apply");
  if (ap) ap.onclick = async () => {
    if (!m.querySelector("#ed-confirm").checked &&
      !confirm("전화 상담 확인이 아직 체크되지 않았어요.\n무실적과 수혜이력 조건은 카드사만 정확히 알 수 있어서, 상담 확인 없이 신청하면 조건을 다 채우고도 못 받을 수 있습니다.\n\n그래도 신청 완료로 처리할까요?")) return;
    try {
      await saveData({ status: "신청", applied: fDate(today()) });
      await ensureCardFromEvent(ev);
      toast("참여 중으로 옮겼어요. 내 카드 탭에 카드도 추가했습니다.");
      closeModal();
    } catch (e) { toast(e.message, true); }
  };
  const dn = m.querySelector("#ed-done");
  if (dn) dn.onclick = async () => {
    try { await saveData({ status: "완료" }); toast("아카이브로 옮겼어요."); closeModal(); } catch (e) { toast(e.message, true); }
  };
  const dr = m.querySelector("#ed-drop");
  if (dr) dr.onclick = async () => {
    if (!confirm("이 프로모션을 포기 처리할까요? 아카이브에 남습니다.")) return;
    try { await saveData({ status: "포기" }); closeModal(); } catch (e) { toast(e.message, true); }
  };
  const rv = m.querySelector("#ed-revive");
  if (rv) rv.onclick = async () => {
    try { await saveData({ status: "신청" }); toast("참여 중으로 복원했어요."); closeModal(); } catch (e) { toast(e.message, true); }
  };
  m.querySelector("#ed-del").onclick = async () => {
    if (!confirm("이 이벤트 기록을 완전히 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
      await api("del", { table: "이벤트", no: ev.no });
      closeModal(); toast("삭제했어요.");
      await loadAll(); render();
    } catch (e) { toast(e.message, true); }
  };
}

/* ---------- 원문 다시보기 ---------- */

/* 원문을 읽는 동안 위에 고정되는 요약 카드 */
function briefBlock(ev) {
  const d = ev.data || {};
  const bens = d.benefits || [];
  const cond = d.cond || {};
  const total = bens.reduce((s, b) => s + Number(b.back || 0), 0);
  const D = CONFIG.DEFAULTS;

  const line = bens.map(b => `
    <li><b>${esc(b.kind || "혜택")}</b>
      <span>${b.need ? fWon(b.need) + " 결제, " : ""}<em class="green">${b.back ? "+" + fWon(b.back) : "-"}</em>${b.payE ? " | " + fDateK(b.payE) + "까지" : ""}${b.when ? " | " + esc(b.when) + " 지급" : ""}</span>
    </li>`).join("");

  const condTxt = [
    "무실적 " + (cond.noUse != null ? cond.noUse + "개월" : D.noUse + "개월(기본값)"),
    cond.benSince ? "수혜제한 " + fDateK(cond.benSince) + " 이후 무수혜"
      : "수혜제한 " + (cond.benLimit != null ? cond.benLimit + "개월" : D.benLimit + "개월(기본값)"),
    "회수방지 " + (cond.hold != null ? cond.hold + "개월" : D.hold + "개월(기본값)")
  ].join(" | ");

  return `
    <div class="brief">
      <div class="brief-head">
        <b>핵심 요약</b>
        <span class="green">${fWon(total)}</span>
      </div>
      ${d.summary ? `<p class="brief-sum">${esc(d.summary)}</p>` : ""}
      ${line ? `<ul class="brief-list">${line}</ul>` : ""}
      <div class="brief-cond">${esc(condTxt)}</div>
      ${ev.endApply ? `<div class="brief-cond">응모 마감 ${fDateK(ev.endApply)}</div>` : ""}
    </div>`;
}

function srcBlock(ev) {
  const shots = (ev.data && ev.data.shots) || [];
  const raw = ev.raw || "";
  if (!shots.length && !raw) {
    return `<div class="src-none">저장된 원문이 없습니다. 이 이벤트는 원문 보관 기능이 생기기 전에 담겼거나, 분석 없이 직접 만든 기록입니다.</div>`;
  }
  return `
    <details class="src">
      <summary>공고 원문 다시보기${shots.length ? " (캡처 " + shots.length + "장)" : ""}</summary>
      <div class="src-body">
        ${briefBlock(ev)}
        ${shots.length ? `<div class="shots">${shots.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" loading="lazy"></a>`).join("")}</div>` : ""}
        ${raw ? `<pre class="src-text">${esc(raw)}</pre>
          <button class="mini ghost" id="src-copy">원문 복사</button>` : ""}
      </div>
    </details>`;
}

function bindSrcBlock(m) {
  const btn = m.querySelector("#src-copy");
  if (!btn) return;
  btn.onclick = () => {
    const t = m.querySelector(".src-text").textContent;
    navigator.clipboard.writeText(t).then(() => toast("원문을 복사했어요."), () => toast("복사에 실패했어요.", true));
  };
}

/* 신청 처리 시 카드 자동 등록 */
async function ensureCardFromEvent(ev) {
  const exists = S.cards.some(c => c.owner === S.user.name && c.issuer === ev.issuer && c.status !== "해지");
  if (exists) return;
  await api("add", {
    table: "카드", fields: {
      "카드사": ev.issuer, "카드명": ev.name.replace(/이벤트|프로모션/g, "").trim(),
      "브랜드": ev.brand, "발급채널": "온라인", "발급일": fDate(today()),
      "최근사용일": "", "상태": "사용중", "메모": "프로모션 신청으로 자동 등록 - 카드명과 정보를 확인해 주세요"
    }
  });
  await loadAll();
}

/* ---------- 공고 분석 모달 ---------- */
function openAnalyze() {
  const m = openModal(`
    <h3>공고 분석</h3>
    <p class="hint">이벤트 페이지 내용을 통째로 붙여넣거나, 화면 캡처를 올리세요. 둘 다 넣어도 됩니다.</p>
    <label>공고 텍스트<textarea id="an-text" rows="6" placeholder="이벤트 페이지 전체 선택, 복사, 붙여넣기"></textarea></label>
    <label class="filelab">화면 캡처 (최대 4장)<input type="file" id="an-img" accept="image/*" multiple></label>
    <div id="an-thumbs" class="thumbs"></div>
    <div class="modal-btns"><button class="cta" id="an-go">분석하기</button></div>
    <div id="an-out"></div>`);

  let imgs = [];
  m.querySelector("#an-img").onchange = async e => {
    imgs = [];
    const files = Array.from(e.target.files).slice(0, 4);
    const tb = m.querySelector("#an-thumbs");
    tb.innerHTML = "";
    for (const f of files) {
      const b64 = await shrinkImage(f, 1300);
      imgs.push(b64);
      tb.appendChild(el(`<img src="data:image/jpeg;base64,${b64}">`));
    }
  };

  m.querySelector("#an-go").onclick = async () => {
    const text = m.querySelector("#an-text").value.trim();
    if (!text && !imgs.length) { toast("텍스트나 캡처 중 하나는 넣어야 해요.", true); return; }
    const btn = m.querySelector("#an-go");
    btn.disabled = true; btn.textContent = "AI가 읽는 중... (10~20초)";
    try {
      const out = await api("analyze", { text, images: imgs });
      renderAnalysis(m, out.result, text, imgs);
    } catch (e) {
      toast("분석 실패: " + e.message, true);
    }
    btn.disabled = false; btn.textContent = "분석하기";
  };
}

function renderAnalysis(m, r, rawText, imgs) {
  S.lastAnalysis = r;
  const cond = r.cond || {};
  const bens = (r.benefits || []).map(normBenefit);
  const total = bens.reduce((s, b) => s + Number(b.back || 0), 0);
  const j = judge(r.issuer, cond);
  const end = pDate(r.endApply);
  let vtxt, vcls;
  if (j.hardBlock) { vtxt = "대상 제외"; vcls = "no"; }
  else if (end && end < today()) { vtxt = "응모 마감"; vcls = "off"; }
  else if (j.ok) { vtxt = "응모 가능"; vcls = "ok"; }
  else { vtxt = "D-" + j.wait + " 후 가능 (" + fDateK(j.openDay) + "~)"; vcls = "wait"; }

  const out = m.querySelector("#an-out");
  const dup = findDuplicate(r);
  out.innerHTML = `
    <div class="an-result">
      <div class="promo-head">
        <div>
          <div class="promo-issuer">${esc(r.issuer || "카드사 미상")}<span id="an-plat-txt">${r.platform ? " | " + esc(r.platform) : ""}</span>${r.brand ? " | " + esc(r.brand) : ""}</div>
          <b>${esc(r.name || "이벤트")}</b>
        </div>
        <span class="pill ${vcls}">${vtxt}</span>
      </div>
      ${r.platform ? "" : `
        <div class="ask">
          <b>어느 채널에서 보신 공고인가요?</b>
          <span>공고에서 채널을 찾지 못했어요. 나중에 어디로 응모했는지 헷갈리지 않도록 골라 주세요.</span>
          <div class="ask-chips">${CONFIG.PLATFORMS.map(p => `<button class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join("")}</div>
        </div>`}
      ${dup ? `
        <div class="dup">
          <b>이미 담아둔 이벤트 같아요</b>
          <span>${esc(dup.issuer)} | ${esc(dup.name)} (${esc(dup.status)}${dup.applied ? ", 신청 " + fDateK(dup.applied) : ""})</span>
          <span class="dup-note">덮어쓰면 조건과 혜택이 이번 분석 결과로 교체됩니다. 이미 입력한 사용 금액과 지급 내역, 상담 확인 표시는 그대로 유지됩니다.</span>
        </div>` : ""}
      ${r.summary ? `<p class="an-sum">${esc(r.summary)}</p>` : ""}
      ${j.hardBlock ? `<div class="promo-block bad">${esc(j.hardBlock)}</div>` : ""}
      ${!j.ok && !j.hardBlock && j.blocking.length ? `<div class="promo-block">${esc(j.blocking[0].label)}</div>` : ""}
      <div class="promo-total"><span>혜택 합계</span><b class="green">${fWon(total)}</b></div>
      ${bens.map(b => `
        <div class="ben">
          <div class="ben-top"><b>${esc(b.kind || "혜택")}</b><b class="green">+${fWon(b.back)}</b></div>
          <div class="ben-sum">${esc(b.summary || "")}</div>
          <div class="ben-date">${b.need ? fWon(b.need) + " 결제 | " : ""}${b.payS ? fDateK(b.payS) + "~" : ""}${b.payE ? fDateK(b.payE) : ""}${b.when ? " | 지급 " + esc(b.when) : ""}</div>
        </div>`).join("")}
      <div class="an-cond">
        <b>자격 조건</b>
        <span>무실적 ${cond.noUse != null ? cond.noUse + "개월" : "미확인(기본 " + CONFIG.DEFAULTS.noUse + ")"}
        | 수혜제한 ${cond.benSince ? fDateK(cond.benSince) + " 이후 무수혜" : (cond.benLimit != null ? cond.benLimit + "개월" : "미확인(기본 " + CONFIG.DEFAULTS.benLimit + ")")}
        | 회수방지 ${cond.hold != null ? cond.hold + "개월" : "미확인(기본 " + CONFIG.DEFAULTS.hold + ")"}</span>
      </div>
      ${(r.cautions || []).length ? `<h4>꼭 알아야 할 것</h4><ul class="cautions">${r.cautions.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <p class="hint">AI 판독 결과는 틀릴 수 있어요. 응모 전에 원문과 한 번 대조하고, 무실적과 수혜이력은 카드사 전화 상담으로 확정하세요.</p>
      <div class="modal-btns wrapbtns">
        ${dup ? `<button class="cta" id="an-over">기존 이벤트에 덮어쓰기</button>
                 <button class="mini ghost" id="an-add">그래도 새로 담기</button>`
             : `<button class="cta" id="an-add">후보군에 담기</button>`}
      </div>
    </div>`;

  // 채널을 못 읽었을 때 직접 고르기
  out.querySelectorAll(".ask-chips .chip").forEach(b => {
    b.onclick = () => {
      r.platform = b.dataset.p;
      out.querySelectorAll(".ask-chips .chip").forEach(x => x.classList.toggle("on", x === b));
      out.querySelector("#an-plat-txt").textContent = " | " + r.platform;
    };
  });

  function buildFields(keepShots) {
    // 붙여넣은 텍스트가 없으면(캡처만 올린 경우) AI가 옮겨 적은 판독본을 원문으로 보관
    const keep = (rawText && rawText.trim()) ? rawText : (r.transcript || "");
    return {
      status: "후보", issuer: r.issuer || "", name: r.name || "이벤트",
      platform: r.platform || "", brand: r.brand || "", endApply: r.endApply || "",
      applied: "", confirmed: false,
      data: { cond, benefits: bens, cautions: r.cautions || [], shots: keepShots || [], summary: r.summary || "" },
      raw: keep.slice(0, 20000), memo: ""
    };
  }

  const over = out.querySelector("#an-over");
  if (over) over.onclick = async () => {
    over.disabled = true; over.textContent = "덮어쓰는 중...";
    try {
      // 진행 상황(사용 금액, 실제 지급)은 혜택 구분을 키로 새 혜택에 옮겨 붙인다
      const oldBens = dup.data.benefits || [];
      bens.forEach(nb => {
        const ob = oldBens.find(o => (o.kind || "") === (nb.kind || "") && (o.spent || o.paidDate));
        if (ob) { nb.spent = ob.spent || 0; nb.paidDate = ob.paidDate || ""; nb.paidAmt = ob.paidAmt || null; }
      });
      const next = buildFields(dup.data.shots || []);
      next.status = dup.status;
      next.applied = dup.applied;
      next.confirmed = dup.confirmed;
      next.memo = dup.memo;
      await api("update", { table: "이벤트", no: dup.no, fields: packEventFields(next), images: imgs || [] });
      closeModal();
      toast("기존 이벤트를 갱신했어요.");
      await loadAll();
      S.tab = "promo"; render();
    } catch (e) {
      toast(e.message, true);
      over.disabled = false; over.textContent = "기존 이벤트에 덮어쓰기";
    }
  };

  out.querySelector("#an-add").onclick = async () => {
    const btn = out.querySelector("#an-add");
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = (imgs && imgs.length) ? "캡처 저장 중..." : "담는 중...";
    try {
      const res = await api("add", { table: "이벤트", fields: packEventFields(buildFields()), images: imgs || [] });
      closeModal();
      toast(res.warn ? res.warn : "후보군에 담았어요.", !!res.warn);
      await loadAll();
      S.tab = "promo"; render();
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false; btn.textContent = label;
    }
  };
  if (out.scrollIntoView) out.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* 같은 이벤트를 이미 담아뒀는지 찾기.
   같은 카드사이면서 응모 마감일이 같거나 이름이 서로를 포함하면 같은 건으로 본다. */
function findDuplicate(r) {
  if (!r.issuer) return null;
  const mine = S.events.filter(e => e.owner === S.user.name && e.issuer === r.issuer && e.status !== "포기");
  const norm = s => String(s || "").replace(/[\s.,()\-]/g, "").toLowerCase();
  const rn = norm(r.name);
  for (const e of mine) {
    if (r.endApply && e.endApply && fDate(r.endApply) === fDate(e.endApply)) return e;
    const en = norm(e.name);
    if (rn.length >= 4 && en.length >= 4 && (rn.indexOf(en) >= 0 || en.indexOf(rn) >= 0)) return e;
  }
  return null;
}

async function shrinkImage(file, maxW) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxW / img.width);
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * scale);
  cv.height = Math.round(img.height * scale);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", 0.85).split(",")[1];
}

/* ================================================================
   탭 3 - 아카이브
   ================================================================ */
function renderArchive(main) {
  const evs = S.events.filter(e => e.owner === S.user.name && (e.status === "완료" || e.status === "포기"));
  const quitCards = S.cards.filter(c => c.owner === S.user.name && c.status === "해지");
  const totalGot = evs.reduce((s, e) => s + (e.data.benefits || []).reduce((t, b) => t + Number(b.paidAmt || 0), 0), 0);

  main.appendChild(el(`
    <section class="hero archive">
      <div class="hero-label">지금까지 받은 캐시백</div>
      <div class="hero-num">${fWonFull(totalGot)}<span class="won">원</span></div>
      <div class="hero-sub">끝난 프로모션 ${evs.length}건 | 해지한 카드 ${quitCards.length}장</div>
    </section>`));

  main.appendChild(el(`<div class="sec-head"><h2>끝난 프로모션</h2></div>`));
  if (!evs.length) main.appendChild(el(`<div class="empty">아직 없어요. 프로모션 상세에서 "모두 받았어요, 아카이브로"를 누르면 여기로 옵니다.</div>`));
  evs.forEach(ev => {
    const got = (ev.data.benefits || []).reduce((t, b) => t + Number(b.paidAmt || 0), 0);
    const lastPaid = maxDate((ev.data.benefits || []).map(b => b.paidDate));
    const qs = quitSafeDay(ev);
    const myCard = S.cards.find(c => c.issuer === ev.issuer && c.owner === S.user.name);
    const quitRisk = qs && myCard && myCard.quit && pDate(myCard.quit) < qs;
    const row = el(`
      <section class="arch-row tapcard ${ev.status === "포기" ? "off" : ""}" tabindex="0" role="button">
        <div class="arch-main">
          <b>${esc(ev.issuer)} | ${esc(ev.name)}</b>
          <span>${esc(ev.platform || "")}${ev.applied ? " | 신청 " + fDateK(ev.applied) : ""}${lastPaid ? " | 마지막 지급 " + fDateK(lastPaid) : ""}</span>
          ${qs && !myCard?.quit ? `<span class="warn-txt">해지 금지 ${fDateK(qs)}까지</span>` : ""}
          ${quitRisk ? `<span class="warn-txt bad">⚠ 해지 금지 기간 내 해지 - 회수 여부 확인 필요</span>` : ""}
        </div>
        <div class="arch-amt ${ev.status === "포기" ? "" : "green"}">${ev.status === "포기" ? "포기" : "+" + fWonFull(got) + "원"}</div>
      </section>`);
    row.onclick = () => openEventDetail(ev.no);
    main.appendChild(row);
  });

  main.appendChild(el(`<div class="sec-head"><h2>해지한 카드</h2></div>`));
  if (!quitCards.length) main.appendChild(el(`<div class="empty">해지한 카드가 없어요. 카드 정보 수정에서 상태를 '해지'로 바꾸면 여기에 남습니다.</div>`));
  quitCards.forEach(c => {
    const row = el(`
      <section class="arch-row tapcard" tabindex="0" role="button">
        ${cardImg(c) ? `<img class="thumb" src="${esc(cardImg(c))}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
        <div class="arch-main">
          <b>${esc(c.issuer)} | ${esc(c.name || "카드명 미입력")}</b>
          <span>마지막 사용 ${fDateK(c.lastUse)} | 해지 ${fDateK(c.quit)}</span>
        </div>
        <div class="arch-amt off">해지</div>
      </section>`);
    row.onclick = () => openCardForm(c);
    main.appendChild(row);
  });
}

/* ================================================================
   탭 4 - 결산 (연도별 캐시백)
   ================================================================ */
function renderReport(main) {
  const owners = ownerList();
  const scope = S.reportScope || S.user.name;
  const R = crossReport(scope === "__all__" ? "" : scope);

  main.appendChild(el(`
    <section class="hero report">
      <div class="hero-label">지금까지 받은 캐시백</div>
      <div class="hero-num">${fWonFull(R.grandPaid)}<span class="won">원</span></div>
      <div class="hero-sub">${R.years.length ? R.years.length + "개 연도 | 카드사 " + R.issuers.length + "곳" : "기록 없음"}${R.grandExpect ? " | 받을 예정 " + fWonFull(R.grandExpect) + "원" : ""}</div>
    </section>`));

  if (owners.length > 1) {
    const chips = el(`<section class="scope">
      ${owners.map(o => `<button class="chip${scope === o ? " on" : ""}" data-o="${esc(o)}">${esc(o)}</button>`).join("")}
      <button class="chip${scope === "__all__" ? " on" : ""}" data-o="__all__">전체</button>
    </section>`);
    chips.querySelectorAll(".chip").forEach(b => {
      b.onclick = () => { S.reportScope = b.dataset.o; render(); };
    });
    main.appendChild(chips);
  }

  if (!R.years.length) {
    main.appendChild(el(`<div class="empty">아직 집계할 캐시백이 없어요.<br>프로모션 상세에서 돈 들어온 날과 금액을 적으면 여기에 쌓입니다.</div>`));
    return;
  }

  /* ---- 연도별 막대 ---- */
  const maxYear = Math.max.apply(null, R.years.map(y => R.colTotals[y].paid + R.colTotals[y].expect));
  const H = 132;
  main.appendChild(el(`<div class="sec-head"><h2>연도별</h2><span class="sec-sub">주황은 받을 예정</span></div>`));
  main.appendChild(el(`
    <section class="chart">
      <div class="bars">
        ${R.years.map(y => {
    const t = R.colTotals[y];
    const hp = Math.round((t.paid / maxYear) * H);
    const he = Math.round((t.expect / maxYear) * H);
    return `<div class="barcol">
              <div class="bval">${t.paid + t.expect ? fWon(t.paid + t.expect) : ""}</div>
              <div class="bstack" style="height:${H}px">
                ${he ? `<i class="exp" style="height:${Math.max(he, 3)}px"></i>` : ""}
                ${hp ? `<i class="pd" style="height:${Math.max(hp, 3)}px"></i>` : ""}
              </div>
              <div class="blab">${String(y).slice(2)}년</div>
            </div>`;
  }).join("")}
      </div>
    </section>`));

  /* ---- 카드사별 순위 ---- */
  const maxIss = R.issuers[0].total || 1;
  main.appendChild(el(`<div class="sec-head"><h2>카드사별</h2><span class="sec-sub">누적 순</span></div>`));
  main.appendChild(el(`
    <section class="rank">
      ${R.issuers.map(i => {
    const col = CONFIG.ISSUER_COLORS[i.issuer] || ["#333", "#666"];
    const wp = Math.round((i.paid / maxIss) * 100);
    const we = Math.round((i.expect / maxIss) * 100);
    return `<div class="rk">
            <div class="rk-top">
              <b>${esc(i.issuer)}</b>
              ${i.status === "사용중" ? '<span class="tag live">사용 중</span>'
        : i.quit ? `<span class="tag">해지 ${fDateK(i.quit)}</span>` : ""}
              <span class="rk-amt">${fWonFull(i.total)}</span>
            </div>
            <div class="rk-bar">
              <i style="width:${wp}%;background:linear-gradient(90deg,${col[0]},${col[1]})"></i>
              ${we ? `<i class="exp" style="width:${we}%"></i>` : ""}
            </div>
          </div>`;
  }).join("")}
    </section>`));

  /* ---- 교차표 ---- */
  main.appendChild(el(`<div class="sec-head"><h2>전체 표</h2><span class="sec-sub">옆으로 밀어서 보세요</span></div>`));
  main.appendChild(el(`
    <section class="matrix-wrap">
      <table class="matrix">
        <thead>
          <tr>
            <th class="stick">카드사</th>
            ${R.years.map(y => `<th>${String(y).slice(2)}년</th>`).join("")}
            <th class="sum">합계</th>
            ${R.grandExpect ? '<th class="sum">예정</th>' : ""}
          </tr>
        </thead>
        <tbody>
          ${R.issuers.map(i => `
            <tr>
              <td class="stick">${esc(i.issuer)}</td>
              ${R.years.map(y => {
    const c = i.byYear[y];
    if (!c) return "<td></td>";
    return `<td>${c.paid ? fWonFull(c.paid) : ""}${c.expect ? `<em class="soon">${c.paid ? "<br>" : ""}${fWonFull(c.expect)}</em>` : ""}</td>`;
  }).join("")}
              <td class="sum">${i.paid ? fWonFull(i.paid) : ""}</td>
              ${R.grandExpect ? `<td class="sum">${i.expect ? `<em class="soon">${fWonFull(i.expect)}</em>` : ""}</td>` : ""}
            </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr>
            <td class="stick">합계</td>
            ${R.years.map(y => `<td>${R.colTotals[y].paid ? fWonFull(R.colTotals[y].paid) : ""}${R.colTotals[y].expect ? `<em class="soon">${R.colTotals[y].paid ? "<br>" : ""}${fWonFull(R.colTotals[y].expect)}</em>` : ""}</td>`).join("")}
            <td class="sum">${fWonFull(R.grandPaid)}</td>
            ${R.grandExpect ? `<td class="sum"><em class="soon">${fWonFull(R.grandExpect)}</em></td>` : ""}
          </tr>
        </tfoot>
      </table>
    </section>`));

  const btn = el(`<section class="analyze-cta"><button class="cta" id="rp-sheet">구글 시트에도 결산표 만들기</button></section>`);
  main.appendChild(btn);
  btn.querySelector("#rp-sheet").onclick = async () => {
    const b = btn.querySelector("#rp-sheet");
    b.disabled = true; b.textContent = "만드는 중...";
    try {
      const r = await api("report");
      toast(r.msg || "시트에 만들었어요.");
    } catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = "구글 시트에도 결산표 만들기";
  };
  main.appendChild(el(`<p class="hint" style="text-align:center">DB 스프레드시트에 "결산" 시트가 만들어집니다. 위쪽은 이 교차표, 아래쪽은 건별 원장입니다.</p>`));
}

/* ---------- 모달 공통 ---------- */
function openModal(html) {
  closeModal();
  const wrap = el(`<div class="modal-wrap" id="modal"><div class="modal">${html}</div></div>`);
  wrap.addEventListener("click", e => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
  document.body.style.overflow = "hidden";
  return wrap.querySelector(".modal");
}
function closeModal() {
  const m = document.getElementById("modal");
  if (m) m.remove();
  document.body.style.overflow = "";
  if (S.dirty) { S.dirty = false; render(); }
}
