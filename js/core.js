/* ================================================================
   core.js - 상태 / API / 날짜 유틸 / 응모 자격 판정 엔진
   ================================================================ */
const S = {
  user: null,          // {id, pw, name}
  cards: [],           // 시트 '카드' 행
  events: [],          // 시트 '이벤트' 행 (data는 파싱된 객체)
  tab: "cards",
  dirty: false,
  lastAnalysis: null   // 분석 모달 결과 임시 보관
};

/* ---------- 날짜 ---------- */
function today() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
function pDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim().replace(/[./]/g, "-");
  const m = s.match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  let y = +m[1]; if (y < 100) y += 2000;
  const d = new Date(y, +m[2] - 1, +m[3]);
  return isNaN(d) ? null : d;
}
function fDate(d) {
  d = pDate(d);
  if (!d) return "";
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fDateK(d) {
  d = pDate(d);
  if (!d) return "-";
  return (d.getFullYear() % 100) + "." + (d.getMonth() + 1) + "." + d.getDate();
}
function addMonths(d, m) {
  d = pDate(d); if (!d) return null;
  const r = new Date(d); r.setMonth(r.getMonth() + m);
  return r;
}
function daysTo(d) {
  d = pDate(d); if (!d) return null;
  return Math.round((d - today()) / 86400000);
}
function maxDate(arr) {
  const ds = arr.map(pDate).filter(Boolean);
  return ds.length ? new Date(Math.max.apply(null, ds)) : null;
}
function fWon(n) {
  n = Number(n);
  if (!n && n !== 0) return "-";
  if (n >= 10000 && n % 10000 === 0) return (n / 10000) + "만원";
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "만원";
  return n.toLocaleString("ko-KR") + "원";
}
function fWonFull(n) {
  n = Number(n);
  if (!n && n !== 0) return "0";
  return n.toLocaleString("ko-KR");
}

/* ---------- API ---------- */
async function api(action, payload) {
  if (!CONFIG.APPS_SCRIPT_URL) throw new Error("config.js의 APPS_SCRIPT_URL이 비어 있습니다.");
  const body = Object.assign({ action }, payload || {});
  if (S.user) { body.id = S.user.id; body.pw = S.user.pw; }
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || "요청에 실패했습니다.");
  return out;
}

async function loadAll() {
  const out = await api("rows");
  S.cards = (out.cards || []).map(normCard);
  S.events = (out.events || []).map(normEvent);
  S.dirty = false;
}

function normCard(r) {
  return {
    no: String(r.no), owner: r["사용자"], issuer: r["카드사"], name: r["카드명"] || "",
    brand: r["브랜드"] || "", channel: r["발급채널"] || "", issued: r["발급일"] || "",
    fee: r["연회비"] || "", lastUse: r["최근사용일"] || "", status: r["상태"] || "사용중",
    quit: r["해지일"] || "", memo: r["메모"] || ""
  };
}
function normEvent(r) {
  let data = {};
  try { data = JSON.parse(r["데이터JSON"] || "{}"); } catch (e) { data = {}; }
  data.cond = data.cond || {};
  data.benefits = data.benefits || [];
  data.cautions = data.cautions || [];
  return {
    no: String(r.no), owner: r["사용자"], status: r["상태"] || "후보",
    issuer: r["카드사"] || "", name: r["이벤트명"] || "", platform: r["플랫폼"] || "",
    brand: r["브랜드"] || "", endApply: r["응모마감"] || "", applied: r["신청일"] || "",
    confirmed: r["상담확인"] === "Y", data, raw: r["원문"] || "", memo: r["메모"] || ""
  };
}

function packEventFields(ev) {
  return {
    "상태": ev.status, "카드사": ev.issuer, "이벤트명": ev.name, "플랫폼": ev.platform,
    "브랜드": ev.brand, "응모마감": fDate(ev.endApply), "신청일": fDate(ev.applied),
    "상담확인": ev.confirmed ? "Y" : "N", "데이터JSON": JSON.stringify(ev.data),
    "원문": ev.raw || "", "메모": ev.memo || ""
  };
}

/* ---------- 자격 판정 엔진 ----------
   내 이력(카드 + 이벤트 지급 내역)과 이벤트 조건을 대조한다.
   조건 cond: {noUse, benLimit, benSince, quitWait, hold} - 개월 수 / benSince는 날짜
------------------------------------------------------------------ */
function myHistory(issuer) {
  const cards = S.cards.filter(c => c.issuer === issuer);
  const lastUse = maxDate(cards.map(c => c.lastUse));
  const lastQuit = maxDate(cards.map(c => c.quit));
  const paids = [];
  S.events.filter(e => e.issuer === issuer).forEach(e => {
    (e.data.benefits || []).forEach(b => { if (b.paidDate) paids.push(b.paidDate); });
  });
  const lastCash = maxDate(paids);
  return { lastUse, lastQuit, lastCash };
}

function judge(issuer, cond) {
  cond = cond || {};
  const D = CONFIG.DEFAULTS;
  const h = myHistory(issuer);
  const used = [];
  const noUse = cond.noUse != null ? cond.noUse : (used.push("무실적 " + D.noUse + "개월(기본값)"), D.noUse);
  const benLimit = cond.benLimit != null ? cond.benLimit : D.benLimit;
  const quitWait = cond.quitWait != null ? cond.quitWait : D.quitWait;

  const reasons = [];
  let open = today();
  if (h.lastUse) {
    const d = addMonths(h.lastUse, noUse); d.setDate(d.getDate() + 1);
    if (d > open) { open = d; }
    reasons.push({ key: "use", label: "마지막 결제 " + fDateK(h.lastUse) + " + 무실적 " + noUse + "개월", until: d });
  }
  if (h.lastCash) {
    const d = addMonths(h.lastCash, benLimit); d.setDate(d.getDate() + 1);
    if (d > open) { open = d; }
    reasons.push({ key: "cash", label: "마지막 캐시백 " + fDateK(h.lastCash) + " + 제한 " + benLimit + "개월", until: d });
  }
  if (h.lastQuit) {
    const d = addMonths(h.lastQuit, quitWait); d.setDate(d.getDate() + 1);
    if (d > open) { open = d; }
    reasons.push({ key: "quit", label: "해지 " + fDateK(h.lastQuit) + " + 대기 " + quitWait + "개월", until: d });
  }

  // 절대 기준일형: "YYYY-MM-DD 이후 수혜 이력이 없어야 함"
  let hardBlock = null;
  if (cond.benSince && h.lastCash && pDate(h.lastCash) >= pDate(cond.benSince)) {
    hardBlock = fDateK(cond.benSince) + " 이후 수혜 이력(" + fDateK(h.lastCash) + ")이 있어 대상 제외";
  }

  const openOk = open <= today();
  return {
    hist: h, openDay: open, ok: !hardBlock && openOk, hardBlock,
    wait: openOk ? 0 : daysTo(open),
    blocking: reasons.filter(r => r.until > today()).sort((a, b) => b.until - a.until),
    usedDefault: used
  };
}

/* 이벤트 하나에 대한 종합 판정 문자열 */
function verdictOf(ev) {
  const j = judge(ev.issuer, ev.data.cond);
  const end = pDate(ev.endApply);
  if (ev.status === "신청") return { cls: "ok", txt: "참여 중", j };
  if (ev.status === "완료") return { cls: "done", txt: "지급 완료", j };
  if (ev.status === "포기") return { cls: "off", txt: "포기", j };
  if (j.hardBlock) return { cls: "no", txt: "대상 제외", j };
  if (end && end < today()) return { cls: "off", txt: "응모 마감", j };
  if (j.ok) return { cls: "ok", txt: "응모 가능", j };
  return { cls: "wait", txt: "D-" + j.wait + " 후 가능", j };
}

/* 혜택 진행 상태 */
function benState(b) {
  if (b.paidDate) return { cls: "done", txt: "지급 완료" };
  const e = pDate(b.payE);
  if (b.need && Number(b.spent || 0) >= Number(b.need)) return { cls: "ok", txt: "조건 충족" };
  if (e && e < today()) return { cls: "off", txt: "기간 종료" };
  const dd = e ? daysTo(e) : null;
  if (dd != null && dd <= 7) return { cls: "no", txt: "D-" + dd + " 마감 임박" };
  return { cls: "wait", txt: dd != null ? "D-" + dd : "진행 중" };
}

/* 해지 가능일: 이벤트의 마지막 지급일 + hold개월 */
function quitSafeDay(ev) {
  const hold = ev.data.cond.hold != null ? ev.data.cond.hold : CONFIG.DEFAULTS.hold;
  const last = maxDate((ev.data.benefits || []).map(b => b.paidDate));
  return last ? addMonths(last, hold) : null;
}

/* 홈 요약 수치 */
function summary() {
  let expect = 0, got = 0, urgent = [];
  S.events.filter(e => e.status === "신청").forEach(e => {
    (e.data.benefits || []).forEach(b => {
      if (b.paidDate) got += Number(b.paidAmt || b.back || 0);
      else expect += Number(b.back || 0);
      const st = benState(b);
      if (st.cls === "no" || (st.cls === "wait" && b.need && Number(b.spent || 0) < Number(b.need))) {
        const dd = b.payE ? daysTo(b.payE) : null;
        if (dd != null && dd >= 0 && dd <= 30) urgent.push({ ev: e, b, dd });
      }
    });
  });
  urgent.sort((a, b) => a.dd - b.dd);
  return { expect, got, urgent };
}

/* ---------- 공용 DOM ---------- */
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(msg, bad) {
  const t = el('<div class="toast' + (bad ? " bad" : "") + '">' + esc(msg) + "</div>");
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
}
