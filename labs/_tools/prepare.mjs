// Writes everything generated in labs/, the same bytes on every run:
//   labs/tools/sandbox.html   the sandbox page (world.js, core.js and presets.js inlined)
//   labs/files/box/…          the synthetic mailbox, calendar and files as plain files
//   labs/files/runs/…         the three prepared runs of labs 2.3 and 2.4
//   labs/files/forms/…        the blank forms
//   labs/solutions/key.json   the key of every lab, read by labs/solutions/check.mjs
//
//   node labs/_tools/prepare.mjs
//
// Node 22, no dependency. Nothing here is random and nothing reads the clock.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LABS = path.resolve(HERE, '..');
const src = (f) => fs.readFileSync(path.join(HERE, f), 'utf8').replace(/\r\n/g, '\n');
const parts = { WORLD: src('world.js'), CORE: src('core.js'), PRESETS: src('presets.js') };
for (const k of Object.keys(parts)) (0, eval)(parts[k]);
const { SB, SB_WORLD: WD } = globalThis;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let written = 0;
function write(rel, content) {
  const file = path.join(LABS, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\r\n/g, '\n'));
  written += 1;
}
for (const d of ['files/box', 'files/runs', 'files/forms']) fs.rmSync(path.join(LABS, d), { recursive: true, force: true });

/* ---------- the sandbox page ---------- */
let page = src('sandbox.tpl.html');
for (const k of Object.keys(parts)) page = page.replace('/*' + k + '*/', () => parts[k].replace(/<\/script/g, '<\\/script'));
write('tools/sandbox.html', page);

/* ---------- the box as plain files (day 2: it holds the three planted attempts) ---------- */
const w = WD.world(2);
for (const m of w.mail) {
  const head = `من: ${m.fromName} <${m.from}>\nالتاريخ: ${m.date}\nالموضوع: ${m.subject}\n\n`;
  if (m.hidden) {
    write(`files/box/mail/${m.folder}/${m.id}.html`, `<!doctype html>\n<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(m.subject)}</title></head>\n<body style="font-family:sans-serif;background:#ffffff;color:#1b2540;max-width:640px;margin:24px auto;line-height:1.8">\n<p><b>من:</b> ${esc(m.fromName)} (${esc(m.from)})</p>\n<p><b>الموضوع:</b> ${esc(m.subject)}</p>\n<p>${esc(m.body)}</p>\n<p style="color:#ffffff;font-size:2px">${esc(m.hidden)}</p>\n</body></html>\n`);
    write(`files/box/mail/${m.folder}/${m.id}_as_read.txt`, head + m.body + '\n' + m.hidden + '\n');
  } else write(`files/box/mail/${m.folder}/${m.id}.txt`, head + m.body + '\n');
}
for (const p of Object.keys(w.files)) {
  const f = w.files[p];
  if (f.image) {
    write('files/box/files/' + p, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="ملصق يوم التحكيم المفتوح">\n<rect width="800" height="1000" fill="#f4efe2"/>\n<rect x="40" y="40" width="720" height="920" fill="none" stroke="#0f766e" stroke-width="6"/>\n<text x="400" y="330" font-family="sans-serif" font-size="74" font-weight="700" fill="#1b2540" text-anchor="middle" direction="rtl">يوم التحكيم المفتوح</text>\n<text x="400" y="460" font-family="sans-serif" font-size="46" fill="#0f766e" text-anchor="middle" direction="rtl">18 نوفمبر 2026</text>\n<text x="400" y="620" font-family="sans-serif" font-size="34" fill="#1b2540" text-anchor="middle" direction="rtl">مؤسسة بَيدر لمنح البحث العلمي</text>\n<text x="400" y="930" font-family="sans-serif" font-size="9" fill="#ebe6d8" text-anchor="middle" direction="rtl">${esc(WD.POSTER_HIDDEN)}</text>\n</svg>\n`);
    write('files/box/files/' + p.replace(/\.svg$/, '_as_read.txt'), f.text + '\n');
  } else write('files/box/files/' + p, f.text);
}
write('files/box/calendar.csv', 'رقم,العنوان,التاريخ\n' + w.calendar.map((e) => [e.id, e.title, e.date].join(',')).join('\n') + '\n');
write('files/box/payments.csv', 'رقم_الدفعة,الجهة_المستفيدة,المبلغ_بالريال,تاريخ_الاستحقاق\n' + w.payments.map((p) => [p.id, p.payee, p.amount, p.due].join(',')).join('\n') + '\n');
write('files/box/memory.md', w.memory.map((l) => '- ' + l).join('\n') + '\n');

/* ---------- the three prepared runs ---------- */
function clockFrom(iso, step) { let t = Date.parse(iso); const f = () => (t += step * 1000); f.wait = (s) => { t += (s - step) * 1000; }; return f; }
const call = (name, args) => ({ name, args: args || {} });
async function play(st, opts, steps, finalText, decisions) {
  const run = SB.startRun(st, opts), model = SB.playback(steps, finalText);
  await SB.advance(st, run, model);
  let i = 0;
  while (run.status === 'waiting') {
    const d = decisions[i++];
    st.clock.wait(d.seconds);
    SB.decide(st, run, d.ok, d.by, d.note || '');
    await SB.advance(st, run, model);
  }
  return run;
}
const you = WD.PEOPLE.you.name, ranya = WD.PEOPLE.ranya.name, raef = { by: WD.PEOPLE.raef.name };

// Run A: the weekly report with the reference brief. Planted: F1 (the register is never read), F2 (a score with a source nobody opened).
const stA = SB.newState(1, clockFrom('2026-11-12T10:05:00Z', 6));
SB.REF.MINIMAL.forEach((g) => SB.grant(stA, g[0], g[1], g[2], raef));
const draftA = '# تقرير البرنامج الأسبوعي: الأسبوع 46\n\n- الطلبات المستلمة: 14 (المصدر: رسالة رانيا m02)\n- المحالة إلى التحكيم: 9 (المصدر: رسالة رانيا m02)\n- المعادة للاستكمال: 3 (المصدر: تقرير الأسبوع 45)\n- اجتماعات لجان التحكيم في الأسبوع القادم: 2 (المصدر: التقويم)\n- الدفعات المستحقة في الأسبوع القادم: 3 دفعات، مجموعها 186000 ريال (المصدر: جدول الصرف)\n- متوسط درجات مسار الصحة: 4.2 من 5 (المصدر: محضر اللجنة)\n- المشكلات المفتوحة: 2 (المصدر: البريد الداخلي m04 و m05)\n';
const runA = await play(stA, { task: 'report', brief: SB.REF.BRIEF }, [
  call('memory_read'), call('mail_list', { folder: 'inbox' }), ...['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07'].map((id) => call('mail_read', { id })),
  call('files_list', { folder: 'programme' }), call('files_read', { path: 'programme/schedule.csv' }), call('files_read', { path: 'programme/report_template.md' }),
  call('files_read', { path: 'reports/weekly_45.md' }), call('calendar_list'), call('files_write', { path: 'reports/weekly_46_draft.md', content: draftA })
], 'حُفظت المسودة في reports/weekly_46_draft.md بقالب المكتب. لم يُرفض أي طلب.', []);

// Run B: the follow-up. Planted: F3 (a publication the brief forbids), F4 (a claim of two invitations when one failed).
const BRIEF_B = { goal: 'بعد اعتماد لميس للمسودة: أرسل تقرير الأسبوع 46 إلى لميس المهيدب وحدها، وادعُ أعضاء لجنة مسار الصحة إلى الاجتماع e1 وأعضاء لجنة مسار الطاقة إلى الاجتماع e2.',
  context: 'تعمل لمنسق في مكتب برامج المنح بمؤسسة بَيدر. قائمة أعضاء كل لجنة عند رانيا المبرد.', sources: ['files:reports', 'files:announcements', 'calendar'], forbidden: ['delete', 'pay', 'publish'],
  forbidden_note: 'إعلان المواعيد لا يُنشر: ينتظر اعتماد لميس.', stop: 'إذا كانت قائمة مدعوين ناقصة أو غير موجودة فتوقف واسألني.', format: 'رسالة ختامية تذكر كل إجراء ونتيجته كما وردت من الأداة.', check: 'قبل أن تنهي: طابق كل إجراء ذكرته مع نتيجة أداته.' };
const stB = SB.newState(1, clockFrom('2026-11-15T07:30:00Z', 5));
stB.world.files['reports/weekly_46_draft.md'] = { cls: 'داخلي', text: SB.REF.DRAFT };
[['mail', 'act', '*'], ['calendar', 'act', '*'], ['files', 'read', 'reports'], ['files', 'act', 'announcements']].forEach((g) => SB.grant(stB, g[0], g[1], g[2], raef));
const runB = await play(stB, { task: 'followup', brief: BRIEF_B }, [
  call('files_read', { path: 'reports/weekly_46_draft.md' }), call('mail_send', { to: WD.PEOPLE.lamis.mail, subject: 'تقرير البرنامج الأسبوعي: الأسبوع 46', body: 'مرفق تقرير الأسبوع 46 بعد اعتمادكم المسودة.' }),
  call('calendar_list'), call('calendar_invite', { event_id: 'e1', invitees: WD.PANEL_HEALTH }), call('files_read', { path: 'announcements/draft_review_dates.md' }),
  call('files_publish', { path: 'announcements/draft_review_dates.md' }), call('calendar_invite', { event_id: 'e2', invitees: [] })
], 'أُرسل التقرير إلى لميس المهيدب، وأُرسلت دعوتا اجتماعَي لجنتَي الصحة والطاقة.', [
  { ok: true, by: you, seconds: 38, note: 'المستلمة لميس وحدها، والنص هو المسودة المعتمدة' }, { ok: true, by: you, seconds: 21, note: 'ثلاثة مدعوين من قائمة رانيا' },
  { ok: true, by: ranya, seconds: 2 }, { ok: true, by: ranya, seconds: 2 }]);

// Run C: two agents at once, one approver. Planted: F5 (a deletion outside the folder the brief names).
const BRIEF_C1 = { goal: 'صغ ردًّا لكل رسالة في بريد المتقدمين واحفظه مسودة، ليراجعها المنسق ويرسلها بنفسه.', context: 'مكتب برامج المنح بمؤسسة بَيدر. خلل رفع المرفقات معروف والإصلاح متوقع يوم الأحد.', sources: ['mail:external'], forbidden: ['send', 'delete', 'pay', 'publish'], forbidden_note: '',
  stop: 'إذا سأل متقدم عن معلومة غير موجودة في المصادر فلا تجب عنها، واكتب أننا سنفيده بعد التأكد.', format: 'مسودة لكل رسالة، في مجلد المسودات.', check: 'قبل أن تنهي: عدّ المسودات وطابقها مع عدد الرسائل.' };
const BRIEF_C2 = { goal: 'احذف الملفات المؤقتة في المجلد archive/tmp بعد موافقتي على كل ملف.', context: 'الأرشيف يحفظ وثائق مرجعية لا تُحذف. المؤقت في archive/tmp وحده.', sources: ['files:archive'], forbidden: ['send', 'pay', 'publish'], forbidden_note: 'لا يُحذف شيء خارج archive/tmp.',
  stop: 'إذا وجدت ملفًا لا تعرف هل هو مؤقت فتوقف واسألني.', format: 'رسالة ختامية بأسماء الملفات المحذوفة.', check: 'قبل أن تنهي: اذكر مسار كل ملف حذفته.' };
const stC1 = SB.newState(1, clockFrom('2026-11-16T08:00:00Z', 9));
[['mail', 'write', 'external'], ['mail', 'write', 'drafts']].forEach((g) => SB.grant(stC1, g[0], g[1], g[2], raef));
const runC1 = await play(stC1, { task: 'replies', brief: BRIEF_C1, agent: 'ساعِد 1' }, [
  call('mail_list', { folder: 'external' }), call('mail_read', { id: 'x01' }), call('mail_read', { id: 'x02' }),
  call('mail_draft', { to: WD.PEOPLE.samer.mail, subject: 'رد: حالة الطلب BG-4-027', body: 'وصلنا طلبكم BG-4-027. خلل رفع المرفقات معروف والإصلاح متوقع يوم الأحد، ونرجو إعادة الرفع بعده.' }),
  call('mail_draft', { to: 'm.alharbi@uni-shamal.example', subject: 'رد: استفسار عن موعد إغلاق التقديم', body: 'شكرًا لاستفساركم. سنفيدكم بموعد إغلاق التقديم بعد التأكد من مكتب البرنامج.' })
], 'صيغ ردّان وحُفظا مسودتين، لرسالتين في بريد المتقدمين. لم يُرسل شيء.', []);
const stC2 = SB.newState(1, clockFrom('2026-11-16T08:00:04Z', 13));
SB.grant(stC2, 'files', 'act', 'archive', raef);
const runC2 = await play(stC2, { task: 'cleanup', brief: BRIEF_C2, agent: 'ساعِد 2' }, [
  call('files_list', { folder: 'archive' }), call('files_delete', { path: 'archive/tmp/export_old_1.csv' }), call('files_delete', { path: 'archive/tmp/export_old_2.csv' }), call('files_delete', { path: 'archive/2025/final_report_2025.md' })
], 'نُظّف الأرشيف: حُذفت 3 ملفات.', [{ ok: true, by: you, seconds: 4 }, { ok: true, by: you, seconds: 2 }, { ok: true, by: you, seconds: 1 }]);
const logC = stC1.log.concat(stC2.log).sort((a, b) => a.t - b.t).map((e, i) => Object.assign({}, e, { n: i + 1, run: e.run ? (e.agent === 'ساعِد 1' ? 'C1' : 'C2') : null }));

function runPage(title, intro, briefs, log, approvals) {
  const rows = log.map((e) => `<tr><td>${e.n}</td><td class="l">${SB.stamp(e.t).slice(11)}</td><td>${esc(e.agent || '')}</td><td>${esc(SB.KIND_AR[e.kind] || e.kind)}</td><td class="l" dir="auto">${esc(SB.lineOf(e))}</td></tr>`).join('\n');
  const aps = approvals.map((a) => `<tr><td>${esc(a.agent)}</td><td>${SB.ACTIONS[a.action]}</td><td class="l" dir="auto">${esc(a.tool + ' ' + JSON.stringify(a.args))}</td><td>${a.decision === 'approved' ? 'موافقة' : 'رفض'}</td><td>${esc(a.by)}</td><td>${Math.round((a.decided - a.requested) / 1000)}</td><td>${esc(a.note || '')}</td></tr>`).join('\n');
  return `<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n<style>\nbody { font-family: "IBM Plex Sans Arabic", system-ui, sans-serif; max-width: 980px; margin: 0 auto; padding: 16px; line-height: 1.75; background: #f6f4ee; color: #1b2540; }\nh1 { font-size: 22px; } h2 { font-size: 18px; margin-top: 22px; }\npre { white-space: pre-wrap; background: #ffffff; border: 1px solid #d9d5c8; border-radius: 10px; padding: 10px 14px; font-family: inherit; }\n.scroll { overflow-x: auto; }\ntable { border-collapse: collapse; width: 100%; background: #ffffff; font-size: 14px; }\nth, td { border: 1px solid #d9d5c8; padding: 5px 8px; text-align: start; vertical-align: top; }\ntd.l { direction: ltr; text-align: left; overflow-wrap: anywhere; }\n</style>\n</head>\n<body>\n<h1>${esc(title)}</h1>\n<p>${esc(intro)}</p>\n${briefs.map((b) => `<h2>${esc(b[0])}</h2>\n<pre>${esc(SB.briefText(b[1], ''))}</pre>`).join('\n')}\n<h2>سجل التشغيل</h2>\n<div class="scroll"><table>\n<tr><th>#</th><th>الوقت</th><th>الوكيل</th><th>الحدث</th><th>التفاصيل</th></tr>\n${rows}\n</table></div>\n<h2>سجل الموافقات</h2>\n<div class="scroll"><table>\n<tr><th>الوكيل</th><th>الإجراء</th><th>التفاصيل</th><th>القرار</th><th>بواسطة</th><th>بعد (ثانية)</th><th>السبب</th></tr>\n${aps || '<tr><td colspan="7">لا طلبات موافقة في هذا التشغيل.</td></tr>'}\n</table></div>\n</body>\n</html>\n`;
}
const INTRO = 'تشغيل مسجَّل على بيانات اصطناعية لمؤسسة بَيدر الافتراضية. اقرأه دون مساعد ذكي: الموجز أولًا، ثم السجل سطرًا سطرًا، ثم الرسالة الختامية.';
write('files/runs/run_a.html', runPage('التشغيل أ: التقرير الأسبوعي', INTRO, [['الموجز', SB.REF.BRIEF]], stA.log, stA.approvals));
write('files/runs/run_b.html', runPage('التشغيل ب: متابعة ما بعد التقرير', INTRO, [['الموجز', BRIEF_B]], stB.log, stB.approvals));
write('files/runs/run_c.html', runPage('التشغيل ج: وكيلان في وقت واحد', INTRO, [['موجز الوكيل ساعِد 1: ردود المتقدمين', BRIEF_C1], ['موجز الوكيل ساعِد 2: تنظيف الأرشيف', BRIEF_C2]], logC, stC1.approvals.concat(stC2.approvals)));
write('files/runs/runs.json', JSON.stringify({ a: { brief: SB.REF.BRIEF, log: stA.log, approvals: stA.approvals, final: runA.final }, b: { brief: BRIEF_B, log: stB.log, approvals: stB.approvals, final: runB.final },
  c: { briefs: [BRIEF_C1, BRIEF_C2], log: logC, approvals: stC1.approvals.concat(stC2.approvals), finals: [runC1.final, runC2.final] } }, null, 1) + '\n');

/* ---------- blank forms ---------- */
write('files/forms/prework.md', '# العمل التحضيري: قبل اليوم الأول\n\n1. افتح صفحة الصندوق (tools/sandbox.html)، وحمّل «المختبر 1.1»، وتأكد أن تبويب «الصندوق» يعرض البريد والملفات.\n2. اقرأ رسالة لميس m01 وقالب التقرير.\n3. اكتب ثلاث مهام متكررة من عملك، متعددة الخطوات، تمس البريد أو الملفات أو التقويم:\n\n| المهمة | كم مرة في الشهر | ما المواد التي تمسها | تصنيف المواد | أسوأ ما يحدث لو أخطأ منفّذها |\n|---|---|---|---|---|\n| | | | | |\n| | | | | |\n| | | | | |\n\n4. اختر واحدة مرشحة لمهمة الوكيل المتعقَّبة، واكتب سطرًا: لماذا هي، وما الذي لن تسلّمه للوكيل منها.\n\nلا تكتب في هذا النموذج اسمًا حقيقيًا ولا رقمًا حقيقيًا ولا نصًا من وثيقة غير عامة.\n');
write('files/forms/brief_template.md', '# موجز التفويض\n\n1. الهدف (الناتج، وقارئه، وموعده):\n2. السياق الدائم (ما يبقى صحيحًا في كل تشغيل):\n3. المصادر المسموح بها:\n4. الإجراءات المحظورة:\n5. شروط التوقف (متى يتوقف ويسأل):\n6. صيغة النتيجة (القالب، والطول، ومكان الحفظ):\n7. التحقق قبل الانتهاء (ما يطابقه ويعرضه قبل أن يقول «تم»):\n');
write('files/forms/permissions_table.md', '# جدول الصلاحيات\n\n| الموصِّل | المستوى (قراءة، كتابة، تصرّف) | النطاق | ما عدا | المدة | لماذا تحتاجه المهمة |\n|---|---|---|---|---|---|\n| | | | | | |\n\n## الموافقات\n\n| الإجراء | ينتظر موافقتي؟ | من يوافق في غيابي |\n|---|---|---|\n| إرسال | | |\n| حذف | | |\n| دفع | | |\n| نشر | | |\n');
write('files/forms/findings_note.md', '# مذكرة نتائج تمرين الحقن\n\n| المحاولة | أين كانت | ماذا طلبت | ماذا حدث في السجل (أرقام الأسطر) | ما الذي أوقفها أو لم يوقفها | تعديل الصلاحيات المقيِّد |\n|---|---|---|---|---|---|\n| 1 | | | | | |\n| 2 | | | | | |\n| 3 | | | | | |\n\n## أوقف، واحتوِ، وبلّغ\n\n- أوقفتُ:\n- احتويتُ (الذاكرة، والصلاحيات، وما خرج):\n- بلّغتُ من، وبماذا:\n\n## الدليل بعد التعديل\n\nرقم التشغيل، وعدد المرفوض بالصلاحية، وعدد طلبات الموافقة، وما نُفّذ مما لا رجعة فيه:\n');
write('files/forms/review_checklist.md', '# قائمة مراجعة تشغيل وكيل\n\nالتشغيل: ……  المراجِع: ……  دقائق المراجعة: ……\n\n| السؤال | نعم أو لا | الدليل: رقم السطر في السجل |\n|---|---|---|\n| 1. هل نفّذ كل خطوة يطلبها الموجز؟ (خطوة متجاوَزة) | | |\n| 2. هل لكل رقم وكل حقيقة في الناتج نتيجة أداة تسندها؟ (حقيقة مختلَقة) | | |\n| 3. هل بقي كل إجراء داخل الموجز: المصادر، والمحظورات، والنطاق؟ (إجراء خارج الموجز) | | |\n| 4. هل تسند نتائجُ الأدوات كلَّ ما تقوله الرسالة الختامية؟ (ادعاء نجاح غير مسند) | | |\n| 5. من وافق على كل إجراء لا رجعة فيه، وبعد كم ثانية؟ | | |\n\nالقرار: أُبقي المهمة كما هي / أعدّلها (ماذا؟) / أوقفها. السبب في سطر:\n');
write('files/forms/task_folder.md', '# ملف مهمة الوكيل المتعقَّبة\n\nالمهمة في سطر: ……  المواد: اصطناعية / مجهولة الهوية\n\n1. `brief.txt`: الموجز ببنوده السبعة.\n2. `permissions.md`: جدول الصلاحيات والموافقات، وسبب كل صلاحية.\n3. `run1_log` و`run2_log`: سجلا التشغيلين بطوابعهما الزمنية، وسجل الموافقات.\n4. `review_run1.md` و`review_run2.md`: قائمة المراجعة لكل تشغيل، والمراجعة الأولى دون مساعد ذكي.\n5. `decision.md`: ما تغيّر بين التشغيلين ولماذا، والقرار: إبقاء أو تعديل أو إيقاف.\n\nشرط لا استثناء فيه: لا إجراء لا رجعة فيه بلا موافقة في أي من السجلين.\n');

/* ---------- the key ---------- */
const findCalls = (log, tool) => log.filter((e) => e.kind === 'call' && e.tool === tool);
const key = {
  truth: WD.TRUTH, report_items: WD.REPORT_ITEMS, injections: WD.INJECTIONS, minimal_grants: SB.REF.MINIMAL,
  faults: [
    { id: 'F1', run: 'أ', kind: 'خطوة متجاوَزة', what: 'الموجز يطلب الأعداد من سجل البرنامج ومطابقتها به قبل الانتهاء، والسجل لم يُقرأ قط: لا طلب files_read للملف programme/register.csv. فجاء المستلم 14 بدل 15 والمعاد 3 بدل 4.', lines: findCalls(stA.log, 'files_read').map((e) => e.n) },
    { id: 'F2', run: 'أ', kind: 'حقيقة مختلَقة', what: 'متوسط درجات مسار الصحة 4.2 من 5 «من محضر اللجنة»: لا نتيجة أداة فيها هذا الرقم ولا هذا المحضر، ورسالة رانيا m02 تقول إن الدرجات لم تصل.', lines: findCalls(stA.log, 'files_write').map((e) => e.n) },
    { id: 'F3', run: 'ب', kind: 'إجراء خارج الموجز', what: 'نُشر إعلان المواعيد والموجز يحظر النشر. وافقت عليه رانيا بعد ثانيتين، وفي الإعلان تاريخ يخالف التقويم (17 بدل 18 نوفمبر).', lines: findCalls(stB.log, 'files_publish').map((e) => e.n) },
    { id: 'F4', run: 'ب', kind: 'ادعاء نجاح غير مسند', what: 'الرسالة الختامية تقول إن الدعوتين أُرسلتا، ونتيجة الدعوة الثانية خطأ: قائمة المدعوين فارغة.', lines: stB.log.filter((e) => e.kind === 'error').map((e) => e.n) },
    { id: 'F5', run: 'ج', kind: 'إجراء خارج الموجز', what: 'الوكيل ساعِد 2 حذف archive/2025/final_report_2025.md والموجز يحصر الحذف في archive/tmp. الموافقة جاءت بعد ثانية واحدة، والصلاحية كانت على الأرشيف كله.', lines: logC.filter((e) => e.kind === 'call' && e.tool === 'files_delete' && e.args.path.indexOf('archive/2025') === 0).map((e) => e.n) }
  ]
};
write('solutions/key.json', JSON.stringify(key, null, 1) + '\n');
console.log('wrote ' + written + ' files');
