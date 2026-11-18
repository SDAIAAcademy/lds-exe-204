// Trainer's check of the labs of LDS-EXE-204. From the repository root:
//   node labs/solutions/check_all.mjs
// 1. The generator writes the same bytes as the files on disk.
// 2. Every reference number of labs 1.1 and 2.1 is recomputed from the CSV files alone, the way a
//    spreadsheet does it, and compared with labs/solutions/key.json.
// 3. The static files of labs 1.2 and 1.3 are present, classed Public, and agree with the case
//    (role counts add up to the head count; the check pack holds the four planted departures).
// Prints PASS, or every difference and exits 1.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const labs = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = JSON.parse(readFileSync(join(labs, 'solutions', 'key.json'), 'utf8'));
let fails = 0;
function eq(name, got, want, tol = 0.051) {
  const ok = typeof want === 'number' ? Math.abs(got - want) <= tol : got === want;
  if (!ok) { console.log('DIFF ' + name + ': got ' + got + ', want ' + want); fails++; }
}
function parseCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, /^-?\d+(\.\d+)?$/.test(r[i]) ? Number(r[i]) : r[i]])));
}
const f = (name) => parseCsv(join(labs, 'files', name));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const r1 = (x) => Math.round(x * 10) / 10;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// 1. bytes
const gen = spawnSync(process.execPath, [join(labs, '_tools', 'prepare_files.mjs'), '--check'], { encoding: 'utf8' });
if (gen.status !== 0) { console.log(gen.stdout + gen.stderr); fails++; } else console.log('generator: ' + gen.stdout.trim());

// 2a. lab 1.1
const teams = f('teams.csv');
const usage = f('usage_weekly.csv'), net = f('network_weekly.csv'), survey = f('survey_pulse_counts.csv'), tickets = f('helpdesk_tickets.csv');
const recent = (r) => r.week >= 9 && r.week <= 12;
for (const t of teams) {
  const k = key.lab_1_1[t.team];
  const u = usage.filter((r) => r.team === t.team && recent(r));
  const n = net.filter((r) => r.team === t.team && recent(r));
  const S = (q, a) => survey.find((r) => r.team === t.team && r.question === q && String(r.answer) === a).count;
  const R = S('respondents', 'all');
  const act = sum(u.map((r) => r.active_users)), ses = sum(u.map((r) => r.sessions));
  eq(t.team + ' active_share', r1(100 * act / 4 / t.headcount), k.active_share);
  eq(t.team + ' sessions_per_active', r1(ses / act), k.sessions_per_active);
  eq(t.team + ' one_request_share', r1(100 * sum(u.map((r) => r.one_request_sessions)) / ses), k.one_request_share);
  eq(t.team + ' long_share', r1(100 * sum(u.map((r) => r.long_sessions)) / ses), k.long_share);
  eq(t.team + ' blocked_per_10', r1(10 * sum(n.map((r) => r.blocked_public_ai)) / 4 / t.headcount), k.blocked_per_10_staff_week);
  eq(t.team + ' access_denied', sum(net.filter((r) => r.team === t.team).map((r) => r.mirqat_access_denied)), k.access_denied_12_weeks);
  eq(t.team + ' weekly_or_daily', r1(100 * (S('use_freq', 'weekly') + S('use_freq', 'daily')) / R), k.weekly_or_daily);
  eq(t.team + ' unapproved_yes', r1(100 * S('unapproved_tool', 'yes') / R), k.unapproved_yes);
  eq(t.team + ' rule_not_clear', r1(100 * (S('rule_clear', 'unsure') + S('rule_clear', 'no')) / R), k.rule_not_clear);
  eq(t.team + ' checks_always', r1(100 * S('checks_output', 'always') / R), k.checks_always);
  eq(t.team + ' manager_mean', Math.round(100 * sum([1, 2, 3, 4, 5].map((v) => v * S('manager_support', String(v)))) / R) / 100, k.manager_support_mean, 0.006);
  const bars = survey.filter((r) => r.team === t.team && r.question === 'main_barrier').sort((a, b) => b.count - a.count);
  eq(t.team + ' top_barrier', bars[0].answer, k.top_barrier);
  for (const [cat, c] of Object.entries(k.tickets)) eq(t.team + ' tickets ' + cat, tickets.filter((r) => r.team === t.team && r.category === cat).length, c);
}
eq('directorate week 12', sum(usage.filter((r) => r.week === 12).map((r) => r.active_users)), key.lab_1_1.directorate_week12_active);
eq('tickets total', tickets.length, 78);
// the planted reading the key expects, as the lab's rules of thumb see it
const d = key.lab_1_1;
if (!(d.SUP.active_share > 50 && d.SUP.one_request_share > 70 && d.SUP.checks_always < 20)) { console.log('DIFF SUP is not shallow'); fails++; }
if (!(d.STU.blocked_per_10_staff_week > 3 * Math.max(d.SUP.blocked_per_10_staff_week, d.BEN.blocked_per_10_staff_week) && d.STU.unapproved_yes > 40)) { console.log('DIFF STU is not unsafe'); fails++; }
if (!(d.HRS.access_denied_12_weeks > 10 * d.FIN.access_denied_12_weeks && d.HRS.manager_support_mean > 4)) { console.log('DIFF HRS is not blocked by access'); fails++; }
if (!(d.FIN.rule_not_clear > 75 && d.FIN.manager_support_mean < 2)) { console.log('DIFF FIN is not blocked by rule and manager'); fails++; }
if (!(d.PLN.long_share > 30 && d.PLN.checks_always > 60)) { console.log('DIFF PLN is not deep'); fails++; }
if (!(d.BEN.active_share < 20 && d.BEN.sessions_per_active > 2 * d.PLN.sessions_per_active && d.BEN.top_barrier === 'no_time')) { console.log('DIFF BEN is not concentrated and short of time'); fails++; }

// 2b. lab 2.1
for (const t of teams) {
  const w = usage.filter((r) => r.team === t.team).map((r) => r1(100 * r.active_users / t.headcount));
  eq(t.team + ' weekly share series', JSON.stringify(w), JSON.stringify(key.lab_2_1.use_weekly_share[t.team]));
}
const skill = f('skill_check.csv');
for (const r of skill) {
  const k = key.lab_2_1.skill[r.team][r.mode];
  if (r.takers < 5) eq(r.team + ' ' + r.mode + ' suppressed', k.pass_rate, 'suppressed');
  else eq(r.team + ' ' + r.mode + ' pass', r1(100 * r.passed / r.takers), k.pass_rate);
}
const sample = f('task_sample.csv');
const med = (ts, p) => median(sample.filter((r) => ts.includes(r.team) && r.period === p).map((r) => r.minutes));
const qual = (ts, p) => { const s = sample.filter((r) => ts.includes(r.team) && r.period === p); return r1(100 * sum(s.map((r) => r.quality_pass)) / s.length); };
const V = key.lab_2_1.value;
const cb = med(['HRS', 'FIN'], 'baseline'), cr = med(['HRS', 'FIN'], 'recent');
eq('comparison baseline', cb, V.comparison.baseline_median); eq('comparison recent', cr, V.comparison.recent_median);
const cc = r1(100 * (cr - cb) / cb);
eq('comparison change', cc, V.comparison.change_pct);
for (const t of teams) {
  const b = med([t.team], 'baseline'), r = med([t.team], 'recent'), ch = r1(100 * (r - b) / b);
  eq(t.team + ' change', ch, V[t.team].change_pct);
  eq(t.team + ' vs comparison', r1(ch - cc), V[t.team].vs_comparison_pts);
  eq(t.team + ' quality recent', qual([t.team], 'recent'), V[t.team].quality_recent);
}
if (!(V.SUP.quality_recent < V.SUP.quality_baseline - 15 && V.PLN.vs_comparison_pts < -20 && V.comparison.change_pct < -5)) { console.log('DIFF value plants missing'); fails++; }

// 3. static files of labs 1.2 and 1.3
const roles = f('case_roles.csv');
eq('roles add up to the head count', sum(roles.map((r) => r.count)), sum(teams.map((t) => t.headcount)));
for (const name of ['usage_weekly.csv', 'network_weekly.csv', 'survey_pulse_counts.csv', 'helpdesk_tickets.csv', 'skill_check.csv', 'task_sample.csv', 'teams.csv', 'case_roles.csv', 'ap_am_extract.csv', 'public_tasks.csv']) {
  const bad = f(name).filter((r) => r.data_class !== 'عام').length;
  eq(name + ' rows not Public', bad, 0);
}
for (const name of ['check_card.md', 'check_circular.md', 'check_draft_reply.md', 'performance_framework.md', 'hr_incentive_draft.md', 'data_rule_current.md', 'leaderboard_request.md']) {
  const p = join(labs, 'files', name);
  if (!existsSync(p)) { console.log('DIFF missing ' + name); fails++; continue; }
  if (!readFileSync(p, 'utf8').includes('عام')) { console.log('DIFF ' + name + ' has no Public class line'); fails++; }
}
const draft = readFileSync(join(labs, 'files', 'check_draft_reply.md'), 'utf8');
const circ = readFileSync(join(labs, 'files', 'check_circular.md'), 'utf8');
for (const [what, inDraft, inCirc] of [['30 days', '30 يومًا', '15 يوم عمل'], ['extra document', 'حسن سيرة', null], ['fee', '50 ريالًا', 'لا يُستوفى أي رسم'], ['promise', 'فسيُقبل', 'لا يجوز لأي موظف أن يعد']]) {
  if (!draft.includes(inDraft) || (inCirc && !circ.includes(inCirc)) || (!inCirc && circ.includes(inDraft))) { console.log('DIFF check pack: ' + what); fails++; }
}
const codes = f('ap_am_extract.csv').map((r) => r.code);
if (codes.length !== 13 || codes.some((c) => !/^AP-[TSKA]-0\d\d$/.test(c))) { console.log('DIFF AP-AM extract codes'); fails++; }

console.log(fails ? 'FAIL: ' + fails + ' difference(s)' : 'PASS');
process.exit(fails ? 1 : 0);
