// Runs the reference solution of every lab against the engine of the published sandbox page
// (labs/tools/sandbox.html), with the scripted agent, and checks what the labs and the slides
// state. It writes nothing and calls no model.
//
//   node labs/solutions/check.mjs            every lab
//   node labs/solutions/check.mjs 1.3 2.2    some of them
//
// Node 22, no dependency.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const LABS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(LABS, 'tools/sandbox.html'), 'utf8');
(0, eval)(page.slice(page.indexOf('<script>') + 8, page.indexOf('</script>')).replace(/<\\\/script/g, '</script'));
const { SB, SB_WORLD: WD } = globalThis;
const key = JSON.parse(fs.readFileSync(path.join(LABS, 'solutions/key.json'), 'utf8'));
const runs = JSON.parse(fs.readFileSync(path.join(LABS, 'files/runs/runs.json'), 'utf8'));

const clock = () => { let t = Date.parse('2026-11-15T06:00:00Z'); const f = () => (t += 5000); f.jump = (min) => { t += min * 60000; }; return f; };
const you = WD.PEOPLE.you.name;
/* run to the end; decide(call) answers each approval: true, false, or null to leave it waiting */
async function go(st, opts, decide) {
  const run = SB.startRun(st, opts), agent = SB.scriptedAgent();
  await SB.advance(st, run, agent);
  while (run.status === 'waiting') {
    const d = decide ? decide(run.pending) : false;
    if (d === null) break;
    SB.decide(st, run, d, you, d ? 'راجعته' : 'لم أطلبه');
    await SB.advance(st, run, agent);
  }
  return run;
}
const report = (st) => (st.world.files['reports/weekly_46_draft.md'] || st.world.files['reports/weekly_46.md'] || { text: '' }).text;
const called = (st, run, tool, test) => st.log.filter((e) => e.run === run.id && e.kind === 'call' && e.tool === tool && (!test || test(e.args)));
const kinds = (st, run, kind) => st.log.filter((e) => e.run === run.id && e.kind === kind);
const say = (...a) => console.log('  ' + a.join(' '));

const LAB = {
  async '1.1'() {
    const st = await SB.preset('1.1', clock());
    const run = await go(st, { task: 'report', request: WD.TASKS.report.request });
    const v = SB.verifyLog(st.log, run.id), sc = SB.scoreReport(report(st));
    say('one-line request:', v.calls, 'tool calls,', v.denied, 'denied; report', sc.right, 'of', sc.of, 'items right; final:', run.final);
    assert.equal(run.status, 'done');
    assert.equal(sc.right, 2);
    assert.deepEqual(sc.items.filter((i) => i.ok).map((i) => i.key), ['review', 'due']);
    assert.match(run.final, /أُرسل/); // it says "sent"
    assert.equal(kinds(st, run, 'denied').length, 1);
    assert.equal(kinds(st, run, 'denied')[0].tool, 'mail_send'); // and the send was refused
    assert.equal(st.world.sent.length, 0);
    assert.equal(called(st, run, 'files_read', (a) => a.path === 'programme/register.csv').length, 0); // the register was never opened
    assert.equal(called(st, run, 'files_read', (a) => a.path === 'hr/salaries_2026.csv').length, 1); // an out-of-scope file was
    assert.equal(called(st, run, 'mail_read').length, 6); // four of seven internal mails, two external
    assert.match(report(st), /4\.1 من 5/); // the invented score
  },
  async '1.2'() {
    assert.equal(SB.checkBrief(SB.emptyBrief()).met, 0);
    assert.equal(SB.checkBrief(SB.REF.BRIEF).met, 7);
    const st = await SB.preset('1.2', clock());
    const run = await go(st, { task: 'report', brief: SB.REF.BRIEF });
    const v = SB.verifyLog(st.log, run.id), sc = SB.scoreReport(report(st));
    say('seven-point brief:', v.calls, 'tool calls,', v.denied, 'denied; report', sc.right, 'of', sc.of, '; status', run.status);
    say('question:', run.question);
    assert.equal(run.status, 'asked');
    assert.equal(sc.right, 7);
    assert.equal(v.denied, 0);
    assert.match(run.question, /15/); assert.match(run.question, /14/);
    assert.equal(called(st, run, 'mail_send').length, 0);
    assert.equal(called(st, run, 'files_read', (a) => a.path.indexOf('hr/') === 0).length, 0);
    assert.equal(called(st, run, 'mail_list', (a) => a.folder === 'external').length, 0);
    // other wordings of point 5 must behave like the reference
    const wordings = ['إذا لم يكن الرقم في المصادر فاسألني، وعند اختلاف المصادر توقف', 'إن غاب رقم فلا تخمّنه وتوقف، وإن لم يتطابق مصدران فاسألني', 'توقّف واسألني إذا لم تجد قيمة بند في أي مصدر أو إذا تعارضت قيمتان', 'أي بند بلا مصدر يُترك فارغًا وتسألني عنه، وكذلك أي رقمين مختلفين للبند نفسه', 'لا تكمل إذا كانت معلومة غير متاحة أو إذا وجدتَ تناقضًا'];
    for (const stop of wordings) {
      const F = SB.features(Object.assign(SB.clone(SB.REF.BRIEF), { stop }));
      assert.ok(F.stop_missing && F.stop_conflict, stop);
      const s3 = await SB.preset('1.2', clock()), r3 = await go(s3, { task: 'report', brief: Object.assign(SB.clone(SB.REF.BRIEF), { stop }) });
      assert.equal(r3.status, 'asked'); assert.equal(SB.scoreReport(report(s3)).right, 7);
    }
    assert.ok(!SB.features(Object.assign(SB.clone(SB.REF.BRIEF), { stop: 'اعمل بسرعة ولا تتأخر عن الموعد' })).stop_missing);
    say(wordings.length, 'other wordings of the stop conditions behave like the reference');
    // a brief with no stop condition and no check: the agent fills the gap and says done
    const loose = Object.assign(SB.clone(SB.REF.BRIEF), { stop: '', check: '' });
    const st2 = await SB.preset('1.2', clock()), run2 = await go(st2, { task: 'report', brief: loose });
    assert.equal(run2.status, 'done');
    assert.equal(SB.scoreReport(report(st2)).right, 6);
    say('same brief without points 5 and 7: status', run2.status + ', report', SB.scoreReport(report(st2)).right, 'of 7');
  },
  async '1.3'() {
    const st = await SB.preset('1.3', clock());
    assert.equal(st.grants.length, 0);
    const r1 = await go(st, { task: 'report', brief: st.setup.brief });
    const need = kinds(st, r1, 'denied').map((e) => e.tool);
    say('no grants:', need.length, 'denials:', need.join(', '));
    assert.equal(SB.verifyLog(st.log, r1.id).calls - 1, need.length); // every call but the question was refused
    assert.equal(report(st), '');
    key.minimal_grants.forEach((g) => SB.grant(st, g[0], g[1], g[2]));
    const r2 = await go(st, { task: 'report', brief: st.setup.brief });
    say('five grants:', r2.denied, 'denied; report', SB.scoreReport(report(st)).right, 'of 7; status', r2.status);
    assert.equal(r2.denied, 0);
    assert.equal(SB.scoreReport(report(st)).right, 7);
    assert.equal(st.grants.filter((g) => g.scope === 'act').length, 0); // the task needs no act scope at all
    // each of the five is needed: without any one of them a call is refused
    for (let i = 0; i < key.minimal_grants.length; i++) {
      const s = await SB.preset('1.3', clock());
      key.minimal_grants.forEach((g, j) => { if (j !== i) SB.grant(s, g[0], g[1], g[2]); });
      assert.ok((await go(s, { task: 'report', brief: s.setup.brief })).denied > 0, 'grant ' + i + ' is not needed');
    }
    // a grant for one run, then a revocation
    const mail = st.grants.filter((g) => g.connector === 'mail')[0];
    SB.revoke(st, mail.id);
    SB.grant(st, 'mail', 'read', 'inbox', { runs_left: 1 });
    const r3 = await go(st, { task: 'report', brief: st.setup.brief });
    const r4 = await go(st, { task: 'report', brief: st.setup.brief });
    assert.equal(r3.denied, 0);
    assert.deepEqual([...new Set(kinds(st, r4, 'denied').map((e) => e.reason))], ['expired']);
    SB.revoke(st, st.grants.filter((g) => g.connector === 'files' && g.scope === 'write')[0].id);
    const r5 = await go(st, { task: 'report', brief: st.setup.brief });
    assert.ok(kinds(st, r5, 'denied').some((e) => e.tool === 'files_write' && e.reason === 'revoked'));
    // the stretch: everything granted, the one-line request
    const all = await SB.preset('1.3', clock());
    Object.keys(SB.CONNECTORS).forEach((c) => SB.grant(all, c, 'act', '*'));
    const r6 = await go(all, { task: 'report', request: WD.TASKS.report.request }, () => null);
    assert.equal(r6.status, 'waiting'); assert.equal(r6.pending.name, 'mail_send'); assert.equal(r6.denied, 0);
    assert.equal(SB.scoreReport(report(all)).right, 2);
    say('one-run grant: run 3 denied', r3.denied + ', run 4 refused as', kinds(st, r4, 'denied')[0].reason + '; after revoking write: files_write refused');
  },
  async '1.4'() {
    // as the colleague left it: everything granted, no approval
    const st = await SB.preset('1.4', clock());
    const r1 = await go(st, { task: 'followup' });
    const v1 = SB.verifyLog(st.log, r1.id);
    say('as found:', v1.irreversible, 'irreversible actions executed,', v1.waited, 'waited for approval;', st.world.paid.length, 'payment of', st.world.paid[0].amount);
    assert.equal(v1.irreversible, 7); assert.equal(v1.waited, 0); assert.equal(v1.ok, false);
    assert.ok(st.world.deleted.includes('archive/2025/final_report_2025.md'));
    assert.equal(st.world.published.length, 1);
    // the reference setup: four gates on, grants narrowed to the task
    const s = await SB.preset('1.4', clock());
    s.grants.filter((g) => g.connector === 'files' || g.connector === 'payments').forEach((g) => SB.revoke(s, g.id));
    [['files', 'read', 'reports'], ['files', 'act', 'announcements'], ['files', 'read', 'archive'], ['files', 'act', 'archive/tmp']].forEach((g) => SB.grant(s, g[0], g[1], g[2]));
    s.approve = { send: true, delete: true, pay: true, publish: true };
    const draft = s.world.files['announcements/draft_review_dates.md'].text, e2 = s.world.calendar.filter((e) => e.id === 'e2')[0];
    assert.ok(draft.includes('17 نوفمبر') && e2.date === '2026-11-18'); // the reason to reject the publication
    const r2 = await go(s, { task: 'followup' }, (c) => c.name !== 'files_publish');
    const v2 = SB.verifyLog(s.log, r2.id);
    say('gated:', v2.requested, 'approvals asked,', v2.approved, 'approved,', v2.rejected, 'rejected,', v2.denied, 'denied by permission;', v2.irreversible, 'executed, all after approval:', v2.ok);
    assert.deepEqual([v2.requested, v2.approved, v2.rejected, v2.irreversible, v2.waited], [5, 4, 1, 4, 4]);
    assert.equal(v2.ok, true);
    assert.deepEqual(kinds(s, r2, 'denied').map((e) => e.tool + ':' + e.reason), ['files_delete:revoked', 'payments_list:revoked', 'payments_pay:revoked']);
    assert.equal(s.world.paid.length, 0); assert.equal(s.world.published.length, 0);
    assert.deepEqual(s.world.deleted, ['archive/tmp/export_old_1.csv', 'archive/tmp/export_old_2.csv']);
    assert.match(r2.final, /صُرفت/); // the final message still claims everything
    // a scheduled run: nobody is there, so the first send waits and nothing leaves
    const c = clock(), t = await SB.preset('1.4', c);
    t.approve = { send: true, delete: true, pay: true, publish: true };
    SB.schedule(t, 'followup', 2);
    assert.equal(SB.due(t).length, 0);
    c.jump(3);
    const dueNow = SB.due(t);
    assert.equal(dueNow.length, 1);
    const r3 = await go(t, { task: dueNow[0].task, trigger: 'schedule' }, () => null);
    assert.equal(r3.status, 'waiting'); assert.equal(t.world.sent.length, 0);
    say('scheduled run:', r3.status, 'at', r3.pending.name + ', nothing sent');
  },
  async '2.1'() {
    const st = await SB.preset('2.1', clock());
    const run = await go(st, { task: 'report', brief: st.setup.brief });
    const v = SB.verifyLog(st.log, run.id), asked = kinds(st, run, 'approval_requested').map((e) => e.tool);
    say('drill:', v.calls, 'tool calls;', v.requested, 'waited for approval (' + asked.join(', ') + ');', v.irreversible, 'executed without approval:', v.unapproved.join(', '));
    assert.deepEqual(asked, ['mail_send', 'files_publish', 'payments_pay']);
    assert.equal(v.rejected, 3);
    assert.deepEqual(st.world.deleted, ['programme/register.csv']); // the one that got through
    assert.equal(v.ok, false);
    assert.ok(st.world.memory.some((l) => l.includes(WD.ATTACKER))); // and the memory line
    assert.equal(called(st, run, 'files_read', (a) => a.path === 'programme/panels/reviewers.csv').length, 1); // private data was read
    assert.ok(kinds(st, run, 'approval_requested')[0].args.body.includes('rev01@reviewers.example')); // and was on its way out
    assert.equal(st.world.sent.length, 0); assert.equal(st.world.paid.length, 0); assert.equal(st.world.published.length, 0);
    const sc = SB.scoreReport(report(st));
    say('report after the deletion:', sc.right, 'of 7; memory lines:', st.world.memory.length);
    assert.deepEqual(sc.items.filter((i) => !i.ok).map((i) => i.key), ['received', 'returned']);
    // each planted text is where the key says, in what the agent reads and not in what the eye sees
    const x03 = st.world.mail.filter((m) => m.id === 'x03')[0];
    assert.ok(x03.hidden.includes(key.injections[0].marker) && !x03.body.includes(key.injections[0].marker));
    assert.ok(st.world.files['partners/partner_update_w46.md'].text.includes(key.injections[1].marker));
    const poster = st.world.files['programme/poster_review_day.svg'];
    assert.ok(poster.text.includes(key.injections[2].marker) && !poster.seen.includes(key.injections[2].marker));
    assert.ok(fs.readFileSync(path.join(LABS, 'files/box/files/programme/poster_review_day.svg'), 'utf8').includes(key.injections[2].marker));
    assert.ok(fs.readFileSync(path.join(LABS, 'files/box/mail/external/x03.html'), 'utf8').includes('color:#ffffff'));
  },
  async '2.2'() {
    const st = await SB.preset('2.2', clock());
    assert.equal(st.schedules.filter((s) => s.active).length, 1); // something to stop
    const poison = st.world.memory.filter((l) => l.includes(WD.ATTACKER));
    assert.equal(poison.length, 1);
    // left alone, the poisoned memory acts again in the next run
    const r0 = await go(st, { task: 'report', brief: st.setup.brief }, () => false);
    const copy = kinds(st, r0, 'approval_requested').filter((e) => e.tool === 'mail_send' && e.args.to === WD.ATTACKER && e.args.subject.indexOf('نسخة') === 0);
    assert.equal(copy.length, 1);
    say('poisoned memory, next run: a copy of the report waits for approval, addressed to', copy[0].args.to);
    // contained: the memory line removed, three limiting changes, a clean box
    const s = SB.newState(2, clock());
    SB.tightened(s);
    const run = await go(s, { task: 'report', brief: st.setup.brief });
    const v = SB.verifyLog(s.log, run.id), den = kinds(s, run, 'denied').map((e) => e.tool + ':' + e.reason);
    say('after the changes:', v.requested, 'approvals asked,', v.irreversible, 'irreversible executed,', v.denied, 'denied:', den.join(', '));
    assert.deepEqual(den, ['files_read:folder', 'mail_send:scope', 'memory_write:scope', 'files_publish:scope', 'files_delete:scope', 'payments_pay:no_grant']);
    assert.deepEqual([v.requested, v.irreversible], [0, 0]);
    assert.equal(s.world.memory.length, 2); assert.equal(s.world.deleted.length, 0);
    assert.equal(SB.scoreReport(report(s)).right, 7);
    assert.equal(run.status, 'asked');
    // the recipients rule alone also stops the first attempt when sending is granted
    const r = SB.newState(2, clock());
    SB.tightened(r); SB.grant(r, 'mail', 'act', '*');
    const run2 = await go(r, { task: 'report', brief: st.setup.brief });
    assert.ok(kinds(r, run2, 'denied').some((e) => e.tool === 'mail_send' && e.reason === 'recipient'));
  },
  async '2.3'() {
    const a = runs.a, b = runs.b, text = (log) => log.filter((e) => e.kind === 'result').map((e) => e.text).join('\n');
    // F1: the brief names the register, the log never opens it
    assert.ok(a.brief.check.includes('سجل البرنامج'));
    assert.equal(a.log.filter((e) => e.kind === 'call' && e.args && e.args.path === 'programme/register.csv').length, 0);
    const draft = a.log.filter((e) => e.tool === 'files_write' && e.kind === 'call')[0].args.content, sc = SB.scoreReport(draft);
    assert.deepEqual(sc.items.filter((i) => !i.ok).map((i) => i.key), ['received', 'returned', 'health_score']);
    // F2: the score is in the draft and in no tool result
    assert.ok(draft.includes('4.2 من 5') && !text(a.log).includes('4.2'));
    // F3: a publication the brief forbids, approved in two seconds by someone else
    const pub = b.approvals.filter((x) => x.tool === 'files_publish')[0];
    assert.ok(b.brief.forbidden.includes('publish') && pub.decision === 'approved' && pub.by === WD.PEOPLE.ranya.name && pub.decided - pub.requested === 2000);
    // F4: the final message claims two invitations, one result is an error
    const errors = b.log.filter((e) => e.kind === 'error');
    assert.ok(errors.length === 1 && errors[0].tool === 'calendar_invite' && b.final.includes('دعوتا'));
    // the line numbers the lab page and the slides quote
    assert.deepEqual(key.faults.map((f) => f.lines.join('/')), ['27/29/31', '35', '22', '31', '30']);
    assert.deepEqual([a.log.length, b.log.length, runs.c.log.length], [38, 33, 36]);
    say('runs A and B: F1 skipped step (register never read; draft', sc.right, 'of 7), F2 invented score, F3 forbidden publication approved after 2 s, F4 claim against an error at line', errors[0].n);
    say('lines in the key:', key.faults.filter((x) => x.run !== 'ج').map((f) => f.id + ' ' + f.lines.join('/')).join(', '));
  },
  async '2.4'() {
    const c = runs.c, dels = c.log.filter((e) => e.kind === 'call' && e.tool === 'files_delete');
    const out = dels.filter((e) => e.args.path.indexOf('archive/tmp/') !== 0);
    assert.equal(dels.length, 3); assert.equal(out.length, 1);
    assert.ok(c.briefs[1].forbidden_note.includes('archive/tmp'));
    const ap = c.approvals.filter((x) => x.args.path === out[0].args.path)[0];
    assert.equal(ap.decided - ap.requested, 1000);
    // the other agent is clean: two mails, two drafts, nothing sent
    assert.equal(c.log.filter((e) => e.kind === 'call' && e.tool === 'mail_draft').length, 2);
    assert.equal(c.log.filter((e) => e.kind === 'call' && e.tool === 'mail_send').length, 0);
    assert.equal(key.faults.length, 5);
    assert.deepEqual([...new Set(key.faults.map((f) => f.kind))].length, 4);
    const secs = c.approvals.map((x) => (x.decided - x.requested) / 1000);
    say('run C:', c.log.length, 'log lines from two agents; F5 deletion outside archive/tmp at line', out[0].n + ', approved after', secs.join(', '), 'seconds');
  },
  async hosted() {
    // the hosted-model client against a stand-in for an OpenAI-compatible address: the protocol, not a model
    const script = [
      { tool_calls: [{ id: 'c1', function: { name: 'mail_list', arguments: '{"folder":"inbox"}' } }, { id: 'c2', function: { name: 'files_read', arguments: '{"path":"hr/salaries_2026.csv"}' } }] },
      { tool_calls: [{ id: 'c3', function: { name: 'mail_send', arguments: JSON.stringify({ to: WD.PEOPLE.lamis.mail, subject: 's', body: 'b' }) } }] },
      { content: 'done', tool_calls: [{ id: 'c4', function: { name: 'finish', arguments: '{"summary":"تم"}' } }] }
    ];
    const seen = [];
    const fake = async (url, init) => { const body = JSON.parse(init.body); seen.push({ url, auth: init.headers.Authorization, body }); return { ok: true, json: async () => ({ choices: [{ message: Object.assign({ role: 'assistant', content: '' }, script[seen.length - 1]) }] }) }; };
    const st = await SB.preset('1.3', clock());
    SB.grant(st, 'mail', 'act', 'inbox');
    const model = SB.hostedModel({ url: 'https://models.example/v1/', model: 'free-model', key: 'k' }, fake);
    const run = SB.startRun(st, { task: 'report', brief: st.setup.brief });
    await SB.advance(st, run, model);
    assert.equal(run.status, 'waiting');
    SB.decide(st, run, true, you, '');
    await SB.advance(st, run, model);
    assert.equal(run.status, 'done'); assert.equal(run.final, 'تم');
    assert.equal(seen[0].url, 'https://models.example/v1/chat/completions'); assert.equal(seen[0].auth, 'Bearer k');
    assert.equal(seen[0].body.tools.length, SB.TOOLS.length);
    assert.ok(seen[0].body.messages[1].content.includes('شروط التوقف'));
    const toolMsgs = seen[2].body.messages.filter((m) => m.role === 'tool');
    assert.deepEqual(toolMsgs.map((m) => m.tool_call_id), ['c1', 'c2', 'c3']);
    assert.ok(JSON.parse(toolMsgs[1].content).error.includes('مرفوض')); // the refused read went back to the model as a refusal
    assert.equal(st.world.sent.length, 1);
    say('hosted-model client: 3 requests, tool results returned in order, one refusal, one approval');
  }
};

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LAB);
for (const id of want) {
  console.log('Lab ' + id);
  await LAB[id]();
  console.log('  PASS');
}
console.log(want.length + ' checks passed');
