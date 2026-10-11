import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createInitialState, reduceDemo } from '../state.mjs';
import { taskGuidance } from '../guidance.mjs';

const data = JSON.parse(await readFile(new URL('../data/demo.json', import.meta.url), 'utf8'));
const initial = (scenario) => ({ ...createInitialState(data), activeScenario: scenario });
function act(state, type, payload = {}) {
  const next = reduceDemo(state, { type, ...payload });
  assert.notEqual(next.notice?.tone, 'danger', next.notice?.message);
  return next;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const transfer = { recordId: 'DEMO-ROUND-0044', itemIds: ['DEMO-ROUND-0044-EQ-1'], destination: 'metering', at: '2026-09-07T14:00' };

test('六场景三角色引导只读派生，导航不承诺其他场景的初始取回数量', () => {
  for (const scene of data.scenarios) for (const role of data.roles) {
    const state = freeze({ ...initial(scene.id), activeRole: role.id });
    const before = structuredClone(state);
    const text = taskGuidance(state);
    assert.ok(text.length > 15);
    if (role.id === 'manager') assert.match(text, /管理者只读/);
    if (role.id === 'lab') assert.match(text, /检测方视角/);
    if (scene.id !== 'returns' || role.id !== 'metrology') assert.doesNotMatch(text, /从 2 变 1/);
    assert.deepEqual(state, before);
  }
});

test('取回引导随轮次、部分取回、待领取和实物全部领取变化', () => {
  let state = initial('returns');
  assert.match(taskGuidance(state), /从 2 变 1/);
  const other = act(state, 'setContext', { key: 'roundId', value: 'DEMO-ROUND-0045' });
  assert.doesNotMatch(taskGuidance(other), /从 2 变 1/);
  state = act(state, 'registerReturn', transfer);
  assert.match(taskGuidance(state), /仍有 1 台在检测方/);
  assert.match(taskGuidance(state), /另有 1 台已回计量室/);
  state = act(state, 'registerReturn', { ...transfer, itemIds: ['DEMO-ROUND-0044-EQ-2'] });
  assert.match(taskGuidance(state), /计量室仍有 2 台待领取/);
  state = act(state, 'confirmPickup', { ...transfer, itemIds: ['DEMO-ROUND-0044-EQ-1', 'DEMO-ROUND-0044-EQ-2'], receiver: data.people[0], department: data.departments[0], at: '2026-09-07T15:00' });
  assert.match(taskGuidance(state), /实物已全部领取/);
  assert.match(taskGuidance(state), /不等于整体闭环/);
});

test('周单引导区分草稿、发布、检测方建议、确认和实际到场', () => {
  let state = initial('weekly');
  assert.match(taskGuidance(state), /建立周单草稿/);
  state = act(state, 'createWeekly', { groupIds: ['DEMO-GROUP-P'] });
  assert.match(taskGuidance(state), /发布并冻结/);
  state = act(state, 'publishWeekly');
  assert.match(taskGuidance(state), /等待检测方提交建议/);
  state = act(state, 'setRole', { role: 'lab' });
  assert.match(taskGuidance(state), /可.*提交排期/);
  state = act(state, 'proposeSchedule', { groupId: 'DEMO-GROUP-P', start: '2026-09-07T09:00', end: '2026-09-07T11:00' });
  assert.match(taskGuidance(state), /待确认/);
  state = act(state, 'setRole', { role: 'metrology' });
  assert.match(taskGuidance(state), /接受或拒绝/);
  state = act(state, 'decideSchedule', { proposalId: state.weekly.proposals[0].id, decision: 'accepted' });
  assert.match(taskGuidance(state), /实际到场/);
  state = act(state, 'registerAttendance', { appointmentId: state.weekly.appointments[0].id, itemIds: [state.weekly.scopeIds[0]], at: '2026-09-07T10:00' });
  assert.match(taskGuidance(state), /已到场部分可登记实际校验结果/);
  state = act(state, 'registerAttendance', { appointmentId: state.weekly.appointments[0].id, itemIds: state.weekly.scopeIds.slice(1), at: '2026-09-07T10:30' });
  assert.match(taskGuidance(state), /登记实际校验结果/);
});

test('证书提示不把分数当检查，候选切换后依据只认当前候选', () => {
  let state = initial('certificate');
  const current = state.certificates[0];
  const payload = { certificateId: current.id, candidateId: current.targetId };
  assert.match(taskGuidance(state), /先对当前候选执行匹配检查/);
  state = act(state, 'editCertificate', { certificateId: current.id, field: 'humanConfirmed', value: true });
  assert.match(taskGuidance(state), /先对当前候选执行匹配检查/);
  state = act(state, 'checkMatch', payload);
  assert.match(taskGuidance(state), /可确认复核并推进结果/);
  state = act(state, 'selectCandidate', { ...payload, candidateId: current.candidates[1].id });
  assert.match(taskGuidance(state), /关键冲突/);
  state = act(state, 'selectCandidate', payload);
  assert.match(taskGuidance(state), /可确认复核并推进结果/);
  state = act(state, 'confirmCertificate', { ...payload, humanConfirmed: true });
  state = act(state, 'selectCertificate', { certificateId: current.id });
  assert.match(taskGuidance(state), /已确认，只读/);
});

test('仅关联、缺证、跳过与无当前对象不被提示为复核完成', () => {
  let state = initial('certificate');
  state = act(state, 'checkMatch', { certificateId: 'DEMO-CERT-002', candidateId: 'DEMO-INDEPENDENT-01' });
  state = act(state, 'confirmLink', { certificateId: 'DEMO-CERT-002', candidateId: 'DEMO-INDEPENDENT-01' });
  state = act(state, 'selectCertificate', { certificateId: 'DEMO-CERT-002' });
  assert.match(taskGuidance(state), /仅关联，复核尚未完成/);
  state = act(state, 'selectCertificate', { certificateId: 'DEMO-CERT-004' });
  assert.match(taskGuidance(state), /证据缺失.*保留输入与待办/);
  for (let count = 0; count < state.certificates.length; count++) state = act(state, 'skipCertificate', { certificateId: state.ui.certificateId });
  assert.equal(state.ui.certificateId, null);
  assert.match(taskGuidance(state), /仍有 4 份未确认/);
});

test('全部证书确认与整体闭环的提示仍分开', () => {
  const state = initial('certificate');
  state.ui.certificateId = null;
  state.certificates.forEach((value) => { value.status = 'confirmed'; });
  assert.match(taskGuidance(freeze(state)), /队列证书已全部确认/);
  assert.match(taskGuidance(state), /不单独证明整体闭环/);
});
