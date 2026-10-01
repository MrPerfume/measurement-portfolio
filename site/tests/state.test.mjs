import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ACTIONS, createInitialState, reduceDemo } from '../state.mjs';
import { dayNumber, progress } from '../domain/common.mjs';

const data = JSON.parse(await readFile(new URL('../data/demo.json', import.meta.url), 'utf8'));
const initial = () => createInitialState(data);
const act = (state, type, payload = {}) => reduceDemo(state, { type, ...payload });
function ok(state, type, payload = {}) {
  const next = act(state, type, payload);
  assert.notEqual(next.notice?.tone, 'danger', next.notice?.message);
  return next;
}
const item = (state, id) => state.objects.find((value) => value.id === id);
function denied(state, type, payload = {}) {
  const next = act(state, type, payload);
  assert.equal(next.notice.tone, 'danger');
  assert.deepEqual(next.objects, state.objects);
  assert.deepEqual(next.events, state.events);
  assert.deepEqual(next.weekly, state.weekly);
  assert.deepEqual(next.certificates, state.certificates);
  assert.deepEqual(next.receipts, state.receipts);
  return next;
}
function published() {
  let state = ok(initial(), 'createWeekly', { groupIds: ['DEMO-GROUP-P', 'DEMO-GROUP-T'] });
  return ok(state, 'publishWeekly');
}
function proposal(state, extra = {}) {
  state = ok(state, 'setRole', { role: 'lab' });
  return ok(state, 'proposeSchedule', { groupId: 'DEMO-GROUP-P', start: '2026-09-07T09:00', end: '2026-09-07T11:00', reason: '', ...extra });
}
function appointment() {
  let state = proposal(published());
  state = ok(state, 'setRole', { role: 'metrology' });
  return ok(state, 'decideSchedule', { proposalId: state.weekly.proposals[0].id, decision: 'accepted' });
}
function sent() {
  return ok(ok(initial(), 'receive'), 'send');
}
function match(state, id = 'DEMO-CERT-001') {
  const certificate = state.certificates.find((value) => value.id === id);
  return ok(state, 'checkMatch', { certificateId: id, candidateId: certificate.targetId });
}
const handoff = {
  recordId: 'DEMO-ROUND-0044', itemIds: ['DEMO-ROUND-0044-EQ-1'], destination: 'direct',
  receiver: '演示领取人甲', department: '演示使用部门一', at: '2026-09-07T14:00'
};

test('回归：本次送出立即增加检测方轮次，引用接收明细而非副本', () => {
  const state = sent();
  assert.equal(state.labRecords.length, data.lab.records.length + 1);
  assert.deepEqual(state.labRecords.at(-1).itemIds, ['DEMO-EQ-0001', 'DEMO-EQ-0008']);
  assert.equal(item(state, 'DEMO-EQ-0001').physical, 'at_lab');
  assert.equal(item(state, 'DEMO-TEMP-0099').physical, 'exception');
});

test('回归：复选同一候选并再次确认不重复留痕，已确认结果不清空', () => {
  let state = match(initial());
  const payload = { certificateId: 'DEMO-CERT-001', candidateId: 'DEMO-ROUND-0044-EQ-1' };
  state = ok(state, 'confirmLink', payload);
  const eventCount = state.events.length;
  state = ok(state, 'selectCandidate', payload);
  state = ok(state, 'confirmLink', payload);
  assert.equal(state.events.length, eventCount);
  assert.equal(state.certificates[0].status, 'linked');
});

test('收件与送出重复动作不新增事件，异常只影响一台', () => {
  let state = sent();
  const before = state.events.length;
  state = ok(ok(state, 'receive'), 'send');
  assert.equal(state.events.length, before);
  denied(state, 'markException', { itemId: 'DEMO-EQ-0001', exception: true });
});

test('收件前异常可解除，后续接收形成独立的新轮次', () => {
  let state = sent();
  state = ok(state, 'markException', { itemId: 'DEMO-TEMP-0099', exception: false });
  state = ok(ok(state, 'receive'), 'send');
  assert.equal(state.labRecords.length, 5);
  assert.equal(new Set(state.labRecords.flatMap((round) => round.itemIds)).size, 9);
});

test('相同操作键与规范化载荷安全重放，不同载荷拒绝', () => {
  let state = ok(initial(), 'registerReturn', { ...handoff, operationKey: 'DEMO-OP-001' });
  const before = state.events.length;
  state = ok(state, 'registerReturn', { ...handoff, operationKey: 'DEMO-OP-001' });
  assert.equal(state.events.length, before);
  denied(state, 'registerReturn', { ...handoff, destination: 'metering', operationKey: 'DEMO-OP-001' });
});

test('同一操作键重排集合仍为重放；重复成员不能作为新事实提交', () => {
  const action = { ...handoff, itemIds: ['DEMO-ROUND-0044-EQ-1', 'DEMO-ROUND-0044-EQ-2'], operationKey: 'DEMO-OP-002' };
  let state = ok(initial(), 'registerReturn', action);
  const before = state.events.length;
  state = ok(state, 'registerReturn', { ...action, itemIds: [...action.itemIds].reverse() });
  assert.equal(state.events.length, before);
  denied(initial(), 'registerReturn', { ...handoff, itemIds: [handoff.itemIds[0], handoff.itemIds[0]] });
});

test('失败后同键可修正重试，原状态无部分变更', () => {
  let state = denied(initial(), 'registerReturn', { ...handoff, receiver: '', operationKey: 'DEMO-RETRY' });
  state = ok(state, 'registerReturn', { ...handoff, operationKey: 'DEMO-RETRY' });
  assert.equal(state.receipts.length, 1);
});

test('固定参考日与44/45/66天完全一致', () => {
  assert.deepEqual(data.lab.records.map((round) => dayNumber(data.meta.referenceDate) - dayNumber(round.sentOn)), [44, 45, 66]);
  assert.throws(() => dayNumber('2026-02-30'));
});

test('44天不提醒，45天只生成一次，未知结果停发', () => {
  let state = ok(initial(), 'recordReminder', { recordId: 'DEMO-ROUND-0044' });
  assert.equal(state.events.length, 1);
  state = ok(state, 'recordReminder', { recordId: 'DEMO-ROUND-0045' });
  state = ok(state, 'recordReminder', { recordId: 'DEMO-ROUND-0045' });
  assert.equal(state.events.length, 2);
  denied(state, 'recordReminder', { recordId: 'DEMO-ROUND-0066' });
});

test('同批分次混合去向，直领不产生待领取状态', () => {
  let state = ok(initial(), 'registerReturn', { ...handoff, destination: 'metering' });
  state = ok(state, 'registerReturn', { ...handoff, itemIds: ['DEMO-ROUND-0044-EQ-2'] });
  assert.equal(item(state, handoff.itemIds[0]).physical, 'returned');
  assert.equal(item(state, 'DEMO-ROUND-0044-EQ-2').physical, 'picked_up');
  state = ok(state, 'confirmPickup', handoff);
  assert.equal(item(state, handoff.itemIds[0]).physical, 'picked_up');
  assert.equal(state.receipts.length, 3);
  const before = state.events.length;
  state = ok(state, 'recordReminder', { recordId: handoff.recordId });
  assert.equal(state.events.length, before);
});

for (const [name, patch] of Object.entries({
  '空选择': { itemIds: [] }, '跨轮次选择': { itemIds: ['DEMO-ROUND-0045-EQ-1'] },
  '未选择方式': { destination: '' }, '缺少领取人': { receiver: '' }, '缺少部门': { department: '' },
  '未来时间': { at: '2026-09-08T10:00' }, '送出前时间': { at: '2026-07-24T10:00' },
  '不存在的日期': { at: '2026-02-30T10:00' }, '非法时间': { at: '2026-09-07T25:00' }
})) test('取回边界：' + name, () => denied(initial(), 'registerReturn', { ...handoff, ...patch }));

test('未回计量室不能领取；领取时间不能早于回件', () => {
  denied(initial(), 'confirmPickup', handoff);
  const state = ok(initial(), 'registerReturn', { ...handoff, destination: 'metering' });
  denied(state, 'confirmPickup', { ...handoff, at: '2026-09-07T13:00' });
});

test('发布冻结周单范围，不生成实物或结果', () => {
  const state = published();
  assert.equal(state.weekly.scopeIds.length, 4);
  assert.equal(state.labRecords.length, 3);
  assert.equal(state.objects.filter((value) => value.track === 'onsite' && value.result).length, 0);
  denied(state, 'createWeekly', { groupIds: ['DEMO-GROUP-P'] });
});

test('未发布不能提排期；非检测方不能提建议', () => {
  denied(initial(), 'proposeSchedule', {});
  denied(act(initial(), 'setRole', { role: 'lab' }), 'proposeSchedule', { groupId: 'DEMO-GROUP-P', start: '2026-09-07T09:00', end: '2026-09-07T11:00' });
});

test('待确认或拒绝改期不覆盖正式预约', () => {
  let state = appointment();
  const current = structuredClone(state.weekly.appointments);
  state = proposal(state, { start: '2026-09-07T13:00', end: '2026-09-07T15:00', reason: '演示：协调时段' });
  assert.deepEqual(state.weekly.appointments, current);
  state = ok(state, 'setRole', { role: 'metrology' });
  state = ok(state, 'decideSchedule', { proposalId: state.weekly.proposals.at(-1).id, decision: 'rejected' });
  assert.deepEqual(state.weekly.appointments, current);
});

test('被替代的排期版本不能确认，重复建议不增版本', () => {
  let state = proposal(published());
  state = proposal(state);
  assert.equal(state.weekly.proposals.length, 1);
  state = proposal(state, { start: '2026-09-07T12:00', end: '2026-09-07T13:00' });
  state = ok(state, 'setRole', { role: 'metrology' });
  denied(state, 'decideSchedule', { proposalId: state.weekly.proposals[0].id, decision: 'accepted' });
});

test('分次到场独立留痕，重复或跨组清单整体拒绝', () => {
  let state = appointment();
  const payload = { appointmentId: state.weekly.appointments[0].id, itemIds: ['DEMO-ONSITE-P1'], at: '2026-09-07T10:00' };
  state = ok(state, 'registerAttendance', payload);
  denied(state, 'registerAttendance', payload);
  denied(state, 'registerAttendance', { ...payload, itemIds: ['DEMO-ONSITE-P2', 'DEMO-ONSITE-T1'] });
  state = ok(state, 'registerAttendance', { ...payload, itemIds: ['DEMO-ONSITE-P2'] });
  assert.equal(state.weekly.visits.length, 2);
  assert.equal(item(state, 'DEMO-ONSITE-P1').result, null);
  assert.equal(item(state, 'DEMO-ONSITE-T1').visitId, undefined);
});

test('执行必须有到场事实，证书载入必须有结果', () => {
  const state = published();
  denied(state, 'recordExecution', { source: 'weekly', sourceId: state.weekly.id, itemIds: ['DEMO-ONSITE-P1'], result: 'pass', date: '2026-09-07', humanConfirmed: true });
  denied(state, 'loadEvidence', { source: 'weekly', sourceId: state.weekly.id });
});

test('高分匹配仅给建议，关联不会推进结果或实物', () => {
  let state = match(initial(), 'DEMO-CERT-002');
  const targetId = 'DEMO-INDEPENDENT-01';
  assert.equal(item(state, targetId).result, null);
  state = ok(state, 'confirmLink', { certificateId: 'DEMO-CERT-002', candidateId: targetId });
  assert.equal(item(state, targetId).certificateConfirmed, false);
  assert.equal(item(state, targetId).result, null);
});

test('确认结果必须显式人工核对，确认后不能因候选切换而覆盖', () => {
  let state = match(initial());
  const payload = { certificateId: 'DEMO-CERT-001', candidateId: 'DEMO-ROUND-0044-EQ-1' };
  denied(state, 'confirmCertificate', payload);
  state = ok(state, 'confirmCertificate', { ...payload, humanConfirmed: true });
  const before = state.events.length;
  state = ok(state, 'confirmCertificate', { ...payload, humanConfirmed: true });
  assert.equal(state.events.length, before);
  assert.equal(item(state, payload.candidateId).physical, 'at_lab');
  state = ok(state, 'selectCandidate', { certificateId: payload.certificateId, candidateId: state.certificates[0].candidates[1].id });
  denied(state, 'confirmCertificate', { ...payload, candidateId: state.certificates[0].candidates[1].id, humanConfirmed: true });
});

test('关键冲突与缺证均阻断，失败保留输入，跳过不关闭', () => {
  for (const id of ['DEMO-CERT-003', 'DEMO-CERT-004']) {
    let state = match(initial(), id);
    state = ok(state, 'editCertificate', { certificateId: id, field: 'note', value: '演示核对备注' });
    const certificate = state.certificates.find((value) => value.id === id);
    state = denied(state, 'confirmCertificate', { certificateId: id, candidateId: certificate.targetId, humanConfirmed: true });
    assert.equal(state.certificates.find((value) => value.id === id).draft.note, '演示核对备注');
    state = ok(state, 'skipCertificate', { certificateId: id });
    assert.equal(state.certificates.find((value) => value.id === id).status, 'pending');
  }
});

test('外送整条链路：结果、证书与实物先后完成，共用对象闭环', () => {
  let state = sent();
  const round = state.labRecords.at(-1);
  state = ok(state, 'recordExecution', { source: 'round', sourceId: round.id, itemIds: round.itemIds, result: 'pass', date: '2026-09-07', humanConfirmed: true });
  state = ok(state, 'loadEvidence', { source: 'round', sourceId: round.id });
  for (const certificate of state.certificates.filter((value) => value.sourceId === round.id)) {
    state = match(state, certificate.id);
    state = ok(state, 'confirmCertificate', { certificateId: certificate.id, candidateId: certificate.targetId, humanConfirmed: true });
  }
  assert.equal(progress(round.itemIds.map((id) => item(state, id))).closed, 0);
  state = ok(state, 'registerReturn', { ...handoff, recordId: round.id, itemIds: round.itemIds });
  assert.equal(progress(round.itemIds.map((id) => item(state, id))).closed, 2);
  assert.equal(item(state, 'DEMO-EQ-0001').physical, 'picked_up');
});

test('周单整条链路：两次到场、结果、证书完成后关闭，闭环不改实物', () => {
  let state = appointment();
  for (const id of ['DEMO-ONSITE-P1', 'DEMO-ONSITE-P2']) state = ok(state, 'registerAttendance', { appointmentId: state.weekly.appointments[0].id, itemIds: [id], at: '2026-09-07T10:00' });
  state = proposal(state, { groupId: 'DEMO-GROUP-T' });
  state = ok(state, 'setRole', { role: 'metrology' });
  state = ok(state, 'decideSchedule', { proposalId: state.weekly.proposals.at(-1).id, decision: 'accepted' });
  state = ok(state, 'registerAttendance', { appointmentId: state.weekly.appointments.at(-1).id, itemIds: ['DEMO-ONSITE-T1', 'DEMO-ONSITE-T2'], at: '2026-09-07T10:30' });
  state = ok(state, 'recordExecution', { source: 'weekly', sourceId: state.weekly.id, itemIds: state.weekly.scopeIds, result: 'pass', date: '2026-09-07', humanConfirmed: true });
  state = ok(state, 'loadEvidence', { source: 'weekly', sourceId: state.weekly.id });
  for (const certificate of state.certificates.filter((value) => value.source === 'weekly')) {
    state = match(state, certificate.id);
    state = ok(state, 'confirmCertificate', { certificateId: certificate.id, candidateId: certificate.targetId, humanConfirmed: true });
  }
  assert.equal(progress(state.weekly.scopeIds.map((id) => item(state, id))).closed, 4);
  assert.equal(state.labRecords.length, 3);
  denied(state, 'proposeSchedule', {});
});

test('角色与场景切换保留对象、表单与证书输入，管理者不可写', () => {
  let state = ok(initial(), 'editForm', { form: 'returns', values: { at: '2026-09-07T12:00' } });
  state = ok(state, 'setScenario', { scenario: 'returns' });
  state = ok(state, 'setRole', { role: 'manager' });
  assert.equal(state.activeScenario, 'returns');
  assert.equal(state.ui.forms.returns.at, '2026-09-07T12:00');
  denied(state, 'registerReturn', handoff);
});

test('取回和领取草稿独立保留，成功只清本表单，切换轮次统一清除', () => {
  let state = ok(initial(), 'editForm', { form: 'returns', values: { itemIds: ['DEMO-ROUND-0044-EQ-1'] } });
  state = ok(state, 'editForm', { form: 'pickup', values: { at: '2026-09-07T15:00' } });
  const savedPickup = structuredClone(state.ui.forms.pickup);
  state = ok(state, 'registerReturn', { ...handoff, destination: 'metering' });
  assert.deepEqual(state.ui.forms.returns, {});
  assert.deepEqual(state.ui.forms.pickup, savedPickup);
  state = ok(state, 'editForm', { form: 'returns', values: { at: '2026-09-07T13:00' } });
  const failed = denied(state, 'confirmPickup', { ...handoff, receiver: '' });
  assert.deepEqual(failed.ui.forms, state.ui.forms);
  state = ok(state, 'confirmPickup', handoff);
  assert.deepEqual(state.ui.forms.pickup, {});
  assert.equal(state.ui.forms.returns.at, '2026-09-07T13:00');
  state = ok(state, 'setContext', { key: 'roundId', value: 'DEMO-ROUND-0045' });
  assert.deepEqual(state.ui.forms.returns, {});
  assert.deepEqual(state.ui.forms.pickup, {});
});

test('幂等回执不能绕过角色检查，未知标识拒绝', () => {
  let state = ok(initial(), 'receive', { operationKey: 'DEMO-RECEIVE' });
  state = ok(state, 'setRole', { role: 'manager' });
  denied(state, 'receive', { operationKey: 'DEMO-RECEIVE' });
  denied(state, 'setScenario', { scenario: 'unknown' });
  denied(state, 'selectCandidate', { certificateId: 'DEMO-CERT-001', candidateId: 'unknown' });
});

test('重置与刷新恢复完整数据；输入数据和旧状态不可变', () => {
  const original = initial();
  const snapshot = structuredClone(original);
  const after = sent();
  assert.deepEqual(original, snapshot);
  assert.deepEqual(ok(after, 'reset').objects, original.objects);
  assert.deepEqual(ok(after, 'reset').operations, {});
  assert.deepEqual(ok(after, 'reset').ui.forms, {});
  assert.equal(data.meta.version, '1.1.0');
});
