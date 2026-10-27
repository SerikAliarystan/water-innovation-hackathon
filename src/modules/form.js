import { CONFIG, isRegistrationOpen } from '../config.js';
import { t, onLangChange } from '../i18n/index.js';
import { esc } from '../lib/dom.js';

// Форма регистрации команды: 4 шага, валидация, 3–5 участников, защита от двойной отправки.
// Пользовательские значения всегда проходят через esc() перед вставкой в разметку.

const MIN_MEMBERS = 2; // хакатон командный: от 2 до 5 человек, включая капитана
const MAX_MEMBERS = 5;
const IDEA_MAX = 1000;
const TRACKS = ['track.1', 'track.2', 'form.track.3full', 'form.track.4full', 'track.5', 'track.6', 'form.track.7'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const emptyMember = () => ({ name: '', email: '', age: '', org: '', role: '' });
const freshState = () => ({
  step: 1,
  team: { teamName: '', captainName: '', captainEmail: '', phone: '', city: '' },
  members: [emptyMember(), emptyMember()], // [0] — капитан
  idea: { projectName: '', track: '', idea: '', link: '' },
  consentData: false,
  consentRules: false,
  errors: {},
  submitting: false,
  done: false,
  sendError: false,
});

export function initForm({ announce }) {
  const dialog = document.getElementById('reg');
  const body = dialog.querySelector('[data-reg-body]');
  let state = freshState();
  let opener = null;

  // ---------- Валидация ----------
  const req = (v) => (String(v).trim() ? null : 'err.required');
  const email = (v) => req(v) || (EMAIL_RE.test(String(v).trim()) ? null : 'err.email');
  const phone = (v) => {
    if (req(v)) return 'err.required';
    const digits = String(v).replace(/\D/g, '');
    return /^[+\d\s()-]+$/.test(String(v).trim()) && digits.length >= 10 && digits.length <= 15 ? null : 'err.phone';
  };
  const age = (v) => {
    if (req(v)) return 'err.required';
    const n = Number(v);
    return Number.isInteger(n) && n >= 16 && n <= 120 ? null : 'err.age';
  };
  const url = (v) => {
    const s = String(v).trim();
    if (!s) return null;
    try {
      const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
      return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? null : 'err.url';
    } catch (e) { return 'err.url'; }
  };

  function validateStep(step) {
    const e = {};
    const set = (k, err) => { if (err) e[k] = err; };
    if (step === 1) {
      const tm = state.team;
      set('teamName', req(tm.teamName));
      set('captainName', req(tm.captainName));
      set('captainEmail', email(tm.captainEmail));
      set('phone', phone(tm.phone));
      set('city', req(tm.city));
    }
    if (step === 2) {
      const seen = new Map();
      state.members.forEach((m, i) => {
        const mEmail = i === 0 ? state.team.captainEmail : m.email;
        if (i > 0) {
          set(`m${i}.name`, req(m.name));
          set(`m${i}.email`, email(m.email));
        }
        set(`m${i}.age`, age(m.age));
        const key = String(mEmail).trim().toLowerCase();
        if (key) {
          if (seen.has(key) && i > 0) set(`m${i}.email`, e[`m${i}.email`] || 'err.dupEmail');
          seen.set(key, i);
        }
      });
    }
    if (step === 3) {
      set('link', url(state.idea.link));
      if (state.idea.idea.length > IDEA_MAX) e.idea = 'err.max';
    }
    if (step === 4) {
      if (!state.consentData) e.consentData = 'err.consent';
      if (!state.consentRules) e.consentRules = 'err.consent';
    }
    return e;
  }

  // ---------- Разметка ----------
  const errText = (k) => {
    const code = state.errors[k];
    return code ? t(code).replace('{n}', IDEA_MAX) : '';
  };
  const field = ({ id, label, value, type = 'text', required = true, autocomplete = '', placeholder = '', inputmode = '', extra = '', optional = false }) => `
    <div class="field">
      <label for="f-${id}">${esc(label)}${required ? '<span class="req" aria-hidden="true">*</span>' : ''}${optional ? ` <span class="opt">(${esc(t('form.optional'))})</span>` : ''}</label>
      <input class="input" id="f-${id}" name="${id}" type="${type}" value="${esc(value)}"
        ${required ? 'required aria-required="true"' : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''}
        ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''}
        aria-invalid="${state.errors[id] ? 'true' : 'false'}" aria-describedby="e-${id}" ${extra} />
      <p class="field__err" id="e-${id}">${esc(errText(id))}</p>
    </div>`;

  function stepsBar() {
    const names = ['form.s1', 'form.s2', 'form.s3', 'form.s4'];
    return `<ol class="steps" aria-label="${esc(`${t('form.step')} ${state.step} ${t('form.of')} 4`)}">
      ${names.map((n, i) => `<li class="${i + 1 < state.step ? 'is-done' : ''} ${i + 1 === state.step ? 'is-current' : ''}" ${i + 1 === state.step ? 'aria-current="step"' : ''}>${esc(t(n))}</li>`).join('')}
    </ol>`;
  }

  function step1() {
    const tm = state.team;
    return `
      <div class="grid-2">
        ${field({ id: 'teamName', label: t('form.teamName'), value: tm.teamName, autocomplete: 'organization', extra: 'maxlength="80"' })}
        ${field({ id: 'city', label: t('form.city'), value: tm.city, placeholder: t('form.city.ph'), autocomplete: 'address-level2', extra: 'maxlength="80"' })}
      </div>
      ${field({ id: 'captainName', label: t('form.captainName'), value: tm.captainName, autocomplete: 'name', extra: 'maxlength="100"' })}
      <div class="grid-2">
        ${field({ id: 'captainEmail', label: t('form.captainEmail'), value: tm.captainEmail, type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'name@example.com' })}
        ${field({ id: 'phone', label: t('form.phone'), value: tm.phone, type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '+7 700 000 00 00' })}
      </div>`;
  }

  function memberBlock(m, i) {
    const isCap = i === 0;
    const canRemove = !isCap && state.members.length > MIN_MEMBERS;
    return `
      <div class="member ${isCap ? 'member--captain' : ''}" role="group" aria-labelledby="mt-${i}">
        <div class="member__head">
          <h4 class="member__title" id="mt-${i}">${esc(isCap ? t('form.captain') : `${t('form.member')} ${i + 1}`)}</h4>
          ${isCap ? '' : `<button type="button" class="icon-btn" data-remove="${i}" ${canRemove ? '' : 'disabled'}><svg aria-hidden="true"><use href="#i-trash" /></svg>${esc(t('form.removeMember'))}</button>`}
        </div>
        ${isCap ? `
          <div class="grid-2">
            <div class="field"><span class="label">${esc(t('form.m.name'))}</span><input class="input" value="${esc(state.team.captainName)}" readonly tabindex="-1" aria-label="${esc(t('form.captainName'))}" /></div>
            <div class="field"><span class="label">${esc(t('form.m.email'))}</span><input class="input" value="${esc(state.team.captainEmail)}" readonly tabindex="-1" aria-label="${esc(t('form.captainEmail'))}" /></div>
          </div>
          <p class="field__hint">${esc(t('form.captainFromStep1'))}</p>` : `
          <div class="grid-2">
            ${field({ id: `m${i}.name`, label: t('form.m.name'), value: m.name, autocomplete: 'off', extra: 'maxlength="100"' })}
            ${field({ id: `m${i}.email`, label: t('form.m.email'), value: m.email, type: 'email', inputmode: 'email', autocomplete: 'off' })}
          </div>`}
        <div class="grid-2">
          ${field({ id: `m${i}.age`, label: t('form.m.age'), value: m.age, type: 'number', inputmode: 'numeric', extra: 'min="16" step="1"' })}
          ${field({ id: `m${i}.role`, label: t('form.m.role'), value: m.role, required: false, placeholder: t('form.m.role.ph'), extra: 'maxlength="80"' })}
        </div>
        ${field({ id: `m${i}.org`, label: t('form.m.org'), value: m.org, required: false, extra: 'maxlength="120"' })}
      </div>`;
  }

  function step2() {
    return `
      <p class="reg__hint">${esc(t('form.members.hint'))}</p>
      ${state.members.map(memberBlock).join('')}
      <button type="button" class="btn btn--ghost add-member" data-add ${state.members.length >= MAX_MEMBERS ? 'disabled' : ''}>
        <svg aria-hidden="true"><use href="#i-plus" /></svg>${esc(t('form.addMember'))} <span class="mono add-member__count">${state.members.length}/${MAX_MEMBERS}</span>
      </button>`;
  }

  function step3() {
    const it = state.idea;
    return `
      ${field({ id: 'projectName', label: t('form.projectName'), value: it.projectName, required: false, extra: 'maxlength="100"' })}
      <div class="field">
        <label for="f-track">${esc(t('form.track'))}</label>
        <select class="input" id="f-track" name="track">
          <option value="">${esc(t('form.track.pick'))}</option>
          ${TRACKS.map((k) => `<option value="${k}" ${it.track === k ? 'selected' : ''}>${esc(t(k))}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="f-idea">${esc(t('form.idea'))} <span class="opt">(${esc(t('form.optional'))})</span></label>
        <textarea class="input" id="f-idea" name="idea" maxlength="${IDEA_MAX}" rows="5" aria-describedby="e-idea c-idea" aria-invalid="${state.errors.idea ? 'true' : 'false'}">${esc(it.idea)}</textarea>
        <p class="field__hint"><span></span><span class="mono" id="c-idea" data-counter>${it.idea.length} / ${IDEA_MAX}</span></p>
        <p class="field__err" id="e-idea">${esc(errText('idea'))}</p>
      </div>
      ${field({ id: 'link', label: t('form.link'), value: it.link, type: 'url', required: false, optional: true, inputmode: 'url', placeholder: 'https://github.com/…', autocomplete: 'url' })}`;
  }

  function step4() {
    const tm = state.team;
    const track = state.idea.track ? t(state.idea.track) : '—';
    const members = state.members.map((m, i) => esc(i === 0 ? `${tm.captainName} (${t('form.captain')})` : m.name)).join(', ');
    const check = (id, label, href) => `
      <div class="field">
        <label class="check">
          <input type="checkbox" id="f-${id}" name="${id}" ${state[id] ? 'checked' : ''} required aria-required="true" aria-invalid="${state.errors[id] ? 'true' : 'false'}" aria-describedby="e-${id}" />
          <span>${esc(label)} <span class="req" aria-hidden="true">*</span>${href && href !== '#' ? ` · <a href="${esc(href)}" target="_blank" rel="noopener noreferrer">↗</a>` : ''}</span>
        </label>
        <p class="field__err" id="e-${id}">${esc(errText(id))}</p>
      </div>`;
    return `
      <h3 class="reg__step-title">${esc(t('form.summary'))}</h3>
      <dl class="summary">
        <div class="summary__row"><dt>${esc(t('form.teamName'))}</dt><dd>${esc(tm.teamName)}</dd></div>
        <div class="summary__row"><dt>${esc(t('form.captainEmail'))}</dt><dd>${esc(tm.captainEmail)}</dd></div>
        <div class="summary__row"><dt>${esc(t('form.city'))}</dt><dd>${esc(tm.city)}</dd></div>
        <div class="summary__row"><dt>${esc(t('form.s2'))} · ${state.members.length}</dt><dd>${members}</dd></div>
        <div class="summary__row"><dt>${esc(t('form.track'))}</dt><dd>${esc(track)}</dd></div>
      </dl>
      ${check('consentData', t('form.consentData'), CONFIG.privacyUrl)}
      ${check('consentRules', t('form.consentRules'), CONFIG.rulesUrl)}
      <p class="reg__alert" role="alert">${state.sendError ? esc(t('form.errSend')) : ''}</p>`;
  }

  function successView() {
    return `
      <div class="reg__success" tabindex="-1" data-focus>
        <div class="success-drop" aria-hidden="true">
          <svg viewBox="0 0 96 116"><defs><linearGradient id="sd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9f7ff"/><stop offset="1" stop-color="#00cf60"/></linearGradient></defs>
            <path d="M48 4c18 21 34 39 34 57a34 34 0 0 1-68 0C14 43 30 25 48 4z" fill="url(#sd)"/>
            <path d="M33 62l10 10 20-22" fill="none" stroke="#062b17" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="success-drop__ring"></span>
        </div>
        <h2 id="reg-title">${esc(t('form.successTitle'))}</h2>
        <p>${esc(t('form.successText'))}</p>
        <button type="button" class="btn btn--primary btn--lg" data-reg-close>${esc(t('form.done'))}</button>
      </div>`;
  }

  function closedView() {
    return `
      <div class="reg__success">
        <h2 id="reg-title">${esc(t('form.closedTitle'))}</h2>
        <p>${esc(t('form.closedText'))}</p>
        <button type="button" class="btn btn--ghost btn--lg" data-reg-close>${esc(t('form.done'))}</button>
      </div>`;
  }

  function render({ focus } = {}) {
    if (!isRegistrationOpen() && !state.done) { body.innerHTML = closedView(); return; }
    if (state.done) {
      body.innerHTML = successView();
      body.querySelector('[data-focus]')?.focus();
      return;
    }
    const views = { 1: step1, 2: step2, 3: step3, 4: step4 };
    const isLast = state.step === 4;
    body.innerHTML = `
      <h2 class="reg__title" id="reg-title">${esc(t('form.title'))}</h2>
      <p class="reg__lead">${esc(t('form.lead'))}</p>
      ${stepsBar()}
      <p class="reg__req">${esc(t('form.required'))}</p>
      <form class="reg__step" novalidate data-form>
        <p class="sr-only" tabindex="-1" data-step-focus>${esc(`${t('form.step')} ${state.step} ${t('form.of')} 4: ${t(`form.s${state.step}`)}`)}</p>
        ${views[state.step]()}
        <div class="reg__nav">
          ${state.step > 1 ? `<button type="button" class="btn btn--ghost" data-back>${esc(t('form.back'))}</button>` : ''}
          <button type="submit" class="btn btn--primary btn--lg" ${state.submitting ? 'disabled aria-busy="true"' : ''}>
            ${state.submitting ? `<span class="spinner" aria-hidden="true"></span>${esc(t('form.sending'))}` : esc(isLast ? t('form.submit') : t('form.next'))}
          </button>
        </div>
      </form>`;
    if (focus === 'step') body.querySelector('[data-step-focus]')?.focus();
    if (focus === 'error') body.querySelector('[aria-invalid="true"]')?.focus();
  }

  // ---------- Ввод ----------
  const setValue = (name, value) => {
    const m = name.match(/^m(\d)\.(\w+)$/);
    if (m) state.members[+m[1]][m[2]] = value;
    else if (name in state.team) state.team[name] = value;
    else if (name in state.idea) state.idea[name] = value;
    else if (name === 'consentData' || name === 'consentRules') state[name] = value;
  };

  body.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.name) return;
    setValue(el.name, el.type === 'checkbox' ? el.checked : el.value);
    if (el.name === 'idea') {
      const c = body.querySelector('[data-counter]');
      if (c) c.textContent = `${el.value.length} / ${IDEA_MAX}`;
    }
    // ошибка снимается, как только поле исправлено
    if (state.errors[el.name]) {
      const errs = validateStep(state.step);
      if (!errs[el.name]) {
        delete state.errors[el.name];
        el.setAttribute('aria-invalid', 'false');
        const p = body.querySelector(`#e-${CSS.escape(el.name)}`);
        if (p) p.textContent = '';
      }
    }
  });
  body.addEventListener('change', (e) => {
    const el = e.target;
    if (el.name) setValue(el.name, el.type === 'checkbox' ? el.checked : el.value);
  });
  // проверка при уходе с поля — ошибка рядом с полем, а не только при отправке
  body.addEventListener('focusout', (e) => {
    const el = e.target;
    if (!el.name || el.type === 'checkbox' || !String(el.value).trim()) return;
    if (el.name === 'link' && el.value.trim() && !/^[a-z]+:\/\//i.test(el.value.trim()) && !url(el.value)) {
      el.value = `https://${el.value.trim()}`;
      setValue('link', el.value);
    }
    const err = validateStep(state.step)[el.name];
    if (err) {
      state.errors[el.name] = err;
      el.setAttribute('aria-invalid', 'true');
      const p = body.querySelector(`#e-${CSS.escape(el.name)}`);
      if (p) p.textContent = errText(el.name);
    }
  });

  body.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    const rm = e.target.closest('[data-remove]');
    const back = e.target.closest('[data-back]');
    if (add && state.members.length < MAX_MEMBERS) {
      state.members.push(emptyMember());
      render();
      body.querySelector(`#f-m${state.members.length - 1}\\.name`)?.focus();
    }
    if (rm) {
      const i = +rm.dataset.remove;
      if (i > 0 && state.members.length > MIN_MEMBERS) {
        state.members.splice(i, 1);
        // сдвигаем ошибки, чтобы не потерять соответствие полям
        state.errors = {};
        render();
        body.querySelector('[data-add]')?.focus();
      }
    }
    if (back) {
      state.step = Math.max(1, state.step - 1);
      state.errors = {};
      render({ focus: 'step' });
      body.closest('.reg__panel').scrollTop = 0;
    }
  });

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.submitting) return; // защита от двойного нажатия
    const errs = validateStep(state.step);
    state.errors = errs;
    if (Object.keys(errs).length) {
      render({ focus: 'error' });
      announce(t('form.errSummary'));
      return;
    }
    if (state.step < 4) {
      state.step += 1;
      render({ focus: 'step' });
      body.closest('.reg__panel').scrollTop = 0;
      return;
    }
    if (!isRegistrationOpen()) { render(); return; }
    state.submitting = true;
    state.sendError = false;
    render();
    try {
      await send(payload());
      state.done = true;
      state.submitting = false;
      render();
      announce(t('form.successTitle'));
    } catch (err) {
      console.warn('[form]', err);
      state.submitting = false;
      state.sendError = true;
      render();
    }
  });

  let submissionId = null;
  function payload() {
    submissionId = submissionId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const tm = state.team;
    return {
      submissionId,
      submittedAt: new Date().toISOString(),
      lang: document.documentElement.lang,
      team: { ...tm, teamName: tm.teamName.trim(), captainEmail: tm.captainEmail.trim().toLowerCase() },
      members: state.members.map((m, i) => ({
        captain: i === 0,
        name: (i === 0 ? tm.captainName : m.name).trim(),
        email: (i === 0 ? tm.captainEmail : m.email).trim().toLowerCase(),
        age: Number(m.age),
        org: m.org.trim(),
        role: m.role.trim(),
      })),
      idea: { ...state.idea, track: state.idea.track ? t(state.idea.track) : '' },
      consents: { personalData: state.consentData, rules: state.consentRules },
    };
  }

  async function send(data) {
    if (!CONFIG.submitEndpoint) {
      // Демо-режим: без бэкенда заявка сохраняется только в этом браузере
      await new Promise((r) => setTimeout(r, 900));
      try {
        const list = JSON.parse(localStorage.getItem('wih-applications') || '[]');
        if (!list.some((x) => x.submissionId === data.submissionId)) list.push(data);
        localStorage.setItem('wih-applications', JSON.stringify(list));
      } catch (e) { /* хранилище недоступно — не критично для демо */ }
      console.info('[form] demo mode — application stored locally', data);
      return;
    }
    // text/plain — «простой» запрос без CORS preflight (нужно для Google Apps Script)
    const res = await fetch(CONFIG.submitEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json().catch(() => ({}));
    if (json.ok === false) throw new Error(json.error || 'rejected');
  }

  // ---------- Открытие / закрытие ----------
  function open(from) {
    opener = from || document.activeElement;
    if (state.done) state = freshState();
    render({ focus: 'step' });
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    body.querySelector('input:not([readonly])')?.focus();
  }
  function close() {
    dialog.close();
  }
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = '';
    opener?.focus?.();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(); // клик по фону
    if (e.target.closest('[data-reg-close]')) close();
  });

  onLangChange(() => { if (dialog.open) render(); });

  return { open, close };
}
