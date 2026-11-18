// Writes the synthetic case files of LDS-EXE-204 (Al-Juman Education Directorate, head office)
// into labs/files/ and the reference numbers into labs/solutions/key.json.
// Fixed seed: the same bytes on every run. From the repository root:
//   node labs/_tools/prepare_files.mjs           write the files
//   node labs/_tools/prepare_files.mjs --check   compare with the files on disk, write nothing
// Every figure is invented. Every file is aggregated or cleaned and classed Public in the case.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const labs = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const PUBLIC = 'عام';

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(2042027);
const randint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const gauss = () => { const u = Math.max(rnd(), 1e-12), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;

const TEAMS = [
  { id: 'SUP', ar: 'الإشراف التربوي', head: 120 },
  { id: 'STU', ar: 'شؤون الطلاب', head: 60 },
  { id: 'HRS', ar: 'الموارد البشرية', head: 45 },
  { id: 'FIN', ar: 'الشؤون المالية والمشتريات', head: 50 },
  { id: 'PLN', ar: 'التخطيط والمعلومات', head: 30 },
  { id: 'BEN', ar: 'خدمات المستفيدين والاتصال', head: 40 }
];
const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const RECENT = [9, 10, 11, 12];

function csv(header, rows) {
  const esc = (v) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  // A byte-order mark so that spreadsheets open the Arabic text as UTF-8
  return '﻿' +[header.join(','), ...rows.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n') + '\n';
}

// ---------- 1. Weekly use of Miwan, from its admin console (aggregates per team) ----------
const ACTIVE = {
  SUP: (w) => Math.round(120 * (0.35 + 0.37 * (w - 1) / 11)) + randint(-2, 2),
  STU: (w) => Math.round(60 * (0.10 + 0.10 * (w - 1) / 11)) + randint(-1, 1),
  HRS: (w) => [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1][w - 1],
  FIN: (w) => [2, 2, 3, 2, 3, 3, 2, 3, 3, 3, 3, 3][w - 1],
  PLN: (w) => Math.min(30, Math.round(30 * (0.45 + 0.38 * (w - 1) / 11)) + randint(-1, 1)),
  BEN: (w) => [4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6][w - 1]
};
const SPA = { SUP: 5.5, STU: 2.2, HRS: 1.0, FIN: 1.5, PLN: 7.0, BEN: 14.0 };
const ONE = { SUP: 0.78, STU: 0.55, HRS: 0.5, FIN: 0.6, PLN: 0.22, BEN: 0.62 };
const LONG = { SUP: 0.04, STU: 0.07, HRS: 0, FIN: 0.05, PLN: 0.38, BEN: 0.09 };
const UPL = { SUP: 0.03, STU: 0.06, HRS: 0, FIN: 0.05, PLN: 0.30, BEN: 0.04 };
const WARN = { SUP: [1, 3], STU: [4, 8], HRS: [0, 0], FIN: [0, 0], PLN: [0, 1], BEN: [0, 1] };
const usage = [];
for (const w of WEEKS) for (const t of TEAMS) {
  const active = Math.max(0, ACTIVE[t.id](w));
  const sessions = Math.round(active * SPA[t.id] * (1 + 0.08 * gauss()));
  const one = Math.min(sessions, Math.round(sessions * (ONE[t.id] + 0.03 * gauss())));
  const long = Math.min(sessions - one, Math.max(0, Math.round(sessions * LONG[t.id])));
  usage.push({ week: w, team: t.id, headcount: t.head, active_users: active, sessions,
    one_request_sessions: one, long_sessions: long, file_uploads: Math.round(sessions * UPL[t.id]),
    classification_warnings: randint(...WARN[t.id]), data_class: PUBLIC });
}

// ---------- 2. Network: blocked attempts at unapproved public AI sites; Miwan access denied ----------
const BLOCK = { SUP: [8, 14], STU: [28, 42], HRS: [2, 4], FIN: [1, 3], PLN: [0, 2], BEN: [2, 5] };
const HRS_DENIED = [44, 38, 30, 24, 19, 15, 12, 10, 8, 7, 6, 6];
const network = [];
for (const w of WEEKS) for (const t of TEAMS) {
  network.push({ week: w, team: t.id, blocked_public_ai: randint(...BLOCK[t.id]),
    miwan_access_denied: t.id === 'HRS' ? HRS_DENIED[w - 1] : randint(0, t.id === 'PLN' ? 1 : 2), data_class: PUBLIC });
}

// ---------- 3. Pulse survey, week 10, anonymous: counts per team, question and answer ----------
// Counts come from shares by largest remainder, so every count is exact and reproducible.
const RESP = { SUP: 84, STU: 41, HRS: 30, FIN: 33, PLN: 26, BEN: 27 };
const Q = {
  use_freq: { answers: ['never', 'monthly', 'weekly', 'daily'], SUP: [10, 15, 45, 30], STU: [45, 30, 20, 5], HRS: [90, 7, 3, 0], FIN: [82, 12, 6, 0], PLN: [4, 8, 38, 50], BEN: [63, 15, 7, 15] },
  main_use: { answers: ['rewrite', 'summarise', 'analyse', 'draft_new', 'search', 'none'], SUP: [55, 15, 3, 12, 5, 10], STU: [25, 10, 0, 15, 5, 45], HRS: [3, 3, 0, 3, 0, 91], FIN: [6, 0, 6, 3, 0, 85], PLN: [12, 18, 40, 12, 14, 4], BEN: [15, 7, 0, 11, 4, 63] },
  checks_output: { answers: ['always', 'sometimes', 'never', 'not_a_user'], SUP: [14, 48, 28, 10], STU: [10, 30, 15, 45], HRS: [3, 7, 0, 90], FIN: [6, 6, 6, 82], PLN: [70, 22, 4, 4], BEN: [15, 15, 7, 63] },
  unapproved_tool: { answers: ['yes', 'no', 'no_answer'], SUP: [12, 80, 8], STU: [54, 34, 12], HRS: [7, 90, 3], FIN: [6, 91, 3], PLN: [4, 96, 0], BEN: [11, 85, 4] },
  rule_clear: { answers: ['yes', 'unsure', 'no'], SUP: [70, 25, 5], STU: [35, 45, 20], HRS: [60, 33, 7], FIN: [15, 40, 45], PLN: [88, 12, 0], BEN: [55, 37, 8] },
  manager_support: { answers: ['1', '2', '3', '4', '5'], SUP: [3, 7, 15, 45, 30], STU: [10, 20, 35, 25, 10], HRS: [3, 7, 10, 37, 43], FIN: [45, 36, 10, 6, 3], PLN: [0, 4, 8, 32, 56], BEN: [20, 35, 25, 15, 5] },
  time_saved_self: { answers: ['0', '1-30', '31-60', '61-120', '121+'], SUP: [8, 12, 20, 30, 30], STU: [40, 30, 15, 10, 5], HRS: [93, 7, 0, 0, 0], FIN: [85, 9, 6, 0, 0], PLN: [4, 8, 20, 36, 32], BEN: [63, 11, 11, 7, 8] },
  main_barrier: { answers: ['none', 'skill', 'no_examples', 'blocked_access', 'rule_unclear', 'manager_no', 'no_time', 'tool_cannot_take_work', 'distrust'],
    SUP: [15, 30, 33, 0, 7, 2, 8, 0, 5], STU: [5, 5, 10, 2, 18, 5, 7, 43, 5], HRS: [3, 3, 3, 70, 7, 0, 7, 0, 7], FIN: [3, 3, 6, 0, 45, 30, 6, 3, 4], PLN: [58, 8, 8, 0, 4, 0, 12, 4, 6], BEN: [7, 7, 7, 0, 7, 15, 52, 0, 5] }
};
function allocate(n, shares) {
  const total = shares.reduce((a, b) => a + b, 0);
  const raw = shares.map((s) => (n * s) / total);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k++, left--) out[order[k][1]]++;
  return out;
}
const survey = [];
const surveyCounts = {};
for (const t of TEAMS) {
  survey.push({ team: t.id, question: 'respondents', answer: 'all', count: RESP[t.id], data_class: PUBLIC });
  surveyCounts[t.id] = {};
  for (const [q, def] of Object.entries(Q)) {
    const counts = allocate(RESP[t.id], def[t.id]);
    surveyCounts[t.id][q] = Object.fromEntries(def.answers.map((a, i) => [a, counts[i]]));
    def.answers.forEach((a, i) => survey.push({ team: t.id, question: q, answer: a, count: counts[i], data_class: PUBLIC }));
  }
}

// ---------- 4. Help-desk tickets, cleaned summaries (no names, no case details) ----------
const TEXT = {
  access: ['رابط «مِعوان» لا يفتح من أجهزة الإدارة', 'رسالة رفض اتصال عند فتح «مِعوان» من شبكة الطابق الثالث', 'يعمل «مِعوان» من الجوال ولا يعمل من جهاز المكتب', 'طلب فتح الوصول إلى «مِعوان» لأجهزة الفريق'],
  account: ['الحساب لم يُفعَّل بعد الدورة التعريفية', 'كلمة المرور الموحدة لا تقبل في «مِعوان»'],
  data_rule: ['هل يُسمح بلصق قائمة أسماء الطلاب لترتيبها؟', 'هل يجوز إدخال أي شيء مالي في «مِعوان» أم لا شيء أبدًا؟', 'هل يُسمح بإدخال نص تعميم منشور على الموقع؟', 'ما المسموح إدخاله في «مِعوان» من أعمال المشتريات؟', 'هل تدخل جداول الحضور المجمّعة دون أسماء؟', 'الأداة تعرض تحذير تصنيف عند لصق نص: ماذا أفعل؟'],
  how_to: ['كيف أجعل «مِعوان» يلخص تقرير زيارة طويلًا؟', 'كيف أطلب جدولًا بدل فقرة؟', 'هل يوجد أمثلة لاستعمال «مِعوان» في عمل المشرفين؟', 'كيف أرفع ملفًّا وأسأل عنه؟', 'كيف أحفظ طلبًا أكرره كل أسبوع؟'],
  wrong_output: ['«مِعوان» ذكر رقم تعميم غير موجود', 'الملخص أسقط شرطًا من اللائحة المنشورة', 'الترجمة غيّرت معنى جملة في الإعلان'],
  file_upload: ['رفع ملف جدول بيانات كبير يفشل', 'الملف المرفوع لا يُقرأ إن كان صورة ممسوحة']
};
const TICKETS = {
  SUP: { how_to: 14, wrong_output: 5, data_rule: 3 },
  STU: { data_rule: 11, how_to: 3, wrong_output: 1 },
  HRS: { access: 16, account: 3 },
  FIN: { data_rule: 9, how_to: 1 },
  PLN: { how_to: 2, file_upload: 4 },
  BEN: { how_to: 3, access: 1, data_rule: 2 }
};
const PICK = { // which data_rule texts a team asks
  SUP: [2, 5], STU: [0, 4, 5, 2], FIN: [1, 3], BEN: [2]
};
const raw = [];
for (const t of TEAMS) for (const [cat, n] of Object.entries(TICKETS[t.id])) {
  for (let i = 0; i < n; i++) {
    let texts = TEXT[cat];
    if (cat === 'data_rule') texts = PICK[t.id].map((k) => TEXT.data_rule[k]);
    if (cat === 'access' && t.id === 'BEN') texts = [TEXT.access[3]];
    const week = t.id === 'HRS' && cat === 'access' ? Math.min(12, 1 + Math.floor(i / 2)) : randint(1, 12);
    raw.push({ week, team: t.id, category: cat, summary: texts[i % texts.length] });
  }
}
raw.sort((a, b) => a.week - b.week || a.team.localeCompare(b.team) || a.category.localeCompare(b.category));
const tickets = raw.map((r, i) => ({ ticket_id: 'HD-' + String(i + 1).padStart(3, '0'), ...r, data_class: PUBLIC }));

// ---------- 5. Week-11 literacy check: takers and passes per team, without AI and with AI ----------
const CHECKS = {
  SUP: { ai_off: [52, 21], ai_on: [52, 44] }, STU: { ai_off: [30, 14], ai_on: [18, 13] },
  HRS: { ai_off: [28, 17], ai_on: [3, 2] }, FIN: { ai_off: [31, 18], ai_on: [4, 3] },
  PLN: { ai_off: [24, 19], ai_on: [24, 22] }, BEN: { ai_off: [22, 10], ai_on: [6, 5] }
};
const skill = [];
for (const t of TEAMS) for (const mode of ['ai_off', 'ai_on']) {
  const [takers, passed] = CHECKS[t.id][mode];
  skill.push({ team: t.id, mode, takers, passed, data_class: PUBLIC });
}

// ---------- 6. Task-time sample: one public written-reply task, 20 per team per period ----------
const BASE = { SUP: 42, STU: 38, HRS: 46, FIN: 50, PLN: 64, BEN: 34 };
const AI = { SUP: 0.14, STU: 0.03, HRS: 0, FIN: 0, PLN: 0.30, BEN: 0.04 };
const TEMPLATE = 0.10; // new reply templates issued to every team in week 4
const QUAL = { SUP: [17, 12], STU: [15, 15], HRS: [16, 17], FIN: [17, 17], PLN: [18, 18], BEN: [16, 16] };
const sample = [];
let sid = 0;
for (const t of TEAMS) for (const [pi, period] of ['baseline', 'recent'].entries()) {
  const mean = BASE[t.id] * (period === 'recent' ? (1 - TEMPLATE) * (1 - AI[t.id]) : 1);
  const passIdx = new Set();
  while (passIdx.size < QUAL[t.id][pi]) passIdx.add(randint(0, 19));
  for (let i = 0; i < 20; i++) {
    sample.push({ sample_id: 'S' + String(++sid).padStart(3, '0'), team: t.id, period,
      minutes: Math.max(8, Math.round(mean * Math.exp(0.18 * gauss() - 0.0162))), quality_pass: passIdx.has(i) ? 1 : 0, data_class: PUBLIC });
  }
}

// ---------- reference numbers (the key) ----------
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const key = { seed: 2042027, teams: {}, lab_1_1: {}, lab_2_1: {} };
for (const t of TEAMS) {
  key.teams[t.id] = { ar: t.ar, headcount: t.head };
  const u = usage.filter((r) => r.team === t.id && RECENT.includes(r.week));
  const n = network.filter((r) => r.team === t.id && RECENT.includes(r.week));
  const nAll = network.filter((r) => r.team === t.id);
  const act = u.reduce((a, r) => a + r.active_users, 0), ses = u.reduce((a, r) => a + r.sessions, 0);
  const s = surveyCounts[t.id], R = RESP[t.id];
  const top = Object.entries(s.main_barrier).sort((a, b) => b[1] - a[1])[0];
  const tk = tickets.filter((r) => r.team === t.id);
  const mgr = Object.entries(s.manager_support).reduce((a, [k, v]) => a + Number(k) * v, 0) / R;
  key.lab_1_1[t.id] = {
    active_share: r1(100 * (act / 4) / t.head),
    sessions_per_active: r1(ses / act),
    one_request_share: r1(100 * u.reduce((a, r) => a + r.one_request_sessions, 0) / ses),
    long_share: r1(100 * u.reduce((a, r) => a + r.long_sessions, 0) / ses),
    warnings_per_100_sessions: r1(100 * u.reduce((a, r) => a + r.classification_warnings, 0) / ses),
    blocked_public_ai_per_week: r1(mean(n.map((r) => r.blocked_public_ai))),
    blocked_per_10_staff_week: r1(10 * mean(n.map((r) => r.blocked_public_ai)) / t.head),
    access_denied_12_weeks: nAll.reduce((a, r) => a + r.miwan_access_denied, 0),
    respondents: R, response_rate: r1(100 * R / t.head),
    weekly_or_daily: r1(100 * (s.use_freq.weekly + s.use_freq.daily) / R),
    unapproved_yes: r1(100 * s.unapproved_tool.yes / R),
    rule_not_clear: r1(100 * (s.rule_clear.unsure + s.rule_clear.no) / R),
    checks_always: r1(100 * s.checks_output.always / R),
    manager_support_mean: r2(mgr),
    top_barrier: top[0], top_barrier_share: r1(100 * top[1] / R),
    self_time_61_plus: r1(100 * (s.time_saved_self['61-120'] + s.time_saved_self['121+']) / R),
    tickets: Object.fromEntries(Object.keys(TICKETS[t.id]).map((c) => [c, tk.filter((r) => r.category === c).length]))
  };
}
const allAct = usage.filter((r) => r.week === 12).reduce((a, r) => a + r.active_users, 0);
key.lab_1_1.directorate_week12_active = allAct;
key.lab_1_1.directorate_week12_share = r1(100 * allAct / 345);
// The diagnosis the key expects (the course's reading of the planted data)
key.lab_1_1.diagnosis = {
  SUP: { pattern: 'shallow', barrier: 'skill_and_examples' },
  STU: { pattern: 'unsafe', barrier: 'tool_cannot_take_work' },
  HRS: { pattern: 'blocked', barrier: 'technical_access' },
  FIN: { pattern: 'blocked', barrier: 'rule_and_manager' },
  PLN: { pattern: 'deep_and_safe', barrier: 'none' },
  BEN: { pattern: 'blocked', barrier: 'time_and_manager' }
};
// Lab 2.1: use, skill, value
key.lab_2_1.use_weekly_share = Object.fromEntries(TEAMS.map((t) => [t.id, usage.filter((r) => r.team === t.id).map((r) => r1(100 * r.active_users / t.head))]));
key.lab_2_1.skill = Object.fromEntries(TEAMS.map((t) => [t.id, Object.fromEntries(['ai_off', 'ai_on'].map((m) => {
  const [takers, passed] = CHECKS[t.id][m];
  return [m, takers < 5 ? { takers: '<5', pass_rate: 'suppressed' } : { takers, pass_rate: r1(100 * passed / takers) }];
}))]));
const med = (team, period) => median(sample.filter((r) => team.includes(r.team) && r.period === period).map((r) => r.minutes));
const qual = (team, period) => r1(100 * mean(sample.filter((r) => team.includes(r.team) && r.period === period).map((r) => r.quality_pass)));
const comp = ['HRS', 'FIN'];
const cb = med(comp, 'baseline'), cr = med(comp, 'recent');
const compChange = r1(100 * (cr - cb) / cb);
key.lab_2_1.value = { comparison: { teams: comp, baseline_median: cb, recent_median: cr, change_pct: compChange, quality_baseline: qual(comp, 'baseline'), quality_recent: qual(comp, 'recent') } };
for (const t of TEAMS) {
  const b = med([t.id], 'baseline'), r = med([t.id], 'recent');
  const ch = r1(100 * (r - b) / b);
  key.lab_2_1.value[t.id] = { baseline_median: b, recent_median: r, change_pct: ch, vs_comparison_pts: r1(ch - compChange), quality_baseline: qual([t.id], 'baseline'), quality_recent: qual([t.id], 'recent') };
}

// ---------- write or check ----------
const files = {
  'files/usage_weekly.csv': csv(['week', 'team', 'headcount', 'active_users', 'sessions', 'one_request_sessions', 'long_sessions', 'file_uploads', 'classification_warnings', 'data_class'], usage),
  'files/network_weekly.csv': csv(['week', 'team', 'blocked_public_ai', 'miwan_access_denied', 'data_class'], network),
  'files/survey_pulse_counts.csv': csv(['team', 'question', 'answer', 'count', 'data_class'], survey),
  'files/helpdesk_tickets.csv': csv(['ticket_id', 'week', 'team', 'category', 'summary', 'data_class'], tickets),
  'files/skill_check.csv': csv(['team', 'mode', 'takers', 'passed', 'data_class'], skill),
  'files/task_sample.csv': csv(['sample_id', 'team', 'period', 'minutes', 'quality_pass', 'data_class'], sample),
  'files/teams.csv': csv(['team', 'name_ar', 'headcount', 'data_class'], TEAMS.map((t) => ({ team: t.id, name_ar: t.ar, headcount: t.head, data_class: PUBLIC }))),
  'solutions/key.json': JSON.stringify(key, null, 2) + '\n'
};
let diffs = 0;
for (const [rel, body] of Object.entries(files)) {
  const p = join(labs, rel);
  if (CHECK) {
    const now = existsSync(p) ? readFileSync(p, 'utf8') : null;
    if (now !== body) { console.log('differs: ' + rel); diffs++; }
  } else {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
}
if (CHECK) { console.log(diffs ? diffs + ' file(s) differ' : 'same bytes: ' + Object.keys(files).length + ' files'); process.exit(diffs ? 1 : 0); }
console.log('wrote ' + Object.keys(files).length + ' files');
