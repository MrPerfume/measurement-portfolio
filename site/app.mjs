import { ACTIONS, createInitialState, reduceDemo } from './state.mjs';
import { esc, renderers } from './views.mjs';

const data = JSON.parse(document.querySelector('#demo-data').content.textContent);
let state = createInitialState(data);
const content = document.querySelector('#scenario-content');
const notice = document.querySelector('#notice-region');
notice.tabIndex = -1;
const uiTypes = new Set(['setRole', 'setScenario', 'setContext', 'selectCertificate', 'selectCandidate', 'reset']);
const defaultScenario = state.activeScenario;
const scenarioIds = new Set(data.scenarios.map((item) => item.id));
const scenarioFromUrl = () => {
  const value = new URL(location.href).searchParams.get('scenario');
  return scenarioIds.has(value) ? value : defaultScenario;
};

// 地址只携带白名单场景；浏览历史切换视图，不保存或重放业务事实。
function writeScenarioUrl(reset = false) {
  const url = new URL(location.href);
  if (reset) url.searchParams.delete('scenario');
  else url.searchParams.set('scenario', state.activeScenario);
  url.hash = 'demo';
  if (url.href !== location.href) history.pushState(null, '', url);
}

function focusDemo() {
  reveal(document.querySelector('#demo-title'), 'start');
}

function reveal(element, block = 'nearest') {
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: 'instant', block });
}

function render(focusContent = false, context = {}) {
  const active = document.activeElement;
  const focusAction = active?.dataset.action;
  const focusPayload = active?.dataset.payload;
  document.querySelector('#role-buttons').innerHTML = state.data.roles.map((role) =>
    '<button type="button" data-action="setRole" data-payload="' + esc(JSON.stringify({ role: role.id })) + '" aria-pressed="' + (role.id === state.activeRole) + '">' + esc(role.label) + '</button>').join('');
  document.querySelector('#role-description').textContent = state.data.roles.find((role) => role.id === state.activeRole).description;
  document.querySelector('#scenario-nav').innerHTML = ['现场协同', '实物外送', '共同闭环'].map((group) =>
    '<div class="nav-group"><small>' + group + '</small>' + state.data.scenarios.filter((scenario) => scenario.group === group).map((scenario) =>
      '<button type="button" data-action="setScenario" data-payload="' + esc(JSON.stringify({ scenario: scenario.id })) + '" aria-current="' + (scenario.id === state.activeScenario ? 'page' : 'false') + '"><strong>' + esc(scenario.label) + '</strong></button>').join('') + '</div>').join('');
  const scenario = state.data.scenarios.find((item) => item.id === state.activeScenario);
  document.querySelector('#workspace-title').textContent = scenario.label;
  document.querySelector('#workspace-kicker').textContent = scenario.kicker + ' · 合成交互原型';
  document.querySelector('#event-count').textContent = state.events.length + ' 条事件';
  // 只保留一个 live region；重绘前移出，避免在旧表单内被销毁或产生重复提示。
  notice.remove();
  content.innerHTML = renderers[state.activeScenario](state);
  let feedbackKey = context.formKey;
  if (state.activeScenario === 'certificate') feedbackKey = context.reviewChanged ? 'review-start' : 'review-actions';
  const slot = feedbackKey && content.querySelector('[data-feedback="' + feedbackKey + '"]');
  if (slot) slot.append(notice);
  else content.prepend(notice);
  notice.className = state.notice ? 'feedback feedback-' + state.notice.tone : 'feedback is-empty';
  notice.textContent = state.notice?.message || '';
  document.querySelector('#demo-reference').textContent = '固定演示时刻 ' + state.data.meta.referenceDate + ' 17:00（北京时间） · 刷新恢复 · 分工模拟，非真实鉴权';
  const currentHeading = content.querySelector('.review-current h4');
  if (context.reviewChanged && currentHeading) reveal(currentHeading, 'start');
  else if (state.notice && context.actionType && !uiTypes.has(context.actionType)) reveal(notice);
  else if (focusContent) reveal(content, 'start');
  else if (focusAction) {
    const replacement = [...document.querySelectorAll('[data-action]')].find((element) => element.dataset.action === focusAction && element.dataset.payload === focusPayload && !element.disabled);
    (replacement || content).focus({ preventScroll: true });
  }
}

function dispatch(action, focus = false, formKey) {
  const certificateId = state.ui.certificateId;
  state = reduceDemo(state, action);
  render(focus, { actionType: action.type, formKey, reviewChanged: state.activeScenario === 'certificate' && (certificateId !== state.ui.certificateId || action.type === 'selectCertificate') });
  if (action.type === ACTIONS.SET_SCENARIO || action.type === 'reset') {
    writeScenarioUrl(action.type === 'reset');
    focusDemo();
  }
}

function values(form) {
  const entries = new FormData(form);
  const result = Object.fromEntries(entries);
  for (const name of ['itemIds', 'groupIds']) result[name] = entries.getAll(name);
  result.humanConfirmed = entries.has('humanConfirmed');
  return result;
}

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.dataset.certField) {
    state = reduceDemo(state, { type: ACTIONS.EDIT_CERTIFICATE, certificateId: state.ui.certificateId, field: target.dataset.certField, value: target.type === 'checkbox' ? target.checked : target.value });
  } else {
    const form = target.closest('form[data-form]');
    if (form) state = reduceDemo(state, { type: ACTIONS.EDIT_FORM, form: form.dataset.form, values: values(form) });
  }
});

document.addEventListener('change', (event) => {
  if (event.target.dataset.context) dispatch({ type: ACTIONS.SET_CONTEXT, key: 'roundId', value: event.target.value }, true);
  else if (event.target.hasAttribute('data-certificate-select') && event.target.value) dispatch({ type: ACTIONS.SELECT_CERTIFICATE, certificateId: event.target.value }, true);
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const payload = values(form);
  state = reduceDemo(state, { type: ACTIONS.EDIT_FORM, form: form.dataset.form, values: payload });
  const type = event.submitter?.value || form.dataset.type;
  // 同一份表单重试保留操作身份；失败不消费身份，成功后状态版本会更新。
  // 同页可能有多个计划组到场表单，反馈必须归属提交的预约，不落到第一个组。
  const feedbackKey = form.dataset.form === 'attendance' ? 'attendance-' + payload.appointmentId : form.dataset.form;
  dispatch({ type, ...payload, operationKey: 'DEMO-OP-' + state.revision + '-' + type }, true, feedbackKey);
});

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target || target.disabled || target.type === 'submit') return;
  const type = target.dataset.action;
  const legacyScenario = target.dataset.scenario;
  if (legacyScenario) {
    dispatch({ type: ACTIONS.SET_SCENARIO, scenario: legacyScenario }, true);
    return;
  }
  if (!type) return;
  const payload = JSON.parse(target.dataset.payload || '{}');
  if (type === 'focusTask') {
    const heading = content.querySelector('form[data-form="' + payload.form + '"] legend');
    if (heading) reveal(heading, 'start');
    return;
  }
  if (type === 'openSource') {
    if (payload.source === 'round') state = reduceDemo(state, { type: ACTIONS.SET_CONTEXT, key: 'roundId', value: payload.sourceId });
    dispatch({ type: ACTIONS.SET_SCENARIO, scenario: payload.source === 'weekly' ? 'weekly' : 'lab' }, true);
    return;
  }
  if (type === 'confirmCertificate') payload.humanConfirmed = state.certificates.find((certificate) => certificate.id === payload.certificateId)?.draft.humanConfirmed === true;
  dispatch({ type, ...payload, ...(uiTypes.has(type) ? {} : { operationKey: 'DEMO-OP-' + state.revision + '-' + type }) }, ['setScenario', 'selectCertificate', 'confirmCertificate', 'confirmLink', 'skipCertificate'].includes(type), target.closest('form[data-form]')?.dataset.form);
});

state = reduceDemo(state, { type: ACTIONS.SET_SCENARIO, scenario: scenarioFromUrl() });
render();
// 原生片段定位在加载末尾执行；等待它完成，避免覆盖直达入口的键盘焦点。
if (scenarioIds.has(new URL(location.href).searchParams.get('scenario')) && (!location.hash || location.hash === '#demo')) {
  window.addEventListener('load', () => requestAnimationFrame(focusDemo), { once: true });
}

window.addEventListener('popstate', () => {
  const scenario = scenarioFromUrl();
  if (scenario !== state.activeScenario) {
    state = reduceDemo(state, { type: ACTIONS.SET_SCENARIO, scenario });
    render();
  }
  if (location.hash === '#demo') focusDemo();
});
