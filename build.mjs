// SJ Workboard 읽기 전용 사본 생성기
// board.json -> Today / 이번 주 / 이번 달 HTML -> 비밀번호로 AES-256-GCM 암호화 -> index.html
// 비밀번호는 repo 밖(sj-workboard-data/secrets)에만 둔다. 출력에 비밀번호를 찍지 않는다.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { webcrypto as crypto, createHash, randomInt } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BOARD_DATA_DIR || "C:\\Users\\qqqqq\\sj-workboard-data";
const BOARD = join(DATA_DIR, "board.json");
const SECRET_DIR = join(DATA_DIR, "secrets");
const PW_FILE = join(SECRET_DIR, "view-password.txt");
const OUT = process.env.VIEW_OUT || join(HERE, "docs", "index.html");
const STATE = join(HERE, ".last-build");
const ITER = 600000;
const FORCE = process.argv.includes("--force");

function password() {
  if (existsSync(PW_FILE)) return readFileSync(PW_FILE, "utf8").trim();
  mkdirSync(SECRET_DIR, { recursive: true });
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  const groups = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => abc[randomInt(abc.length)]).join(""));
  const pw = groups.join("-");
  writeFileSync(PW_FILE, pw + "\n", "utf8");
  console.log("새 비밀번호를 만들었어요:", PW_FILE);
  return pw;
}

const ymd = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (s) => new Date(s + "T00:00:00Z").getUTCDay(); // 0=일
const KDOW = ["일", "월", "화", "수", "목", "금", "토"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PRI = { P0: 0, P1: 1, P2: 2, P3: 3 };

function render(board, now) {
  const d = board.data;
  const today = ymd(now);
  const projName = new Map((d.projects || []).map((p) => [p.id, p.name]));
  const pname = (t) => (t.project ? projName.get(t.project) ?? t.project : "");
  const tasks = d.tasks || [];
  const open = tasks.filter((t) => t.status === "TODO");
  const doneOn = (t) => (t.completedAt ? ymd(new Date(t.completedAt)) : t.dueDate);
  const sortT = (a, b) => (a.dueDate || "").localeCompare(b.dueDate || "") || (PRI[a.priority] ?? 9) - (PRI[b.priority] ?? 9);

  const item = (t, opts = {}) => {
    const done = t.status === "DONE";
    const meta = [pname(t), opts.showDate && t.dueDate ? t.dueDate.slice(5).replace("-", "/") : "", t.rolloverFrom ? "이월" : ""]
      .filter(Boolean).map(esc).join(" · ");
    return `<li class="${done ? "done" : ""}"><span class="pri p${esc(t.priority)}">${esc(t.priority || "")}</span><span class="tt">${esc(t.title)}${meta ? `<small>${meta}</small>` : ""}</span></li>`;
  };
  const list = (arr, opts) => (arr.length ? `<ul>${arr.map((t) => item(t, opts)).join("")}</ul>` : `<p class="empty">없음</p>`);

  // Today
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort(sortT);
  const todayOpen = open.filter((t) => t.dueDate === today).sort(sortT);
  const todayDone = tasks.filter((t) => t.status === "DONE" && doneOn(t) === today);
  const goalsToday = (d.goals || []).filter((g) => g.scope === "DAY" && g.periodKey === today);
  const todayHtml = `
    ${goalsToday.length ? `<h3>오늘 목표</h3><ul>${goalsToday.map((g) => `<li class="${g.done ? "done" : ""}"><span class="tt">${esc(g.title)}</span></li>`).join("")}</ul>` : ""}
    ${overdue.length ? `<h3 class="warn">놓친 것 ${overdue.length}</h3>${list(overdue, { showDate: true })}` : ""}
    <h3>오늘 할 일 ${todayOpen.length}</h3>${list(todayOpen)}
    <h3>오늘 완료 ${todayDone.length}</h3>${list(todayDone)}`;

  // Week (월~일)
  const monday = addDays(today, -((dow(today) + 6) % 7));
  let weekHtml = "";
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const dayTasks = tasks.filter((t) => (t.status === "TODO" && t.dueDate === day) || (t.status === "DONE" && doneOn(t) === day)).sort(sortT);
    weekHtml += `<h3 class="${day === today ? "now" : ""}">${day.slice(5).replace("-", "/")} (${KDOW[dow(day)]})${day === today ? " · 오늘" : ""}</h3>${list(dayTasks)}`;
  }

  // Month
  const mon = today.slice(0, 7);
  const monthOpen = open.filter((t) => t.dueDate && t.dueDate.startsWith(mon) && t.dueDate >= today).sort(sortT);
  const monthDone = tasks.filter((t) => t.status === "DONE" && (doneOn(t) || "").startsWith(mon));
  const last = addDays(addDays(mon + "-01", 32).slice(0, 7) + "-01", -1);
  const counts = {};
  monthDone.forEach((t) => { const k = doneOn(t); counts[k] = (counts[k] || 0) + 1; });
  const max = Math.max(1, ...Object.values(counts));
  let grid = "";
  const first = mon + "-01";
  for (let i = 0; i < (dow(first) + 6) % 7; i++) grid += `<i class="pad"></i>`;
  for (let day = first; day <= last; day = addDays(day, 1)) {
    const c = counts[day] || 0;
    const lv = c ? Math.ceil((c / max) * 4) : 0;
    grid += `<i class="l${lv}${day === today ? " now" : ""}" title="${day} 완료 ${c}">${Number(day.slice(8))}</i>`;
  }
  const monthGoals = (d.goals || []).filter((g) => g.periodKey === mon);
  const monthHtml = `
    ${monthGoals.length ? `<h3>이번 달 목표</h3><ul>${monthGoals.map((g) => `<li class="${g.done ? "done" : ""}"><span class="tt">${esc(g.title)}</span></li>`).join("")}</ul>` : ""}
    <h3>완료 ${monthDone.length}개</h3><div class="grid">${["월","화","수","목","금","토","일"].map((k) => `<b>${k}</b>`).join("")}${grid}</div>
    <h3>남은 일 ${monthOpen.length}</h3>${list(monthOpen, { showDate: true })}`;

  const inbox = tasks.filter((t) => t.status === "INBOX").length;
  const stamp = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(now);
  const boardStamp = board.updatedAt ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(board.updatedAt)) : "?";

  return `<header><h1>SJ Workboard <em>읽기 전용</em></h1><p class="stamp">보드 마지막 변경 ${esc(boardStamp)} · 사본 생성 ${esc(stamp)}${inbox ? ` · Inbox ${inbox}` : ""}</p></header>
  <nav><button data-tab="today" class="on">Today</button><button data-tab="week">Week</button><button data-tab="month">Month</button></nav>
  <section id="today">${todayHtml}</section><section id="week" hidden>${weekHtml}</section><section id="month" hidden>${monthHtml}</section>`;
}

async function encrypt(plain, pw) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)));
  const b64 = (u) => Buffer.from(u).toString("base64");
  return { s: b64(salt), i: b64(iv), c: b64(ct), n: ITER };
}

const shell = (payload) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>SJ Workboard</title><style>
:root{color-scheme:dark;--bg:#0b0f14;--card:#121821;--line:#1f2a36;--tx:#e6edf3;--mu:#8b98a5;--ac:#5ec8ff;--wa:#ff8a65;--ok:#3fb950}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
main{max-width:720px;margin:0 auto;padding:16px}h1{font-size:18px;margin:0}h1 em{font-style:normal;font-size:12px;color:var(--mu);margin-left:6px}
.stamp{color:var(--mu);font-size:12px;margin:4px 0 12px}nav{display:flex;gap:6px;position:sticky;top:0;background:var(--bg);padding:6px 0;z-index:1}
nav button{flex:1;background:var(--card);color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit}
nav button.on{border-color:var(--ac);color:var(--ac)}h3{font-size:14px;color:var(--mu);margin:18px 0 6px}h3.warn{color:var(--wa)}h3.now{color:var(--ac)}
ul{list-style:none;margin:0;padding:0}li{display:flex;gap:8px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:6px}
li.done .tt{color:var(--mu);text-decoration:line-through}.tt{flex:1;min-width:0;overflow-wrap:anywhere}.tt small{display:block;color:var(--mu);font-size:12px;text-decoration:none}
.pri{font-size:11px;border-radius:6px;padding:1px 6px;background:var(--line);color:var(--mu);flex:none}.pP0{background:#5a1d1d;color:#ffb4a8}.pP1{background:#4a3b12;color:#ffd77a}
.empty{color:var(--mu);font-size:13px;margin:0}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.grid b{font-size:11px;color:var(--mu);text-align:center;font-weight:400}
.grid i{font-style:normal;aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;background:#161b22;color:var(--mu)}
.grid i.pad{background:none}.grid i.l1{background:#0e4429;color:#cde}.grid i.l2{background:#006d32;color:#fff}.grid i.l3{background:#26a641;color:#fff}.grid i.l4{background:#39d353;color:#04260f}
.grid i.now{outline:2px solid var(--ac)}#lock{max-width:360px;margin:20vh auto;padding:16px;text-align:center}
#lock input{width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--tx);font:inherit;margin:12px 0}
#lock button,.out{padding:10px 16px;border-radius:10px;border:1px solid var(--ac);background:none;color:var(--ac);font:inherit}
#lock label{display:block;color:var(--mu);font-size:13px}.err{color:var(--wa);min-height:1.5em;font-size:13px}.out{display:block;margin:24px auto;border-color:var(--line);color:var(--mu);font-size:13px}
</style></head><body>
<form id="lock"><h1>SJ Workboard</h1><input id="pw" type="password" autocomplete="current-password" placeholder="비밀번호" autofocus>
<label><input id="keep" type="checkbox" checked style="width:auto;margin:0 6px 0 0">이 기기에서 기억</label><p class="err" id="err"></p><button>열기</button></form>
<main id="app" hidden></main>
<script>
const P=${JSON.stringify(payload)};
const ub=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function open(pw){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]);
const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:ub(P.s),iterations:P.n,hash:"SHA-256"},k,{name:"AES-GCM",length:256},false,["decrypt"]);
return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:ub(P.i)},key,ub(P.c)));}
function show(html){const a=document.getElementById("app");a.innerHTML=html+'<button class="out" id="out">이 기기에서 잊기</button>';a.hidden=false;document.getElementById("lock").hidden=true;
a.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{a.querySelectorAll("nav button").forEach(x=>x.classList.toggle("on",x===b));a.querySelectorAll("section").forEach(s=>s.hidden=s.id!==b.dataset.tab);});
document.getElementById("out").onclick=()=>{try{localStorage.removeItem("sjwv")}catch(e){}location.reload();};}
async function tryPw(pw,keep){try{const h=await open(pw);if(keep){try{localStorage.setItem("sjwv",pw)}catch(e){}}show(h);return true}catch(e){return false}}
document.getElementById("lock").onsubmit=async e=>{e.preventDefault();const err=document.getElementById("err");err.textContent="여는 중…";
if(!await tryPw(document.getElementById("pw").value,document.getElementById("keep").checked))err.textContent="비밀번호가 맞지 않아요";};
(async()=>{let s=null;try{s=localStorage.getItem("sjwv")}catch(e){}if(s&&!await tryPw(s,false)){try{localStorage.removeItem("sjwv")}catch(e){}}})();
</script></body></html>`;

const board = JSON.parse(readFileSync(BOARD, "utf8"));
const now = new Date();
const html = render(board, now);
// 15분마다 돌지만 실제 내용(시각 제외)이 같으면 다시 쓰지 않는다 -> 불필요한 push 방지
const sig = createHash("sha256").update(html.replace(/<p class="stamp">[\s\S]*?<\/p>/, "")).digest("hex");
if (!FORCE && existsSync(STATE) && existsSync(OUT) && readFileSync(STATE, "utf8").trim() === sig) {
  console.log("변경 없음");
  process.exit(0);
}
const payload = await encrypt(html, password());
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, shell(payload), "utf8");
writeFileSync(STATE, sig + "\n", "utf8");
console.log("갱신:", OUT, "rev", board.revision);
