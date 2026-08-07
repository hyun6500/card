/* ================================================================
   pages.js — 탭 렌더링과 모달
   탭: cards(내 카드) / promo(프로모션) / archive(아카이브)
   ================================================================ */

function render() {
  const main = document.getElementById("main");
  main.innerHTML = "";
  if (S.tab === "cards") renderCards(main);
  else if (S.tab === "promo") renderPromo(main);
  else renderArchive(main);
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab));
  window.scrollTo(0, 0);
}

/* ================================================================
   탭 1 — 내 카드
   ================================================================ */
function renderCards(main) {
  const sum = summary();
  const mine = S.cards.filter(c => c.owner === S.user.name && c.status !== "해지");

  main.appendChild(el(`
    <section class="hero">
      <div class="hero-label">들어올 캐시백</div>
      <div class="hero-num">${fWonFull(sum.expect)}<span class="won">원</span></div>
      <div class="hero-sub">받은 캐시백 ${fWonFull(sum.got)}원 · 참여 중 ${S.events.filter(e => e.status === "신청").length}건</div>
    </section>`));

  if (sum.urgent.length) {
    const u = sum.urgent[0];
    main.appendChild(el(`
      <section class="alert" data-ev="${u.ev.no}">
        <span class="alert-dot"></span>
        <div><b>${esc(u.ev.issuer)} ${esc(u.b.kind || "혜택")}</b> 결제 마감 D-${u.dd}
        <div class="alert-sub">${u.b.need ? fWon(Math.max(0, u.b.need - (u.b.spent || 0))) + " 더 쓰면 " + fWon(u.b.back) : esc(u.b.summary || "")}</div></div>
        <span class="chev">›</span>
      </section>`));
    main.lastChild.onclick = () => openEventDetail(u.ev.no);
  }

  const head = el(`<div class="sec-head"><h2>내 카드</h2><button class="mini" id="add-card">＋ 카드 추가</button></div>`);
  main.appendChild(head);
  head.querySelector("#add-card").onclick = () => openCardForm(null);

  if (!mine.length) {
    main.appendChild(el(`<div class="empty">아직 등록한 카드가 없어요.<br>＋ 카드 추가를 누르거나, 프로모션 탭에서 이벤트를 신청하면 카드가 자동으로 등록됩니다.</div>`));
  }

  mine.forEach(c => {
    const col = CONFIG.ISSUER_COLORS[c.issuer] || ["#333", "#666"];
    const j = judge(c.issuer, {});
    const dd = c.lastUse ? daysTo(addMonths(c.lastUse, CONFIG.DEFAULTS.noUse)) : null;
    const evs = S.events.filter(e => e.status === "신청" && e.issuer === c.issuer);
    const qs = evs.map(quitSafeDay).filter(Boolean);
    const qsMax = qs.length ? maxDate(qs) : null;
    const card = el(`
      <section class="ccard" style="--c1:${col[0]};--c2:${col[1]}">
        <div class="ccard-visual">
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
  main.appendChild(el(`<div class="sec-head"><h2>카드사별 응모 가능</h2><span class="sec-sub">내 이력 기준 · 기본 조건</span></div>`));
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
  c = c || { issuer: "", name: "", brand: "", channel: "온라인", issued: "", fee: "", lastUse: "", status: "사용중", quit: "", memo: "" };
  const m = openModal(`
    <h3>${isNew ? "카드 추가" : "카드 정보 수정"}</h3>
    <label>카드사<select id="cf-issuer">${CONFIG.ISSUERS.map(i => `<option ${i === c.issuer ? "selected" : ""}>${i}</option>`).join("")}</select></label>
    <label>카드명<input id="cf-name" value="${esc(c.name)}" placeholder="예: zgm.일본여행카드"></label>
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
    <label>메모<input id="cf-memo" value="${esc(c.memo)}"></label>
    <div class="modal-btns">
      ${isNew ? "" : '<button class="mini ghost danger" id="cf-del">삭제</button>'}
      <button class="cta" id="cf-save">저장</button>
    </div>`);
  m.querySelector("#cf-save").onclick = async () => {
    const fields = {
      "카드사": m.querySelector("#cf-issuer").value, "카드명": m.querySelector("#cf-name").value.trim(),
      "브랜드": m.querySelector("#cf-brand").value, "발급채널": m.querySelector("#cf-ch").value,
      "발급일": m.querySelector("#cf-issued").value, "연회비": m.querySelector("#cf-fee").value,
      "최근사용일": m.querySelector("#cf-use").value, "상태": m.querySelector("#cf-status").value,
      "해지일": m.querySelector("#cf-quit").value, "메모": m.querySelector("#cf-memo").value
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

/* ================================================================
   탭 2 — 프로모션 (후보군 / 참여 중 / 공고 분석)
   ================================================================ */
function renderPromo(main) {
  const btn = el(`<section class="analyze-cta"><button class="cta big" id="go-analyze">📷 공고 분석하기<span>이벤트 텍스트나 화면 캡처를 넣으면 조건을 읽어드려요</span></button></section>`);
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
  const total = bens.reduce((s, b) => s + Number(b.back || 0), 0);
  const endDD = ev.endApply ? daysTo(ev.endApply) : null;

  let benRows = "";
  bens.forEach((b, i) => {
    const st = benState(b);
    const pct = b.need ? Math.min(100, Math.round((Number(b.spent || 0) / Number(b.need)) * 100)) : (b.paidDate ? 100 : 0);
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
            <span>${fWon(b.spent || 0)} / ${fWon(b.need)}</span>
            <b class="green">+${fWon(b.back)}</b>
          </div>` : (b.back ? `<div class="ben-nums"><span>${esc(b.when || "")}</span><b class="green">+${fWon(b.back)}</b></div>` : "")}
        ${b.payE ? `<div class="ben-date">결제 마감 ${fDateK(b.payE)}${b.when ? " · 지급 " + esc(b.when) : ""}</div>` : ""}
      </div>`;
  });

  const c = el(`
    <section class="promo ${v.cls}">
      <div class="promo-head">
        <div>
          <div class="promo-issuer">${esc(ev.issuer)}${ev.platform ? " · " + esc(ev.platform) : ""}${ev.brand ? " · " + esc(ev.brand) : ""}</div>
          <div class="promo-name">${esc(ev.name)}</div>
        </div>
        <span class="pill ${v.cls}">${v.txt}</span>
      </div>
      ${!isActive && v.cls === "wait" && v.j.blocking.length ? `<div class="promo-block">🔒 ${esc(v.j.blocking[0].label)} → ${fDateK(v.j.openDay)}부터</div>` : ""}
      ${!isActive && v.cls === "no" ? `<div class="promo-block bad">⛔ ${esc(v.j.hardBlock)}</div>` : ""}
      ${endDD != null && endDD >= 0 && ev.status !== "완료" ? `<div class="promo-apply">응모 마감 ${fDateK(ev.endApply)} (D-${endDD})${ev.confirmed ? ' · <span class="green">☎ 상담 확인됨</span>' : ""}</div>` : ""}
      <div class="promo-total"><span>혜택 합계</span><b class="green">${fWon(total)}</b></div>
      ${benRows}
      <button class="promo-more">자세히 · 관리 ›</button>
    </section>`);
  c.querySelector(".promo-more").onclick = () => openEventDetail(ev.no);
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
    benHtml += `
      <div class="ben ${st.cls}" data-i="${i}">
        <div class="ben-top"><b>${esc(b.kind || "혜택" + (i + 1))}</b><span class="pill ${st.cls}">${st.txt}</span></div>
        <div class="ben-sum">${esc(b.summary || "")}</div>
        <div class="ben-edit">
          ${b.need ? `<label>사용 금액<input type="number" data-f="spent" value="${b.spent || 0}"></label>` : ""}
          <label>실제 지급일<input type="date" data-f="paidDate" value="${fDate(b.paidDate)}"></label>
          <label>실제 금액<input type="number" data-f="paidAmt" value="${b.paidAmt || ""}" placeholder="${b.back || ""}"></label>
        </div>
        ${b.payS || b.payE ? `<div class="ben-date">결제 기간 ${fDateK(b.payS)} ~ ${fDateK(b.payE)}${b.when ? " · 지급 " + esc(b.when) : ""}</div>` : ""}
      </div>`;
  });

  const cautions = (ev.data.cautions || []).map(t => `<li>${esc(t)}</li>`).join("");

  const m = openModal(`
    <div class="promo-head">
      <div>
        <div class="promo-issuer">${esc(ev.issuer)}${ev.platform ? " · " + esc(ev.platform) : ""}${ev.brand ? " · " + esc(ev.brand) : ""}</div>
        <h3 style="margin:2px 0 0">${esc(ev.name)}</h3>
      </div>
      <span class="pill ${v.cls}">${v.txt}</span>
    </div>
    ${ev.endApply ? `<div class="promo-apply">응모 마감 ${fDateK(ev.endApply)}</div>` : ""}
    ${qs ? `<div class="promo-block bad">💳 ${fDateK(qs)}까지 해지 금지 — 어기면 받은 캐시백 전액 회수</div>` : ""}
    <div class="detail-bens">${benHtml || '<div class="empty">혜택 정보가 없습니다.</div>'}</div>
    ${cautions ? `<h4>꼭 알아야 할 것</h4><ul class="cautions">${cautions}</ul>` : ""}
    <label class="chk"><input type="checkbox" id="ed-confirm" ${ev.confirmed ? "checked" : ""}> 전화 상담으로 대상자 최종 확인함</label>
    <div class="modal-btns wrapbtns">
      ${ev.status === "후보" ? '<button class="cta" id="ed-apply">신청 완료 처리</button>' : ""}
      ${ev.status === "신청" ? '<button class="cta" id="ed-done">모든 지급 끝 · 아카이브</button>' : ""}
      ${ev.status !== "포기" && ev.status !== "완료" ? '<button class="mini ghost" id="ed-drop">포기</button>' : ""}
      ${ev.status === "완료" || ev.status === "포기" ? '<button class="mini ghost" id="ed-revive">참여 중으로 복원</button>' : ""}
      <button class="mini ghost danger" id="ed-del">기록 삭제</button>
      <button class="mini ghost" id="ed-save">입력값 저장</button>
    </div>`);

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
      !confirm("전화 상담 확인이 아직 체크되지 않았어요.\n무실적·수혜이력 조건은 카드사만 정확히 알 수 있어서, 상담 확인 없이 신청하면 조건을 다 채우고도 못 받을 수 있습니다.\n\n그래도 신청 완료로 처리할까요?")) return;
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

/* 신청 처리 시 카드 자동 등록 */
async function ensureCardFromEvent(ev) {
  const exists = S.cards.some(c => c.owner === S.user.name && c.issuer === ev.issuer && c.status !== "해지");
  if (exists) return;
  await api("add", {
    table: "카드", fields: {
      "카드사": ev.issuer, "카드명": ev.name.replace(/이벤트|프로모션/g, "").trim(),
      "브랜드": ev.brand, "발급채널": "온라인", "발급일": fDate(today()),
      "최근사용일": "", "상태": "사용중", "메모": "프로모션 신청으로 자동 등록 — 카드명과 정보를 확인해 주세요"
    }
  });
  await loadAll();
}

/* ---------- 공고 분석 모달 ---------- */
function openAnalyze() {
  const m = openModal(`
    <h3>공고 분석</h3>
    <p class="hint">이벤트 페이지 내용을 통째로 붙여넣거나, 화면 캡처를 올리세요. 둘 다 넣어도 됩니다.</p>
    <label>공고 텍스트<textarea id="an-text" rows="6" placeholder="이벤트 페이지 전체 선택 → 복사 → 붙여넣기"></textarea></label>
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
      renderAnalysis(m, out.result, text);
    } catch (e) {
      toast("분석 실패: " + e.message, true);
    }
    btn.disabled = false; btn.textContent = "분석하기";
  };
}

function renderAnalysis(m, r, rawText) {
  S.lastAnalysis = r;
  const cond = r.cond || {};
  const bens = r.benefits || [];
  const total = bens.reduce((s, b) => s + Number(b.back || 0), 0);
  const j = judge(r.issuer, cond);
  const end = pDate(r.endApply);
  let vtxt, vcls;
  if (j.hardBlock) { vtxt = "대상 제외"; vcls = "no"; }
  else if (end && end < today()) { vtxt = "응모 마감"; vcls = "off"; }
  else if (j.ok) { vtxt = "응모 가능"; vcls = "ok"; }
  else { vtxt = "D-" + j.wait + " 후 가능 (" + fDateK(j.openDay) + "~)"; vcls = "wait"; }

  const out = m.querySelector("#an-out");
  out.innerHTML = `
    <div class="an-result">
      <div class="promo-head">
        <div>
          <div class="promo-issuer">${esc(r.issuer || "카드사 미상")}${r.platform ? " · " + esc(r.platform) : ""}${r.brand ? " · " + esc(r.brand) : ""}</div>
          <b>${esc(r.name || "이벤트")}</b>
        </div>
        <span class="pill ${vcls}">${vtxt}</span>
      </div>
      ${r.summary ? `<p class="an-sum">${esc(r.summary)}</p>` : ""}
      ${j.hardBlock ? `<div class="promo-block bad">⛔ ${esc(j.hardBlock)}</div>` : ""}
      ${!j.ok && !j.hardBlock && j.blocking.length ? `<div class="promo-block">🔒 ${esc(j.blocking[0].label)}</div>` : ""}
      <div class="promo-total"><span>혜택 합계</span><b class="green">${fWon(total)}</b></div>
      ${bens.map(b => `
        <div class="ben">
          <div class="ben-top"><b>${esc(b.kind || "혜택")}</b><b class="green">+${fWon(b.back)}</b></div>
          <div class="ben-sum">${esc(b.summary || "")}</div>
          <div class="ben-date">${b.need ? fWon(b.need) + " 결제 · " : ""}${b.payS ? fDateK(b.payS) + "~" : ""}${b.payE ? fDateK(b.payE) : ""}${b.when ? " · 지급 " + esc(b.when) : ""}</div>
        </div>`).join("")}
      <div class="an-cond">
        <b>자격 조건</b>
        <span>무실적 ${cond.noUse != null ? cond.noUse + "개월" : "미확인(기본 " + CONFIG.DEFAULTS.noUse + ")"}
        · 수혜제한 ${cond.benSince ? fDateK(cond.benSince) + " 이후 무수혜" : (cond.benLimit != null ? cond.benLimit + "개월" : "미확인(기본 " + CONFIG.DEFAULTS.benLimit + ")")}
        · 회수방지 ${cond.hold != null ? cond.hold + "개월" : "미확인(기본 " + CONFIG.DEFAULTS.hold + ")"}</span>
      </div>
      ${(r.cautions || []).length ? `<h4>꼭 알아야 할 것</h4><ul class="cautions">${r.cautions.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <p class="hint">AI 판독 결과는 틀릴 수 있어요. 응모 전에 원문과 한 번 대조하고, 무실적·수혜이력은 카드사 전화 상담으로 확정하세요.</p>
      <div class="modal-btns">
        <button class="cta" id="an-add">후보군에 담기</button>
      </div>
    </div>`;

  out.querySelector("#an-add").onclick = async () => {
    try {
      const fields = packEventFields({
        status: "후보", issuer: r.issuer || "", name: r.name || "이벤트",
        platform: r.platform || "", brand: r.brand || "", endApply: r.endApply || "",
        applied: "", confirmed: false,
        data: { cond, benefits: bens, cautions: r.cautions || [] },
        raw: (rawText || "").slice(0, 20000), memo: ""
      });
      await api("add", { table: "이벤트", fields });
      closeModal();
      toast("후보군에 담았어요.");
      await loadAll();
      S.tab = "promo"; render();
    } catch (e) { toast(e.message, true); }
  };
  if (out.scrollIntoView) out.scrollIntoView({ behavior: "smooth", block: "start" });
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
   탭 3 — 아카이브
   ================================================================ */
function renderArchive(main) {
  const evs = S.events.filter(e => e.owner === S.user.name && (e.status === "완료" || e.status === "포기"));
  const quitCards = S.cards.filter(c => c.owner === S.user.name && c.status === "해지");
  const totalGot = evs.reduce((s, e) => s + (e.data.benefits || []).reduce((t, b) => t + Number(b.paidAmt || 0), 0), 0);

  main.appendChild(el(`
    <section class="hero archive">
      <div class="hero-label">지금까지 받은 캐시백</div>
      <div class="hero-num">${fWonFull(totalGot)}<span class="won">원</span></div>
      <div class="hero-sub">끝난 프로모션 ${evs.length}건 · 해지한 카드 ${quitCards.length}장</div>
    </section>`));

  main.appendChild(el(`<div class="sec-head"><h2>끝난 프로모션</h2></div>`));
  if (!evs.length) main.appendChild(el(`<div class="empty">아직 없어요. 프로모션 상세에서 "모든 지급 끝 · 아카이브"를 누르면 여기로 옵니다.</div>`));
  evs.forEach(ev => {
    const got = (ev.data.benefits || []).reduce((t, b) => t + Number(b.paidAmt || 0), 0);
    const lastPaid = maxDate((ev.data.benefits || []).map(b => b.paidDate));
    const qs = quitSafeDay(ev);
    const myCard = S.cards.find(c => c.issuer === ev.issuer && c.owner === S.user.name);
    const quitRisk = qs && myCard && myCard.quit && pDate(myCard.quit) < qs;
    const row = el(`
      <section class="arch-row ${ev.status === "포기" ? "off" : ""}">
        <div class="arch-main">
          <b>${esc(ev.issuer)} · ${esc(ev.name)}</b>
          <span>${esc(ev.platform || "")}${ev.applied ? " · 신청 " + fDateK(ev.applied) : ""}${lastPaid ? " · 마지막 지급 " + fDateK(lastPaid) : ""}</span>
          ${qs && !myCard?.quit ? `<span class="warn-txt">해지 금지 ${fDateK(qs)}까지</span>` : ""}
          ${quitRisk ? `<span class="warn-txt bad">⚠ 해지 금지 기간 내 해지 — 회수 여부 확인 필요</span>` : ""}
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
      <section class="arch-row">
        <div class="arch-main">
          <b>${esc(c.issuer)} · ${esc(c.name || "카드명 미입력")}</b>
          <span>마지막 사용 ${fDateK(c.lastUse)} · 해지 ${fDateK(c.quit)}</span>
        </div>
        <div class="arch-amt off">해지</div>
      </section>`);
    row.onclick = () => openCardForm(c);
    main.appendChild(row);
  });
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
}
