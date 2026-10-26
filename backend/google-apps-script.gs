/**
 * Water Innovation Hackathon — приём заявок.
 * Google Apps Script, привязанный к Google Таблице (Расширения → Apps Script).
 *
 * Что делает:
 *  1. Пишет заявку в лист «Заявки» (единая база для организаторов).
 *  2. Отправляет капитану письмо-подтверждение на языке заявки.
 *  3. Уведомляет организаторов о новой заявке.
 *  4. Отклоняет заявки после 18.11.2026 23:59 (Астана) и дубли по submissionId.
 */

const ORGANIZER_EMAILS = ['organizers@example.kz']; // ← адреса организаторов
const SHEET_NAME = 'Заявки';
const REG_CLOSE = new Date('2026-11-18T23:59:59.999+05:00');

const MAIL = {
  ru: {
    subject: 'Заявка принята — Water Innovation Hackathon',
    body: (d) => `Здравствуйте, ${d.team.captainName}!\n\nЗаявка команды «${d.team.teamName}» на Water Innovation Hackathon успешно отправлена.\n\nРезультаты отбора будут направлены на этот email 19–21 ноября 2026 года.\n\nInnovate for Every Drop.\nКоманда Water Innovation Hackathon`,
  },
  kk: {
    subject: 'Өтінім қабылданды — Water Innovation Hackathon',
    body: (d) => `Сәлеметсіз бе, ${d.team.captainName}!\n\n«${d.team.teamName}» командасының Water Innovation Hackathon-ға өтінімі сәтті жіберілді.\n\nІріктеу нәтижелері 2026 жылғы 19–21 қарашада осы email-ге жіберіледі.\n\nӘр тамшы үшін — инновация.\nWater Innovation Hackathon командасы`,
  },
  en: {
    subject: 'Application received — Water Innovation Hackathon',
    body: (d) => `Hello, ${d.team.captainName}!\n\nYour team “${d.team.teamName}” has successfully applied to the Water Innovation Hackathon.\n\nSelection results will be sent to this email on November 19–21, 2026.\n\nInnovate for Every Drop.\nThe Water Innovation Hackathon team`,
  },
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (new Date() > REG_CLOSE) return json({ ok: false, error: 'closed' });

    const d = JSON.parse(e.postData.contents);
    const err = validate(d);
    if (err) return json({ ok: false, error: err });

    const sheet = getSheet();
    const ids = sheet.getRange(2, 2, Math.max(sheet.getLastRow() - 1, 1), 1).getValues().flat();
    if (ids.indexOf(d.submissionId) !== -1) return json({ ok: true, duplicate: true });

    const members = d.members.map((m) => `${m.name} <${m.email}>, ${m.age}${m.org ? ', ' + m.org : ''}${m.role ? ' — ' + m.role : ''}`).join('\n');
    sheet.appendRow([
      new Date(), d.submissionId, d.lang, d.team.teamName, d.team.captainName, d.team.captainEmail,
      "'" + d.team.phone, d.team.city, d.members.length, members,
      d.idea.projectName, d.idea.track, d.idea.idea, d.idea.link,
      d.consents.personalData, d.consents.rules,
    ]);

    const m = MAIL[d.lang] || MAIL.ru;
    MailApp.sendEmail({ to: d.team.captainEmail, subject: m.subject, body: m.body(d), name: 'Water Innovation Hackathon' });
    MailApp.sendEmail({
      to: ORGANIZER_EMAILS.join(','),
      subject: `Новая заявка: ${d.team.teamName} (${d.members.length} чел.)`,
      body: `Команда: ${d.team.teamName}\nКапитан: ${d.team.captainName} <${d.team.captainEmail}>, ${d.team.phone}\nГород: ${d.team.city}\nНаправление: ${d.idea.track || '—'}\n\nУчастники:\n${members}\n\nИдея: ${d.idea.idea || '—'}\nСсылка: ${d.idea.link || '—'}`,
    });
    return json({ ok: true });
  } catch (x) {
    return json({ ok: false, error: String(x) });
  } finally {
    lock.releaseLock();
  }
}

function validate(d) {
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!d || !d.team || !Array.isArray(d.members)) return 'bad payload';
  const t = d.team;
  if (!t.teamName || !t.captainName || !email.test(t.captainEmail) || !t.phone || !t.city) return 'team fields';
  if (d.members.length < 3 || d.members.length > 5) return 'team size';
  for (const m of d.members) {
    if (!m.name || !email.test(m.email) || !(m.age >= 16 && m.age <= 35)) return 'member fields';
  }
  if (!d.consents || !d.consents.personalData || !d.consents.rules) return 'consents';
  if (d.idea && d.idea.idea && d.idea.idea.length > 1000) return 'idea too long';
  return null;
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['Дата', 'ID', 'Язык', 'Команда', 'Капитан', 'Email капитана', 'Телефон', 'Город', 'Кол-во', 'Участники',
      'Проект', 'Направление', 'Идея', 'Ссылка', 'Согласие ПД', 'Согласие с правилами']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
