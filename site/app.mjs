import { ACTIONS, createInitialState, reduceDemo } from './state.mjs';

const dataNode = document.querySelector('#demo-data');
const demoData = JSON.parse(dataNode.content.textContent.trim());
let state = createInitialState(demoData);

const roleButtons = document.querySelector('#role-buttons');
const roleDescription = document.querySelector('#role-description');
const scenarioNav = document.querySelector('#scenario-nav');
const workspaceKicker = document.querySelector('#workspace-kicker');
const workspaceTitle = document.querySelector('#workspace-title');
const scenarioContent = document.querySelector('#scenario-content');
const eventCount = document.querySelector('#event-count');
const noticeRegion = document.querySelector('#notice-region');

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const statusMeta = {
  ready: ['待接收', 'neutral'],
  exception: ['异常留证', 'danger'],
  received: ['已接收', 'success'],
  at_lab: ['在检测方', 'info'],
  returned: ['已回件', 'success'],
};

const reminderMeta = {
  not_due: ['未到阈值', 'neutral'],
  due: ['首次待提醒', 'warning'],
  sent: ['提醒已记录', 'success'],
  unknown: ['结果未知', 'danger'],
};

function badge(label, tone = 'neutral') {
  return `<span class="badge badge-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function currentScenario() {
  return state.data.scenarios.find((scenario) => scenario.id === state.activeScenario);
}

function renderRoles() {
  roleButtons.innerHTML = state.data.roles.map((role) => `
    <button type="button" data-role="${escapeHtml(role.id)}" aria-pressed="${role.id === state.activeRole}">
      ${escapeHtml(role.label)}
    </button>
  `).join('');

  const role = state.data.roles.find((item) => item.id === state.activeRole);
  roleDescription.textContent = role.description;
}

function renderScenarioNav() {
  scenarioNav.innerHTML = state.data.scenarios.map((scenario, index) => `
    <button type="button" data-scenario="${escapeHtml(scenario.id)}" aria-current="${scenario.id === state.activeScenario ? 'page' : 'false'}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <span><strong>${escapeHtml(scenario.label)}</strong><small>${escapeHtml(scenario.kicker)}</small></span>
    </button>
  `).join('');

  document.querySelectorAll('.calibration-rail [data-scenario]').forEach((button) => {
    button.dataset.active = String(button.dataset.scenario === state.activeScenario);
  });
}

function renderIntake() {
  const statusCounts = state.intakeItems.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
  const canReceive = (statusCounts.ready ?? 0) > 0;
  const canSend = (statusCounts.received ?? 0) > 0;

  return `
    <div class="metric-row metric-row-four">
      <article><span>本次实物</span><strong>${state.intakeItems.length}</strong><small>${escapeHtml(state.data.intake.batchId)}</small></article>
      <article><span>可直接接收</span><strong>${statusCounts.ready ?? 0}</strong><small>身份与状态可确认</small></article>
      <article class="metric-warning"><span>逐台异常</span><strong>${statusCounts.exception ?? 0}</strong><small>只阻断对应设备</small></article>
      <article><span>已经送出</span><strong>${statusCounts.at_lab ?? 0}</strong><small>按实际轮次形成事实</small></article>
    </div>
    <div class="rule-callout">
      <span class="rule-index">R01</span>
      <div><strong>以实物交接作为流程起点</strong><p>未命中台账时保留临时身份，不猜测编号；异常只影响对应设备。</p></div>
    </div>
    <div class="data-panel">
      <div class="panel-heading">
        <div><span>计划外设备</span><h4>现场接收清单</h4></div>
        <span>${escapeHtml(state.data.intake.lab)}</span>
      </div>
      <div class="responsive-table">
        <table>
          <thead><tr><th>设备</th><th>身份</th><th>当前状态</th><th>现场判断</th><th>操作</th></tr></thead>
          <tbody>
            ${state.intakeItems.map((item) => {
              const [label, tone] = statusMeta[item.status];
              const locked = ['received', 'at_lab'].includes(item.status);
              return `
                <tr>
                  <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></td>
                  <td><code>${escapeHtml(item.id)}</code><small>${escapeHtml(item.factoryNumber)}</small></td>
                  <td>${badge(label, tone)}</td>
                  <td>${item.issue ? `<span class="issue-text">${escapeHtml(item.issue)}</span>` : '<span class="muted">身份可确认</span>'}</td>
                  <td><button class="table-action" type="button" data-action="markException" data-item-id="${escapeHtml(item.id)}" ${locked ? 'disabled' : ''}>${item.status === 'exception' ? '恢复正常' : '标记异常'}</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="panel-actions">
        <p><strong>同批正常项继续，异常项单独留证。</strong><span>重复操作不会制造第二次收件或送出事实。</span></p>
        <div>
          <button class="button button-secondary" type="button" data-action="receive" ${canReceive ? '' : 'disabled'}>接收正常设备</button>
          <button class="button button-primary" type="button" data-action="send" ${canSend ? '' : 'disabled'}>形成送出轮次</button>
        </div>
      </div>
    </div>
  `;
}

function renderLab() {
  const records = state.labRecords;
  const atLab = records.filter((record) => record.status === 'at_lab');
  const threshold = state.data.lab.thresholdDays;

  return `
    <div class="metric-row metric-row-four">
      <article><span>当前在检轮次</span><strong>${atLab.length}</strong><small>只统计可证明送出事实</small></article>
      <article><span>首次提醒阈值</span><strong>${threshold}<i>天</i></strong><small>不继承内部看板参数</small></article>
      <article class="metric-warning"><span>达到阈值</span><strong>${atLab.filter((record) => record.days >= threshold).length}</strong><small>逐轮次独立判断</small></article>
      <article class="metric-danger"><span>结果未知</span><strong>${atLab.filter((record) => record.reminderStatus === 'unknown').length}</strong><small>停止自动重发</small></article>
    </div>
    <div class="threshold-track" aria-label="45 天提醒边界示例">
      <div><span>44 天</span><strong>不提醒</strong></div>
      <div class="threshold-marker"><span>45 天</span><strong>首次形成提醒</strong></div>
      <div><span>66 天</span><strong>结果未知则停发</strong></div>
    </div>
    <div class="data-panel">
      <div class="panel-heading">
        <div><span>检测方当前在检</span><h4>按实际送出轮次汇总</h4></div>
        <span>对外仅显示白名单字段</span>
      </div>
      <div class="lab-list">
        ${records.map((record) => {
          const [reminderLabel, reminderTone] = reminderMeta[record.reminderStatus];
          const returned = record.status === 'returned';
          return `
            <article class="lab-row ${returned ? 'is-returned' : ''}">
              <div class="day-gauge"><strong>${record.days}</strong><span>天</span></div>
              <div><span class="row-label">${escapeHtml(record.lab)}</span><h5>${escapeHtml(record.id)}</h5><p>${escapeHtml(record.sentOn)} 送出 · ${record.itemCount} 台设备</p></div>
              <div class="lab-status">${returned ? badge('已回件', 'success') : badge(reminderLabel, reminderTone)}<small>${returned ? '已退出当前在检' : record.days < threshold ? '尚未达到阈值' : '按本轮次独立处理'}</small></div>
              <div class="row-actions">
                <button class="table-action" type="button" data-action="recordReminder" data-record-id="${escapeHtml(record.id)}" ${returned ? 'disabled' : ''}>记录提醒</button>
                <button class="table-action" type="button" data-action="registerReturn" data-record-id="${escapeHtml(record.id)}" ${returned ? 'disabled' : ''}>登记回件</button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCertificate() {
  const certificate = state.data.certificate;
  const selected = certificate.candidates.find((candidate) => candidate.id === state.selectedCandidateId);
  const outcomeText = {
    auto_linked: ['已自动关联', '高分、无关键冲突且候选唯一。', 'success'],
    manual_required: ['已转人工复核', '系统保留候选与冲突，没有猜测关联。', 'warning'],
  }[state.certificateOutcome];

  return `
    <div class="certificate-summary">
      <div><span>证书编号</span><strong>${escapeHtml(certificate.number)}</strong></div>
      <div><span>设备名称</span><strong>${escapeHtml(certificate.instrumentName)}</strong></div>
      <div><span>规格</span><strong>${escapeHtml(certificate.specification)}</strong></div>
      <div><span>校验日期</span><strong>${escapeHtml(certificate.calibrationDate)}</strong></div>
    </div>
    <div class="rule-callout">
      <span class="rule-index">R03</span>
      <div><strong>分数只负责排序，冲突决定能否自动关联</strong><p>自动关联必须同时满足：至少 70 分、没有关键冲突、最高分候选唯一。</p></div>
    </div>
    <div class="candidate-layout">
      <div class="candidate-list" aria-label="证书候选设备">
        ${certificate.candidates.map((candidate) => `
          <button type="button" aria-pressed="${candidate.id === state.selectedCandidateId}" data-action="selectCandidate" data-candidate-id="${escapeHtml(candidate.id)}">
            <span class="score score-${escapeHtml(candidate.level)}">${candidate.score}</span>
            <span><strong>${escapeHtml(candidate.id)}</strong><small>${candidate.criticalConflict ? '存在关键冲突' : candidate.uniqueBest ? '当前唯一最高分' : '需要更多证据'}</small></span>
            <span aria-hidden="true">→</span>
          </button>
        `).join('')}
      </div>
      <div class="candidate-detail">
        <div class="candidate-head">
          <div><span>当前候选</span><h4>${escapeHtml(selected.id)}</h4></div>
          ${badge(`${selected.score} 分`, selected.criticalConflict ? 'danger' : selected.level === 'high' ? 'success' : 'neutral')}
        </div>
        <div class="reason-grid">
          <div><span>匹配依据</span><ul>${selected.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul></div>
          <div><span>冲突与缺口</span>${selected.conflicts.length > 0 ? `<ul class="conflict-list">${selected.conflicts.map((conflict) => `<li>${escapeHtml(conflict)}</li>`).join('')}</ul>` : '<p class="empty-evidence">没有关键冲突</p>'}</div>
        </div>
        ${outcomeText ? `<div class="outcome outcome-${outcomeText[2]}"><strong>${outcomeText[0]}</strong><span>${outcomeText[1]}</span></div>` : ''}
        <button class="button button-primary full-button" type="button" data-action="reviewCertificate">${selected.score >= 70 && selected.uniqueBest && !selected.criticalConflict ? '执行自动关联闸门' : '提交人工复核结论'}</button>
      </div>
    </div>
  `;
}

function renderAudit() {
  const events = [...state.events].reverse();
  const typeLabel = {
    'demo.ready': '系统准备',
    'intake.received': '实物接收',
    'submission.sent': '送检送出',
    'lab.reminder_recorded': '到期跟进',
    'submission.returned': '实物回件',
    'certificate.auto_linked': '证书关联',
    'certificate.manual_required': '人工复核',
  };

  return `
    <div class="audit-overview">
      <div><span>当前事件</span><strong>${events.length}</strong><small>重复操作不重复留痕</small></div>
      <div><span>事实来源</span><strong>4</strong><small>收件、在检、证书、治理</small></div>
      <div><span>数据范围</span><strong>DEMO</strong><small>浏览器内存中的合成数据</small></div>
    </div>
    <div class="audit-timeline">
      ${events.map((event, index) => `
        <article>
          <div class="timeline-marker"><span>${events.length - index}</span></div>
          <div class="timeline-card">
            <div><span>${escapeHtml(typeLabel[event.type] ?? '业务事件')}</span><code>${escapeHtml(event.id)}</code></div>
            <h4>${escapeHtml(event.title)}</h4>
            <p>${escapeHtml(event.detail)}</p>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderNotice() {
  if (!state.notice) {
    noticeRegion.hidden = true;
    noticeRegion.removeAttribute('data-tone');
    return;
  }

  noticeRegion.textContent = state.notice.message;
  noticeRegion.dataset.tone = state.notice.tone;
  noticeRegion.hidden = false;
}

function render() {
  const scenario = currentScenario();
  renderRoles();
  renderScenarioNav();
  workspaceKicker.textContent = scenario.kicker;
  workspaceTitle.textContent = scenario.label;
  eventCount.textContent = `${state.events.length} 条事件`;

  scenarioContent.innerHTML = {
    intake: renderIntake,
    lab: renderLab,
    certificate: renderCertificate,
    audit: renderAudit,
  }[state.activeScenario]();

  renderNotice();
}

function dispatch(action, options = {}) {
  const previousScenario = state.activeScenario;
  state = reduceDemo(state, action);
  render();

  if (options.focusContent || previousScenario !== state.activeScenario) {
    scenarioContent.focus({ preventScroll: true });
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');

  if (!target || target.disabled) {
    return;
  }

  if (target.dataset.role) {
    dispatch({ type: ACTIONS.SET_ROLE, role: target.dataset.role }, { focusContent: true });
    return;
  }

  if (target.dataset.scenario) {
    dispatch({ type: ACTIONS.SET_SCENARIO, scenario: target.dataset.scenario }, { focusContent: true });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const keyboardTriggered = event.detail === 0;
    document.querySelector('#demo').scrollIntoView({
      behavior: reducedMotion || keyboardTriggered ? 'auto' : 'smooth',
      block: 'start',
    });
    return;
  }

  const action = target.dataset.action;

  if (!action) {
    return;
  }

  const payload = {
    type: action,
    itemId: target.dataset.itemId,
    recordId: target.dataset.recordId,
    candidateId: target.dataset.candidateId,
  };

  dispatch(payload);
});

render();
