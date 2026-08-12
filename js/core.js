/* ================================================================
   core.js - 상태 / API / 날짜 유틸 / 응모 자격 판정 엔진
   ================================================================ */
const S = {
  user: null,          // {id, pw, name}
  cards: [],           // 시트 '카드' 행
  events: [],          // 시트 '이벤트' 행 (data는 파싱된 객체)
  tab: "cards",
  server: "",          // 배포된 Apps Script 버전
  promoTab: "active",  // 프로모션 탭: active(참여 중) / cand(후보군)
  cardTab: "active",   // 내 카드 탭: active(쓰는 중) / resting(쉬는 중) / all
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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* 서버 한 번 호출.
   Apps Script는 문제가 생기면 JSON 대신 HTML 오류 페이지를 돌려주는데,
   그대로 두면 "Unexpected token <" 같은 알아볼 수 없는 메시지가 사용자에게 뜬다.
   그래서 응답을 먼저 글자로 받아 JSON인지 확인하고, 일시적인 실패는 몇 번 다시 시도한다. */
async function api(action, payload, opt) {
  opt = opt || {};
  if (!CONFIG.APPS_SCRIPT_URL) throw new Error("config.js의 APPS_SCRIPT_URL이 비어 있습니다.");
  const body = Object.assign({ action }, payload || {});
  if (S.user) { body.id = S.user.id; body.pw = S.user.pw; }
  const text = JSON.stringify(body);
  const tries = opt.tries || 3;
  let lastErr = null;

  for (let i = 0; i < tries; i++) {
    if (i) await sleep(700 * i);
    let raw;
    try {
      const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: text
      });
      raw = await res.text();
    } catch (e) {
      // 네트워크가 끊겼거나 서버가 응답 자체를 못 준 경우
      lastErr = new Error("서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      continue;
    }

    let out;
    try {
      out = JSON.parse(raw);
    } catch (e) {
      // HTML이 돌아온 경우. 대개 동시 요청이 몰렸거나 배포 설정 문제다.
      lastErr = new Error(/DOCTYPE|<html/i.test(raw)
        ? "서버가 잠시 응답하지 못했어요. 다른 사람이 동시에 쓰고 있으면 생길 수 있으니 잠시 뒤 다시 시도해 주세요."
        : "서버 응답을 알아볼 수 없어요.");
      continue;
    }

    if (out.server) S.server = out.server;
    if (!out.ok) throw new Error(out.error || "요청에 실패했습니다.");
    return out;
  }
  throw lastErr || new Error("요청에 실패했습니다.");
}

/* 캡처는 한 장씩 따로 올린다.
   한 번에 다 보내면 요청이 너무 무거워 저장 자체가 실패할 수 있다.
   실패해도 이벤트 저장에는 영향을 주지 않는다. */
async function uploadShots(no, images, onProgress) {
  if (!images || !images.length) return { done: 0, failed: 0 };
  let done = 0, failed = 0;
  for (let i = 0; i < images.length; i++) {
    if (onProgress) onProgress(i + 1, images.length);
    try {
      await api("shot", { no: String(no), image: images[i] }, { tries: 2 });
      done++;
    } catch (e) { failed++; }
  }
  return { done, failed };
}

async function loadAll() {
  const out = await api("rows");
  const me = S.user && S.user.name;
  // 시트는 함께 쓰지만 화면에는 로그인한 사람 데이터만 올린다
  S.cards = (out.cards || []).map(normCard).filter(c => !me || c.owner === me);
  S.events = (out.events || []).map(normEvent).filter(e => !me || e.owner === me);
  S.dirty = false;
}

function normCard(r) {
  return {
    no: String(r.no), owner: r["사용자"], issuer: r["카드사"], name: r["카드명"] || "",
    brand: r["브랜드"] || "", channel: r["발급채널"] || "", issued: r["발급일"] || "",
    fee: r["연회비"] || "", lastUse: r["최근사용일"] || "", status: r["상태"] || "사용중",
    quit: r["해지일"] || "", memo: r["메모"] || "", image: r["이미지"] || ""
  };
}

/* 카드 표지 이미지: 저장하지 않고 원본 주소를 그대로 부른다.
   주소가 없거나 불러오지 못하면 카드사 색 그라디언트로 대체된다. */
function cardImg(c) {
  const u = String((c && c.image) || "").trim();
  return /^https:\/\//.test(u) ? u : "";
}

/* 이 카드사의 내 카드 중 표지가 있는 것 하나 */
function issuerImg(issuer) {
  const c = S.cards.find(x => x.issuer === issuer && x.owner === S.user.name && cardImg(x));
  return c ? cardImg(c) : "";
}
function normEvent(r) {
  let data = {};
  try { data = JSON.parse(r["데이터JSON"] || "{}"); } catch (e) { data = {}; }
  data.cond = data.cond || {};
  data.cautions = data.cautions || [];
  data.benefits = (data.benefits || []).map(normBenefit);
  return {
    no: String(r.no), owner: r["사용자"], status: r["상태"] || "후보",
    issuer: r["카드사"] || "", name: r["이벤트명"] || "", platform: r["플랫폼"] || "",
    brand: r["브랜드"] || "", endApply: r["응모마감"] || "", applied: r["신청일"] || "",
    confirmed: r["상담확인"] === "Y", data, raw: r["원문"] || "", memo: r["메모"] || ""
  };
}

/* 혜택 하나를 앱이 다루는 형태로 맞춘다.
   pick: try(도전) / maybe(고민 중) / skip(관심없음)
   todos: 조건을 채우려면 확인해야 할 것들의 체크리스트
   keep: 지급받을 때까지 유지해야 하는 것 */
function normBenefit(b, i) {
  b = b || {};
  if (!PICKS[b.pick]) b.pick = (i === 0 || /기본/.test(b.kind || "")) ? "try" : "maybe";
  b.todos = (b.todos || []).map(t => (typeof t === "string" ? { t: t, done: false } : { t: String(t.t || ""), done: !!t.done }));
  b.keep = b.keep || "";
  b.spent = Number(b.spent || 0);
  return b;
}

/* pick 값이 비었거나 알 수 없는 값이어도 안전하게 다룬다 */
function pickOf(b) { return PICKS[(b && b.pick) || ""] || PICKS.maybe; }

const PICKS = {
  try: { label: "도전", cls: "try" },
  maybe: { label: "고민 중", cls: "maybe" },
  skip: { label: "관심없음", cls: "skip" }
};

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

/* 무실적 조건은 "이벤트 시작일 기준 직전 N개월"이다.
   이벤트는 보통 월 1일에 시작하므로, 마지막 결제월 + N + 1 월의 1일부터 대상이 된다.
   예: 26.2.5 결제, 무실적 6개월 -> 8월 이벤트는 조회기간(2.1~7.31)에 걸려 탈락, 9월 1일 시작 이벤트부터 가능 */
function noUseOpenDay(lastUse, months) {
  const d = pDate(lastUse);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth() + months + 1, 1);
}

/* 이 카드사에 대해 내가 등록해둔 공고 중 가장 최근 것의 조건을 쓴다.
   공고를 새로 담을 때마다 판정 기준이 저절로 갱신된다. */
function hasCond(c) {
  if (!c) return false;
  return ["noUse", "benLimit", "quitWait", "hold"].some(k => c[k] != null && c[k] !== "")
    || (c.benSince != null && c.benSince !== "");
}

function issuerCondInfo(issuer, owner) {
  owner = owner || (S.user && S.user.name);
  const evs = S.events.filter(e => e.owner === owner && e.issuer === issuer && hasCond(e.data && e.data.cond));
  if (!evs.length) return { cond: {}, from: "" };
  evs.sort((a, b) => Number(b.no) - Number(a.no));
  return { cond: evs[0].data.cond, from: evs[0].name };
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
    const d = noUseOpenDay(h.lastUse, noUse);
    if (d > open) { open = d; }
    reasons.push({
      key: "use",
      label: "마지막 결제 " + fDateK(h.lastUse) + ", 무실적 " + noUse + "개월이라 "
        + (d.getFullYear() % 100) + "." + (d.getMonth() + 1) + "월 시작 이벤트부터",
      until: d
    });
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

/* 조건별로 충족 여부와 근거를 따로 뽑는다.
   무실적과 수혜 이력이 핵심 두 가지이고, 해지 이력이 있으면 하나 더 붙는다. */
function conditionChecks(issuer, cond) {
  cond = cond || {};
  const D = CONFIG.DEFAULTS;
  const h = myHistory(issuer);
  const noUse = cond.noUse != null ? cond.noUse : D.noUse;
  const benLimit = cond.benLimit != null ? cond.benLimit : D.benLimit;
  const quitWait = cond.quitWait != null ? cond.quitWait : D.quitWait;
  const out = [];

  // 1. 무실적
  const c1 = {
    name: "무실적",
    rule: "이벤트 시작월 직전 " + noUse + "개월간 결제 없어야 함",
    def: cond.noUse == null
  };
  if (!h.lastUse) {
    c1.ok = true; c1.mine = "이 카드사 결제 이력 없음";
  } else {
    const u = noUseOpenDay(h.lastUse, noUse);
    c1.until = u;
    c1.ok = u <= today();
    c1.mine = "마지막 결제 " + fDateK(h.lastUse);
    c1.gap = c1.ok ? "" : (u.getFullYear() % 100) + "." + (u.getMonth() + 1) + "월 시작 이벤트부터, " + daysTo(u) + "일 남음";
  }
  out.push(c1);

  // 2. 수혜 이력
  const c2 = { name: "수혜 이력" };
  if (cond.benSince) {
    c2.rule = fDateK(cond.benSince) + " 이후 수혜 이력 없어야 함";
    if (!h.lastCash) { c2.ok = true; c2.mine = "수혜 이력 없음"; }
    else if (pDate(h.lastCash) >= pDate(cond.benSince)) {
      c2.ok = false; c2.hard = true;
      c2.mine = "마지막 수혜 " + fDateK(h.lastCash);
      c2.gap = "기준일 이후라 기다려도 풀리지 않음";
    } else {
      c2.ok = true; c2.mine = "마지막 수혜 " + fDateK(h.lastCash) + ", 기준일 이전";
    }
  } else {
    c2.rule = "마지막 수혜 후 " + benLimit + "개월 지나야 함";
    c2.def = cond.benLimit == null;
    if (!h.lastCash) { c2.ok = true; c2.mine = "수혜 이력 없음"; }
    else {
      const u = addMonths(h.lastCash, benLimit); u.setDate(u.getDate() + 1);
      c2.until = u; c2.ok = u <= today();
      c2.mine = "마지막 수혜 " + fDateK(h.lastCash);
      c2.gap = c2.ok ? "" : fDateK(u) + "부터, " + daysTo(u) + "일 남음";
    }
  }
  out.push(c2);

  // 3. 해지 이력이 있을 때만
  if (h.lastQuit) {
    const u = addMonths(h.lastQuit, quitWait); u.setDate(u.getDate() + 1);
    const ok = u <= today();
    out.push({
      name: "해지 후 대기", rule: "해지 후 " + quitWait + "개월", def: cond.quitWait == null,
      mine: "해지 " + fDateK(h.lastQuit), ok: ok, until: u,
      gap: ok ? "" : fDateK(u) + "부터, " + daysTo(u) + "일 남음"
    });
  }
  return out;
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
  let expect = 0, maybe = 0, got = 0, urgent = [], todo = 0;
  S.events.filter(e => e.status === "신청").forEach(e => {
    (e.data.benefits || []).forEach(b => {
      const pk = pickKey(b);
      if (pk === "skip") return;
      if (b.paidDate) { got += Number(b.paidAmt || b.back || 0); return; }
      if (pk === "maybe") { maybe += Number(b.back || 0); return; }
      expect += Number(b.back || 0);
      todo += (b.todos || []).filter(t => !t.done).length;
      const st = benState(b);
      if (st.cls === "no" || (st.cls === "wait" && b.need && Number(b.spent || 0) < Number(b.need))) {
        const dd = b.payE ? daysTo(b.payE) : null;
        if (dd != null && dd >= 0 && dd <= 30) urgent.push({ ev: e, b, dd });
      }
    });
  });
  urgent.sort((a, b) => a.dd - b.dd);
  return { expect, maybe, got, urgent, todo };
}

/* 이 이벤트에서 지금 신경 써야 할 것들 (도전으로 고른 혜택 기준) */
function activeBens(ev) {
  return (ev.data.benefits || []).filter(b => pickKey(b) === "try");
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

function pickKey(b) { return PICKS[(b && b.pick) || ""] ? b.pick : "maybe"; }

/* ================================================================
   연도별 결산 집계
   지급 완료: 실제 들어온 날짜의 연도로 잡는다.
   지급 예정: 지급 시기 문구에서 연도를 읽고, 없으면 결제 마감일 연도로 잡는다.
   ================================================================ */
function yearOfPaid(b) {
  const d = pDate(b.paidDate);
  return d ? d.getFullYear() : null;
}

function yearOfExpect(b) {
  const w = String(b.when || "");
  let m = w.match(/(20\d{2})\s*년/);
  if (m) return +m[1];
  m = w.match(/(\d{2})\s*년/);
  if (m) return 2000 + +m[1];
  const d = pDate(b.payE);
  return d ? d.getFullYear() : new Date().getFullYear();
}

/* 혜택 하나를 한 줄로 펼친다. 결산의 모든 계산이 이 목록에서 나온다.
   owner가 비어 있으면 전체 사용자 */
function flatEntries(owner) {
  const out = [];
  S.events.filter(e => (!owner || e.owner === owner) && e.status !== "포기").forEach(e => {
    (e.data.benefits || []).forEach(b => {
      const paid = Number(b.paidAmt || 0);
      if (b.paidDate && paid) {
        out.push({
          owner: e.owner, issuer: e.issuer, year: yearOfPaid(b), amount: paid, kind: "paid",
          date: b.paidDate, event: e.name, ben: b.kind || "", platform: e.platform || ""
        });
        return;
      }
      if (b.paidDate) return;                    // 지급됐는데 금액 미입력
      if (pickKey(b) !== "try") return;          // 도전한 것만 예정으로
      if (e.status !== "신청") return;
      const amt = Number(b.back || 0);
      if (!amt) return;
      out.push({
        owner: e.owner, issuer: e.issuer, year: yearOfExpect(b), amount: amt, kind: "expect",
        date: b.payE || "", event: e.name, ben: b.kind || "", platform: e.platform || ""
      });
    });
  });
  return out;
}

/* 교차표: 행은 카드사, 열은 연도. 총계는 오른쪽 끝과 맨 아래에만 둔다. */
function crossReport(owner) {
  const rows = flatEntries(owner);
  const years = [];
  rows.forEach(r => { if (years.indexOf(r.year) < 0) years.push(r.year); });
  years.sort((a, b) => a - b);

  const map = {};
  rows.forEach(r => {
    map[r.issuer] = map[r.issuer] || { issuer: r.issuer, byYear: {}, paid: 0, expect: 0 };
    map[r.issuer].byYear[r.year] = map[r.issuer].byYear[r.year] || { paid: 0, expect: 0 };
    map[r.issuer].byYear[r.year][r.kind] += r.amount;
    map[r.issuer][r.kind] += r.amount;
  });

  const cards = S.cards.filter(c => !owner || c.owner === owner);
  const issuers = Object.keys(map).map(k => {
    const m = map[k];
    const card = cards.filter(c => c.issuer === m.issuer)
      .sort((a, b) => (pDate(b.lastUse) || 0) - (pDate(a.lastUse) || 0))[0];
    m.status = card ? card.status : "";
    m.quit = card ? card.quit : "";
    m.total = m.paid + m.expect;
    return m;
  }).sort((a, b) => b.total - a.total);

  const colTotals = {};
  years.forEach(y => {
    colTotals[y] = { paid: 0, expect: 0 };
    issuers.forEach(i => {
      const c = i.byYear[y];
      if (c) { colTotals[y].paid += c.paid; colTotals[y].expect += c.expect; }
    });
  });

  return {
    years, issuers, colTotals, rows,
    grandPaid: issuers.reduce((s, i) => s + i.paid, 0),
    grandExpect: issuers.reduce((s, i) => s + i.expect, 0)
  };
}

/* owner가 비어 있으면 전체 사용자 */
function yearReport(owner) {
  const cards = S.cards.filter(c => !owner || c.owner === owner);
  const years = {};   // {연도: {issuer: {paid, expect}}}

  S.events.filter(e => (!owner || e.owner === owner) && e.status !== "포기").forEach(e => {
    (e.data.benefits || []).forEach(b => {
      const amtPaid = Number(b.paidAmt || 0);
      const y = b.paidDate ? yearOfPaid(b) : null;
      if (y && amtPaid) {
        years[y] = years[y] || {};
        years[y][e.issuer] = years[y][e.issuer] || { paid: 0, expect: 0 };
        years[y][e.issuer].paid += amtPaid;
        return;
      }
      if (b.paidDate) return;                       // 지급됐는데 금액 미입력이면 건너뜀
      if (pickKey(b) !== "try") return;             // 도전한 것만 예정으로 잡는다
      if (e.status !== "신청") return;
      const amt = Number(b.back || 0);
      if (!amt) return;
      const ey = yearOfExpect(b);
      years[ey] = years[ey] || {};
      years[ey][e.issuer] = years[ey][e.issuer] || { paid: 0, expect: 0 };
      years[ey][e.issuer].expect += amt;
    });
  });

  return Object.keys(years).map(Number).sort((a, b) => b - a).map(y => {
    const rows = Object.keys(years[y]).map(iss => {
      const card = cards.filter(c => c.issuer === iss)
        .sort((a, b) => (pDate(b.lastUse) || 0) - (pDate(a.lastUse) || 0))[0];
      return {
        issuer: iss,
        paid: years[y][iss].paid,
        expect: years[y][iss].expect,
        status: card ? card.status : "",
        quit: card ? card.quit : "",
        lastUse: card ? card.lastUse : ""
      };
    }).sort((a, b) => (b.paid + b.expect) - (a.paid + a.expect));
    return {
      year: y, rows,
      paid: rows.reduce((s, r) => s + r.paid, 0),
      expect: rows.reduce((s, r) => s + r.expect, 0)
    };
  });
}



/* ================================================================
   카드 사용 신호등
   마지막 결제일이 얼마나 지났는지로 등급을 나눈다.
   ================================================================ */
const USAGE_TIERS = [
  { key: "t1", days: 90, label: "3개월 내", short: "활발" },
  { key: "t2", days: 180, label: "6개월 내", short: "가끔" },
  { key: "t3", days: 365, label: "1년 내", short: "쉬는 중" },
  { key: "t4", days: 730, label: "2년 내", short: "오래 쉼" },
  { key: "t5", days: Infinity, label: "2년 이상", short: "장기 휴면" }
];

function usageTier(c) {
  if (c.status === "해지") return { key: "quit", label: "해지", short: "해지", days: null };
  const d = pDate(c.lastUse);
  if (!d) return { key: "none", label: "사용 기록 없음", short: "기록 없음", days: null };
  const days = Math.floor((today() - d) / 86400000);
  const t = USAGE_TIERS.find(x => days < x.days) || USAGE_TIERS[USAGE_TIERS.length - 1];
  return { key: t.key, label: t.label, short: t.short, days: days };
}

/* 며칠 전인지 사람 말로 */
function agoText(c) {
  const t = usageTier(c);
  if (t.days == null) return t.label;
  if (t.days === 0) return "오늘";
  if (t.days === 1) return "어제";
  if (t.days < 30) return t.days + "일 전";
  if (t.days < 365) return Math.floor(t.days / 30) + "개월 전";
  return (Math.floor(t.days / 30.4 / 12 * 10) / 10) + "년 전";
}

/* 최근 사용 순으로 정렬. 기록 없는 카드는 뒤로 */
function sortByRecent(cards) {
  return cards.slice().sort((a, b) => {
    const av = pDate(a.lastUse), bv = pDate(b.lastUse);
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return bv - av;
  });
}
