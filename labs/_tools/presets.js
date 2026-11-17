/* The reference state each lab starts from, and the reference briefs. A classic script that
   adds to SB (core.js). A lab never needs the result of another lab: it loads its state here. */
(function (root) {
  'use strict';
  var SB = root.SB, WD = root.SB_WORLD;

  var BRIEF = {
    goal: 'مسودة تقرير البرنامج الأسبوعي عن الأسبوع 46 (من 8 إلى 12 نوفمبر 2026)، في صفحة واحدة، تقرؤها لميس المهيدب قبل اجتماع المكتب يوم الأحد.',
    context: 'تعمل لمنسق في مكتب برامج المنح بمؤسسة بَيدر. الأعداد تؤخذ من سجل البرنامج، والدفعات من جدول الصرف، والاجتماعات من التقويم. التقرير بسبعة بنود ثابتة بقالب المكتب.',
    sources: ['mail:inbox', 'files:programme', 'files:reports', 'calendar'],
    forbidden: ['send', 'delete', 'pay', 'publish'],
    forbidden_note: 'لا تقرأ مجلد الموارد البشرية ولا بريد المتقدمين، ولا تكتب خارج مجلد التقارير.',
    stop: 'إذا كان رقم ناقصًا أو غير موجود في المصادر فاكتب «غير متوفر» وتوقف واسألني. إذا وجدت تعارضًا بين مصدرين فاذكر الرقمين وتوقف واسألني. إذا رُفض طلب أداة فلا تبحث عن طريق آخر.',
    format: 'بقالب report_template.md، وبعد كل بند مصدره بين قوسين، ويُحفظ مسودة في مجلد reports ولا يُرسل.',
    check: 'قبل أن تنهي: طابق الأعداد الثلاثة الأولى مع سجل البرنامج، واذكر كل طلب رُفض وكل بند بقي مفتوحًا.'
  };
  var BRIEF_D2 = SB.clone(BRIEF);
  BRIEF_D2.sources = ['mail:inbox', 'mail:external', 'files:programme', 'files:reports', 'files:partners', 'calendar'];
  BRIEF_D2.forbidden_note = 'لا تقرأ مجلد الموارد البشرية، ولا تكتب خارج مجلد التقارير.';
  BRIEF_D2.context += ' هذا الأسبوع يضاف إلى التقرير ما ورد من المتقدمين ومن الجامعات الشريكة.';

  var DRAFT = '# تقرير البرنامج الأسبوعي: الأسبوع 46\n\n- الطلبات المستلمة: 15 (المصدر: سجل البرنامج)\n- المحالة إلى التحكيم: 9 (المصدر: سجل البرنامج)\n- المعادة للاستكمال: 4 (المصدر: سجل البرنامج)\n- اجتماعات لجان التحكيم في الأسبوع القادم: 2 (المصدر: التقويم)\n- الدفعات المستحقة في الأسبوع القادم: 3 دفعات، مجموعها 186000 ريال (المصدر: جدول الصرف)\n- متوسط درجات مسار الصحة: غير متوفر، لم تصل الدرجات من اللجنة (المصدر: رسالة رانيا m02)\n- المشكلات المفتوحة: 2 (المصدر: البريد الداخلي m04 و m05)\n';

  var MINIMAL = [['memory', 'read', '*'], ['mail', 'read', 'inbox'], ['files', 'read', 'programme'], ['files', 'write', 'reports'], ['calendar', 'read', '*']];
  var by = { by: WD.PEOPLE.raef.name };

  function wide(st) { [['mail', 'read', '*'], ['files', 'read', '*'], ['files', 'write', 'reports'], ['calendar', 'read', '*'], ['memory', 'read', '*']].forEach(function (g) { SB.grant(st, g[0], g[1], g[2], by); }); }

  /* the grants of lab 2.1: what a busy office ends up with after a few weeks */
  function drifted(st) {
    [['memory', 'write', '*'], ['mail', 'act', '*'], ['files', 'read', 'programme'], ['files', 'read', 'reports'], ['files', 'read', 'partners'], ['files', 'write', 'reports'],
      ['files', 'act', '*'], ['calendar', 'read', '*'], ['payments', 'act', '*']].forEach(function (g) { SB.grant(st, g[0], g[1], g[2], by); });
    st.approve = { send: true, delete: false, pay: true, publish: true };
  }
  /* the grants after the three limiting changes of lab 2.2 */
  function tightened(st) {
    [['memory', 'read', '*'], ['mail', 'read', '*'], ['files', 'read', 'programme', { except: 'programme/panels' }], ['files', 'read', 'reports'], ['files', 'read', 'partners'], ['files', 'write', 'reports'], ['calendar', 'read', '*']].forEach(function (g) { SB.grant(st, g[0], g[1], g[2], Object.assign({}, by, g[3] || {})); });
    st.approve = { send: true, delete: true, pay: true, publish: true };
    st.recipients = 'internal';
  }

  async function preset(id, clock) {
    var st = SB.newState(id.charAt(0) === '2' && id !== '2.4' ? 2 : 1, clock), setup = { task: 'report', brief: null, thin: false };
    if (id === '1.1') { wide(st); setup.thin = true; }
    else if (id === '1.2') { wide(st); setup.brief = SB.emptyBrief(); }
    else if (id === '1.3') { setup.brief = SB.clone(BRIEF); }
    else if (id === '1.4') {
      st.world.files['reports/weekly_46_draft.md'] = { cls: 'داخلي', text: DRAFT };
      [['mail', 'act', '*'], ['calendar', 'act', '*'], ['files', 'act', '*'], ['payments', 'act', '*'], ['memory', 'read', '*']].forEach(function (g) { SB.grant(st, g[0], g[1], g[2], by); });
      st.approve = { send: false, delete: false, pay: false, publish: false };
      setup.task = 'followup';
    } else if (id === '2.1') { drifted(st); setup.brief = SB.clone(BRIEF_D2); }
    else if (id === '2.2') {
      drifted(st);
      var run = SB.startRun(st, { task: 'report', brief: SB.clone(BRIEF_D2) }), agent = SB.scriptedAgent();
      await SB.advance(st, run, agent);
      while (run.status === 'waiting') { SB.decide(st, run, false, WD.PEOPLE.you.name, 'لم أطلب هذا الإجراء'); await SB.advance(st, run, agent); }
      setup.brief = SB.clone(BRIEF_D2);
    } else if (id === '2.4' || id === 'own') { setup.brief = SB.emptyBrief(); setup.task = 'own'; }
    st.setup = setup;
    return st;
  }

  SB.REF = { BRIEF: BRIEF, BRIEF_D2: BRIEF_D2, DRAFT: DRAFT, MINIMAL: MINIMAL };
  SB.preset = preset;
  SB.tightened = tightened;
  SB.PRESETS = [['1.1', 'المختبر 1.1: تشغيل أول بطلب من سطر'], ['1.2', 'المختبر 1.2: الموجز ذو البنود السبعة'], ['1.3', 'المختبر 1.3: الصلاحيات خطوة خطوة'], ['1.4', 'المختبر 1.4: الموافقات والتشغيل المجدول'],
    ['2.1', 'المختبر 2.1: تمرين الحقن، المرور الأول'], ['2.2', 'المختبر 2.2: أوقف واحتوِ وبلّغ'], ['own', 'مهمتي: صندوق لمهمة من عملي']];
})(typeof globalThis !== 'undefined' ? globalThis : this);
