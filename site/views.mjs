import { canAct } from './state.mjs';
import { dayNumber, object, progress } from './domain/common.mjs';

export const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const button = (label, type, payload = {}, enabled = true, style = 'button-secondary') =>
  '<button type="button" class="button ' + style + '" data-action="' + type + '" data-payload="' + esc(JSON.stringify(payload)) + '"' + (enabled ? '' : ' disabled') + '>' + esc(label) + '</button>';
const badge = (label, tone = 'neutral') => '<span class="badge badge-' + tone + '">' + esc(label) + '</span>';
const field = (label, name, type = 'text', value = '') =>
  '<label class="form-label"><span>' + esc(label) + '</span><input aria-label="' + esc(label) + '" name="' + name + '" type="' + type + '" value="' + esc(value) + '"></label>';
const select = (label, name, options, value = '', extra = '', allowEmpty = true) =>
  '<label class="form-label"><span>' + esc(label) + '</span><select aria-label="' + esc(label) + '" name="' + name + '" ' + extra + '><option value=""' + (value === '' ? ' selected' : '') + (allowEmpty ? '' : ' disabled') + '>请选择</option>' +
  options.map((option) => '<option value="' + esc(option.id) + '"' + (option.id === value ? ' selected' : '') + '>' + esc(option.label || option.name || option.id) + '</option>').join('') + '</select></label>';
const hidden = (name, value) => '<input type="hidden" name="' + name + '" value="' + esc(value) + '">';
const submit = (label, value = '') => '<button class="button button-primary" type="submit" value="' + value + '">' + esc(label) + '</button>';
const checked = (value) => value ? ' checked' : '';
const confirm = (name, label, value) => '<label class="confirm-line"><input type="checkbox" name="' + name + '"' + checked(value) + '><span>' + esc(label) + '</span></label>';
const choices = (items, selected = [], name = 'itemIds') => '<div class="choice-list">' + items.map((item) =>
  '<label class="choice"><input type="checkbox" name="' + name + '" value="' + esc(item.id) + '"' + checked(selected.includes(item.id)) + '><span><strong>' + esc(item.name) + '</strong><small>' + esc(item.id) + '</small></span></label>').join('') + '</div>';
const card = (title, body, extra = '') => '<section class="data-panel case-panel ' + extra + '"><h4' + (extra === 'review-current' ? ' tabindex="-1"' : '') + '>' + esc(title) + '</h4>' + body + '</section>';
const empty = (text) => '<p class="empty-state">' + esc(text) + '</p>';
const feedbackSlot = (key) => '<div data-feedback="' + key + '"></div>';
const form = (state, key, type, title, body) => '<form class="data-panel case-panel" data-form="' + key + '" data-type="' + type + '" aria-label="' + esc(title) + '" novalidate><fieldset' + (canAct(state, type) ? '' : ' disabled') + '><legend tabindex="-1">' + esc(title) + '</legend>' + body + '</fieldset></form>';
const history = (title, body) => '<details class="data-panel case-panel history-panel"><summary>' + esc(title) + '</summary>' + body + '</details>';
const status = (item) => ({ ready: '待接收', exception: '异常留证', received: '已接收', at_lab: '在检测方', returned: '已回计量室 · 待领取', picked_up: item.destination === 'direct' ? '已领取 · 检测单位直领' : '已领取 · 计量室领取' })[item.physical] || '现场校验';
const physicalRows = (items) => '<div class="object-list">' + items.map((item) => '<div class="object-row" data-object-id="' + esc(item.id) + '"><div><strong>' + esc(item.name) + '</strong><small>' + esc(item.id) + '</small></div>' + badge(status(item), item.physical === 'exception' ? 'warning' : 'neutral') + '<small>' + (item.result ? '结果：' + (item.result.value === 'pass' ? '合格' : '不合格') : '结果待登记') + ' · ' + (item.certificateConfirmed ? '证书已确认' : '证书待复核') + '</small></div>').join('') + '</div>';
const metrics = (entries) => '<div class="metric-row metric-row-four">' + entries.map(([label, value, note]) => '<article><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(note || '') + '</small></article>').join('') + '</div>';
const rule = (title, body) => '<div class="rule-callout"><span class="rule-index">规则</span><div><strong>' + esc(title) + '</strong><p>' + esc(body) + '</p></div></div>';
const roleHint = (state) => state.activeRole === 'metrology' ? '' : '<div class="role-hint"><span>确认与登记由计量管理员完成。当前视角保留对象和已填写内容。</span>' + button('切换计量管理员', 'setRole', { role: 'metrology' }) + '</div>';

function evidenceControls(state, source, sourceId) {
  return '<div class="inline-actions">' +
    button('载入合成证书', 'loadEvidence', { source, sourceId }, canAct(state, 'loadEvidence')) +
    button('进入连续复核', 'setScenario', { scenario: 'certificate' }) + '</div>';
}

function executionForm(state, source, sourceId, items) {
  const candidates = items.filter((item) => !item.result && (item.track !== 'onsite' || item.visitId));
  if (!candidates.length) return '';
  const saved = state.ui.forms.execution || {};
  const values = saved.sourceId === sourceId ? saved : {};
  return form(state, 'execution', 'recordExecution', '登记实际校验结果',
    hidden('source', source) + hidden('sourceId', sourceId) +
    choices(candidates, values.itemIds || []) + '<div class="form-grid">' +
    field('实际校验日期', 'date', 'date', values.date ?? state.data.meta.referenceDate) +
    select('校验结论', 'result', [{ id: 'pass', label: '合格' }, { id: 'fail', label: '不合格' }], values.result) + '</div>' +
    confirm('humanConfirmed', '我确认所选设备已实际完成校验（合成演示事实）', values.humanConfirmed) +
    feedbackSlot('execution') + submit('确认登记结果'));
}

export function renderIntake(state) {
  const items = state.objects.filter((item) => item.source === 'intake');
  return metrics([['本次实物', items.length], ['待接收', items.filter((item) => item.physical === 'ready').length], ['逐台异常', items.filter((item) => item.physical === 'exception').length], ['已形成送出', items.filter((item) => item.roundId).length]]) +
    rule('同一份明细，贯通收件与在检', '正常设备继续接收；每次送出形成新轮次，后续取回不会回退已发生的送出事实。') +
    roleHint(state) + card('现场接收清单', physicalRows(items) +
    '<div class="inline-actions">' + items.filter((item) => ['ready', 'exception'].includes(item.physical)).map((item) => button((item.physical === 'exception' ? '解除异常：' : '标记异常：') + item.name, 'markException', { itemId: item.id, exception: item.physical !== 'exception' }, canAct(state, 'markException'), 'text-button')).join('') + '</div>' +
    '<div class="inline-actions">' +
    button('接收正常设备', 'receive', {}, canAct(state, 'receive') && items.some((item) => item.physical === 'ready'), 'button-primary') +
    button('形成送出轮次', 'send', {}, canAct(state, 'send') && items.some((item) => item.physical === 'received')) +
    button('查看在检轮次', 'setScenario', { scenario: 'lab' }) + '</div>');
}

export function renderLab(state) {
  const rounds = state.labRecords;
  const atLab = rounds.filter((round) => round.itemIds.some((id) => object(state, id).physical === 'at_lab'));
  const current = rounds.find((round) => round.id === state.ui.roundId);
  const items = current.itemIds.map((id) => object(state, id));
  return metrics([['当前在检轮次', atLab.length], ['当前在检设备', state.objects.filter((item) => item.physical === 'at_lab').length], ['首次提醒阈值', '45 天'], ['结果未知', atLab.filter((round) => round.reminderStatus === 'unknown').length]]) +
    rule('44 天不提醒，45 天首次提醒，未知结果停发', '天数依据固定演示日期计算；全部取走后，该轮次不再触发未发送提醒。') +
    '<div class="round-grid">' + rounds.map((round) => {
      const remaining = round.itemIds.filter((id) => object(state, id).physical === 'at_lab').length;
      const days = dayNumber(state.data.meta.referenceDate) - dayNumber(round.sentOn);
      return '<article class="round-card' + (round.id === current.id ? ' is-selected' : '') + '" data-round-id="' + esc(round.id) + '"><div><strong>' + days + '<small> 天</small></strong>' + badge(remaining ? '在检 ' + remaining + ' 台' : '已全部取走', remaining ? 'neutral' : 'success') + '</div><h4>' + esc(round.id) + '</h4><p>' + esc(round.lab) + '<br>' + esc(round.sentOn) + ' 送出 · 共 ' + round.itemIds.length + ' 台</p><p>' + esc(({ unknown: '结果未知 · 停止重发', sent: '首次提醒已记录', due: '首次提醒待记录', not_due: '尚未达到阈值' })[round.reminderStatus]) + '</p><div class="inline-actions">' +
        button('查看此轮次', 'setContext', { key: 'roundId', value: round.id }) +
        button('记录提醒', 'recordReminder', { recordId: round.id }, canAct(state, 'recordReminder') && remaining > 0) + '</div></article>';
    }).join('') + '</div>' +
    card('当前轮次 · ' + current.id, physicalRows(items) + '<div class="inline-actions">' + button('登记取回或领取', 'setScenario', { scenario: 'returns' }) + '</div>' + evidenceControls(state, 'round', current.id)) +
    roleHint(state) + executionForm(state, 'round', current.id, items);
}

export function renderReturns(state) {
  const round = state.labRecords.find((value) => value.id === state.ui.roundId);
  const items = round.itemIds.map((id) => object(state, id));
  const values = state.ui.forms.returns || {};
  const pickup = state.ui.forms.pickup || {};
  const atLab = items.filter((item) => item.physical === 'at_lab');
  const atRoom = items.filter((item) => item.physical === 'returned');
  const receipts = state.receipts.filter((receipt) => receipt.roundId === round.id);
  const p = progress(items);
  return select('当前送出轮次', 'roundId', state.labRecords.map((value) => ({ id: value.id, label: value.id })), round.id, 'data-context="roundId"') +
    '<div class="compact-metrics">' + metrics([['在检测方', atLab.length], ['计量室待领取', atRoom.length], ['部门已领取', items.filter((item) => item.physical === 'picked_up').length], ['整体闭环', p.closed + ' / ' + p.total]]) + '</div>' + roleHint(state) +
    (atLab.length && atRoom.length ? '<nav class="inline-actions" aria-label="交接任务">' + button('登记取回 · ' + atLab.length + ' 台', 'focusTask', { form: 'returns' }) + button('确认领取 · ' + atRoom.length + ' 台', 'focusTask', { form: 'pickup' }) + '</nav>' : '') +
    '<div class="transfer-tasks">' + (atLab.length ? form(state, 'returns', 'registerReturn', '登记交接',
      '<p class="task-hint">取回 · ' + atLab.length + ' 台仍在检测方。只勾选本次实际交接的设备。</p>' +
      hidden('recordId', round.id) + choices(atLab, values.itemIds || []) +
      '<div class="form-grid">' + select('交接方式', 'destination', [{ id: 'metering', label: '取回计量室 · 待领取' }, { id: 'direct', label: '使用部门在检测单位直领' }], values.destination) +
      field('实际交接时间（北京时间）', 'at', 'datetime-local', values.at ?? state.data.meta.referenceDate + 'T14:00') +
      select('实际领取人（直领或领取必选）', 'receiver', state.data.people.map((value) => ({ id: value })), values.receiver) +
      select('使用部门（直领或领取必选）', 'department', state.data.departments.map((value) => ({ id: value })), values.department) + '</div>' +
      feedbackSlot('returns') + submit('登记取回')) : '') +
    (atRoom.length ? form(state, 'pickup', 'confirmPickup', '确认计量室领取',
      '<p class="task-hint">领取 · ' + atRoom.length + ' 台已回计量室。无需再选取回方式。</p>' +
      hidden('recordId', round.id) + choices(atRoom, pickup.itemIds || []) +
      field('实际领取时间（北京时间）', 'at', 'datetime-local', pickup.at ?? state.data.meta.referenceDate + 'T14:00') +
      '<div class="form-grid">' + select('实际领取人（直领或领取必选）', 'receiver', state.data.people.map((value) => ({ id: value })), pickup.receiver) +
      select('使用部门（直领或领取必选）', 'department', state.data.departments.map((value) => ({ id: value })), pickup.department) + '</div>' +
      feedbackSlot('pickup') + submit('确认计量室领取')) : '') + '</div>' +
    (!atLab.length && !atRoom.length ? empty('本轮实物已全部领取。仍需核对校验结果和证书，才能完成整体闭环。') : '') +
    rule('选择实际去向，不补造中间交接', '部门直领直接形成领取事实；计量室路线必须另行确认领取。两种方式都不改变证书与结果。') +
    card('所选轮次设备', physicalRows(items)) +
    history('本轮交接记录 · ' + receipts.length + ' 次', receipts.length ? receipts.map((receipt) => '<p><strong>' + esc(receipt.id) + '</strong> · ' + receipt.itemIds.length + ' 台 · ' + esc(({ metering: '取回计量室', direct: '检测单位直领', pickup: '计量室领取' })[receipt.destination]) + '<br><small>' + esc(receipt.at.replace('T', ' ')) + ' ' + esc(receipt.receiver || '') + ' ' + esc(receipt.department || '') + '</small></p>').join('') : empty('暂无交接记录，选择设备与去向后登记。')) +
    '<div class="inline-actions">' + button('返回在检跟进', 'setScenario', { scenario: 'lab' }) + '</div>' + evidenceControls(state, 'round', round.id);
}

export function renderWeekly(state) {
  const week = state.weekly;
  const items = week.scopeIds.map((id) => object(state, id));
  const p = progress(items);
  const closed = week.published && p.total > 0 && p.closed === p.total;
  const groups = state.data.weekly.groups.filter((group) => week.groupIds.includes(group.id));
  const draft = state.ui.forms.weekly || {};
  const proposal = state.ui.forms.proposal || {};
  const attendance = state.ui.forms.attendance || {};
  const boundary = rule('报送、预约、到场、结果与证书分别计数', '这一分支是现场校验，不创建收件、送出或领取记录。只有结果与证书都确认，周单才闭环。');
  let html = '<div class="task-summary"><h4>周单 · ' + esc(week.id) + '</h4>' + badge(closed ? '已闭环 · 只读' : week.published ? '已发布 · 范围冻结' : week.created ? '草稿待发布' : '尚未建立') + '<p>' + esc(state.data.weekly.lab) + ' · 报送周 ' + esc(state.data.weekly.week) + '</p>' + (week.published ? '<p>正式预约 ' + week.appointments.length + ' / ' + groups.length + ' 组 · 到场记录 ' + week.visits.length + ' 次。预约不等于到场。</p>' : '<p>从 ' + state.data.weekly.groups.length + ' 个预置计划组开始；发布后冻结范围。</p>') + '</div>';
  if (!week.published) {
    return html + roleHint(state) + form(state, 'weekly', 'createWeekly', '从计划组建立周单',
      choices(state.data.weekly.groups, draft.groupIds || week.groupIds, 'groupIds') +
      feedbackSlot('weekly') + '<div class="inline-actions">' + submit(week.created ? '更新草稿范围' : '建立周单草稿') + button('发布并冻结范围', 'publishWeekly', {}, canAct(state, 'publishWeekly') && week.created) + '</div>') + boundary;
  }
  const proposalRow = (value) => '<div class="proposal"><strong>' + esc(groups.find((group) => group.id === value.groupId).name) + ' · v' + value.version + '</strong> ' + badge(({ pending: '待确认', accepted: '已接受', rejected: '已拒绝', superseded: '已替代' })[value.status]) + '<p>' + esc(value.start.replace('T', ' ')) + ' — ' + esc(value.end.slice(11)) + '</p><p>' + esc(value.reason) + '</p><small>' + esc(value.id) + '</small>' + (value.status === 'pending' && !closed ? '<p class="task-hint">接受前，原有正式预约继续有效。</p><div class="inline-actions">' + button('接受此建议', 'decideSchedule', { proposalId: value.id, decision: 'accepted' }, canAct(state, 'decideSchedule'), 'button-primary') + button('拒绝此建议', 'decideSchedule', { proposalId: value.id, decision: 'rejected' }, canAct(state, 'decideSchedule')) + '</div>' : '') + '</div>';
  const pending = week.proposals.filter((value) => value.status === 'pending');
  const past = week.proposals.filter((value) => value.status !== 'pending');
  if (pending.length) html += card('待确认排期建议 · ' + pending.length + ' 条', pending.map(proposalRow).join(''), 'pending-proposals');
  if (!closed) {
    const availableGroups = groups.filter((group) => items.some((item) => item.groupId === group.id && !item.visitId));
    if (availableGroups.length && state.activeRole === 'lab') html += form(state, 'proposal', 'proposeSchedule', '提出排期或改期建议',
        select('计划组', 'groupId', availableGroups, proposal.groupId) + '<div class="form-grid">' +
        field('建议开始（北京时间）', 'start', 'datetime-local', proposal.start ?? state.data.meta.referenceDate + 'T09:00') +
        field('建议结束（北京时间）', 'end', 'datetime-local', proposal.end ?? state.data.meta.referenceDate + 'T11:00') + '</div>' +
        field('改期原因（已有预约时必填）', 'reason', 'text', proposal.reason) + feedbackSlot('proposal') + submit('提交排期建议'));
    for (const appointment of state.activeRole === 'metrology' ? week.appointments : []) {
      const candidates = items.filter((item) => item.groupId === appointment.groupId && !item.visitId);
      if (!candidates.length) continue;
      const saved = attendance.appointmentId === appointment.id ? attendance : {};
      html += form(state, 'attendance', 'registerAttendance', '核对实际到场 · ' + groups.find((group) => group.id === appointment.groupId).name,
        '<p class="task-hint">正式预约 ' + esc(appointment.start.replace('T', ' ')) + ' — ' + esc(appointment.end.slice(11)) + ' · 尚有 ' + candidates.length + ' 台未到场</p>' +
        hidden('appointmentId', appointment.id) + choices(candidates, saved.itemIds || []) +
        field('实际到场时间（北京时间）', 'at', 'datetime-local', saved.at ?? state.data.meta.referenceDate + 'T10:00') + feedbackSlot('attendance-' + appointment.id) + submit('确认本次到场'));
    }
    if (state.activeRole === 'metrology') html += executionForm(state, 'weekly', week.id, items);
    if (p.executed) html += evidenceControls(state, 'weekly', week.id);
    if (state.activeRole !== 'metrology') html += roleHint(state);
    if (availableGroups.length && state.activeRole !== 'lab') html += '<div class="role-hint"><span>排期或改期由检测方提出，已确认预约继续有效。</span>' + button('切换检测方提交建议', 'setRole', { role: 'lab' }) + '</div>';
  }
  html += '<div class="compact-metrics">' + metrics([['冻结参考范围', p.total], ['已核对到场', items.filter((item) => item.visitId).length], ['结果已登记', p.executed], ['证书已确认', p.certified]]) + '</div>';
  html += card('正式预约', week.appointments.length ? week.appointments.map((appointment) => '<div class="appointment"><strong>' + esc(groups.find((group) => group.id === appointment.groupId).name) + '</strong><p>' + esc(appointment.start.replace('T', ' ')) + ' — ' + esc(appointment.end.slice(11)) + '</p><small>' + esc(appointment.id) + '</small></div>').join('') : empty('暂无正式预约。检测方先提交建议，管理员再确认。'));
  html += card('逐台事实与到场记录', '<div class="object-list">' + items.map((item) => '<div class="object-row"><div><strong>' + esc(item.name) + '</strong><small>' + esc(item.visitId || '尚未核对到场') + '</small></div>' + badge(item.result ? '结果已登记' : '结果待登记') + badge(item.certificateConfirmed ? '证书已确认' : '证书待复核') + '</div>').join('') + '</div>');
  return html + history('已处理排期版本 · ' + past.length + ' 条', past.length ? past.map(proposalRow).join('') : empty('暂无已处理版本。待确认建议始终显示在工作区前面。')) + boundary;
}

export function renderCertificate(state) {
  const selected = state.certificates.find((certificate) => certificate.id === state.ui.certificateId);
  const pending = state.certificates.filter((certificate) => certificate.status !== 'confirmed');
  const certificateStatus = (certificate) => certificate.status === 'confirmed' ? '已确认' : certificate.status === 'linked' ? '仅关联' : certificate.skipped ? '已跳过' : '待复核';
  const switcher = '<div class="review-toolbar">' + select('当前证书 · 可切换查看', 'certificateId', state.certificates.map((certificate) => ({ id: certificate.id, label: certificate.id + ' · ' + certificateStatus(certificate) })), selected?.id, 'data-certificate-select', false) + '<p>' + pending.length + ' 份未确认 / ' + state.certificates.length + ' 份材料 · 跳过仍保留待办</p></div>';
  const queue = card('证书处理队列', '<p>' + pending.length + ' 份未确认 · ' + state.certificates.filter((certificate) => certificate.status === 'confirmed').length + ' 份已确认</p><div class="certificate-queue">' +
    state.certificates.map((certificate) => '<button type="button" data-action="selectCertificate" data-payload="' + esc(JSON.stringify({ certificateId: certificate.id })) + '" aria-pressed="' + (certificate.id === selected?.id) + '"><span><strong>' + esc(certificate.id) + '</strong><small>' + esc(certificate.name) + '</small></span>' + badge(certificate.status === 'confirmed' ? '已确认' : certificate.status === 'linked' ? '仅关联' : certificate.skipped ? '已跳过' : '待复核', certificate.status === 'confirmed' ? 'success' : 'neutral') + '</button>').join('') + '</div>');
  let detail;
  if (!selected) detail = card('本轮队列已处理完', feedbackSlot('review-start') + empty('已跳过或仅关联的证书仍未关闭。从上方选择证书可继续核对；刷新会恢复初始演示。'), 'review-current');
  else {
    const candidate = selected.candidates.find((value) => value.id === selected.draft.candidateId);
    const payload = { certificateId: selected.id, candidateId: candidate.id };
    const editable = canAct(state, 'confirmCertificate') && selected.status !== 'confirmed';
    detail = card('复核工作区 · ' + selected.id,
      feedbackSlot('review-start') + '<p class="task-hint">' + esc(selected.name) + ' · ' + certificateStatus(selected) + '</p>' +
      '<div class="certificate-summary"><div><span>校验日期</span><strong>' + esc(selected.calibrationDate) + '</strong></div><div><span>证书结论</span><strong>' + (selected.result === 'pass' ? '合格' : '不合格') + '</strong></div><div><span>来源</span><strong>' + esc(({ weekly: '周报检', round: '实物外送', independent: '独立归档' })[selected.source]) + '</strong></div><div><span>证据状态</span><strong>' + (selected.evidenceComplete ? '合成证据齐备' : '证据缺失') + '</strong></div></div>' +
      '<p class="muted">仅展示合成结构化材料，不加载真实 PDF。高分不能代替人工确认。</p>' +
      '<div class="candidate-list">' + selected.candidates.map((value) => '<button type="button" data-action="selectCandidate" data-payload="' + esc(JSON.stringify({ certificateId: selected.id, candidateId: value.id })) + '" aria-pressed="' + (candidate.id === value.id) + '"><span class="score score-' + (value.criticalConflict ? 'low' : 'high') + '">' + value.score + '</span><span><strong>' + esc(value.name) + '</strong><small>' + esc(value.id) + '</small></span></button>').join('') + '</div>' +
      '<div class="reason-grid"><div><strong>匹配依据</strong><ul>' + candidate.reasons.map((value) => '<li>' + esc(value) + '</li>').join('') + '</ul></div><div><strong>冲突与缺口</strong><ul>' + [...candidate.conflicts, ...(!selected.evidenceComplete ? ['证书材料不完整'] : [])].map((value) => '<li>' + esc(value) + '</li>').join('') + '</ul>' + (!candidate.conflicts.length && selected.evidenceComplete ? '<p>没有关键冲突</p>' : '') + '</div></div>' +
      (selected.assessment?.candidateId === candidate.id ? '<p class="match-result">' + badge(selected.assessment.passed ? '匹配检查通过 · 等待人工确认' : '检查未通过 · 保留待办', selected.assessment.passed ? 'success' : 'warning') + '</p>' : '') +
      (selected.status !== 'pending' ? '<p class="outcome outcome-success">已保存：' + (selected.status === 'confirmed' ? '人工复核确认' : '仅确认关联，结果尚未确认') + '。候选切换不会覆盖此事实。</p>' : '') +
      '<label class="form-label"><span>复核备注（仅保存在本页）</span><textarea data-cert-field="note" rows="2"' + (editable ? '' : ' disabled') + '>' + esc(selected.draft.note) + '</textarea></label>' +
      '<label class="confirm-line"><input type="checkbox" data-cert-field="humanConfirmed"' + checked(selected.draft.humanConfirmed) + (editable ? '' : ' disabled') + '><span>我已人工核对日期、结论与证据（合成演示）</span></label>' +
      '<p class="action-context">当前处理：' + esc(selected.id) + '</p>' + feedbackSlot('review-actions') +
      '<div class="inline-actions review-actions">' + button('执行匹配检查', 'checkMatch', payload, editable) +
      button('仅确认关联', 'confirmLink', payload, editable) +
      button('确认复核并推进结果', 'confirmCertificate', payload, editable, 'button-primary') +
      button('跳过，保留待办', 'skipCertificate', { certificateId: selected.id }, canAct(state, 'skipCertificate') && selected.status !== 'confirmed') + '</div>' +
      (selected.source !== 'independent' ? '<div class="inline-actions">' + button('返回来源' + (selected.source === 'weekly' ? '周单' : '轮次'), 'openSource', { source: selected.source, sourceId: selected.sourceId }) + '</div>' : ''), 'review-current');
  }
  return switcher + roleHint(state) + '<div class="review-layout">' + detail + queue + '</div>' + rule('检查、关联、确认是三个不同的动作', '成功后进入下一份；失败保留输入，跳过不关闭待办。证书确认不等于实物已经领取。');
}

export function renderAudit(state) {
  const weeklyItems = state.weekly.scopeIds.map((id) => object(state, id));
  const groups = [
    ['现场周单', progress(weeklyItems)],
    ['实物外送', progress(state.objects.filter((item) => item.track === 'external' && item.roundId))],
    ['独立归档', progress(state.objects.filter((item) => item.track === 'independent'))]
  ];
  return rule('每种闭环都有自己的完成条件', '现场看结果与证书，外送还要看实际领取；分数、预约或一次点击都不能代替事实。') +
    '<div class="round-grid">' + groups.map(([name, value]) => card(name, '<p>范围 ' + value.total + ' · 结果 ' + value.executed + ' · 证书 ' + value.certified + '</p><strong>整体闭环 ' + value.closed + ' / ' + value.total + '</strong>')).join('') + '</div>' +
    card('可追溯事件 · ' + state.events.length + ' 条', '<ol class="event-list">' + state.events.map((entry) => '<li><span>' + esc(entry.id) + '</span><div><strong>' + esc(entry.title) + '</strong><p>' + esc(entry.detail) + '</p><small>' + esc(entry.objectId) + '</small></div></li>').join('') + '</ol>');
}

export const renderers = { weekly: renderWeekly, intake: renderIntake, lab: renderLab, returns: renderReturns, certificate: renderCertificate, audit: renderAudit };
