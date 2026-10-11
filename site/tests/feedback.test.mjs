import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createInitialState, reduceDemo } from '../state.mjs';
import { transferSummary } from '../feedback.mjs';

const data = JSON.parse(await readFile(new URL('../data/demo.json', import.meta.url), 'utf8'));
const initial = () => createInitialState(data);
const handoff = { type: 'registerReturn', recordId: 'DEMO-ROUND-0044', itemIds: ['DEMO-ROUND-0044-EQ-1'], destination: 'metering', at: data.meta.referenceDate + 'T14:00', operationKey: 'summary-test-1' };

test('交接摘要按本轮真实前后明细区分取回、直领与领取，不改状态', () => {
  let before = initial();
  let after = reduceDemo(before, handoff);
  const original = structuredClone([before, after]);
  let summary = transferSummary(before, after, handoff);
  assert.match(summary.message, /本次取回计量室 1 台；本轮在检数量 2 → 1 台，计量室待领取 1 台/);
  assert.equal(summary.eventId, after.events.at(-1).id);
  assert.equal(summary.receiptId, after.receipts.at(-1).id);
  assert.deepEqual([before, after], original);
  before = after;
  const direct = { ...handoff, itemIds: ['DEMO-ROUND-0044-EQ-2'], destination: 'direct', receiver: data.people[0], department: data.departments[0], operationKey: 'summary-test-2' };
  after = reduceDemo(before, direct);
  summary = transferSummary(before, after, direct);
  assert.match(summary.message, /本次部门直领 1 台；本轮在检数量 1 → 0 台，计量室待领取 1 台，部门已领取 1 台/);
  before = after;
  const pickup = { ...handoff, type: 'confirmPickup', receiver: data.people[1], department: data.departments[1], operationKey: 'summary-test-3' };
  after = reduceDemo(before, pickup);
  assert.match(transferSummary(before, after, pickup).message, /本次计量室领取 1 台；本轮在检数量保持 0 台，计量室待领取 0 台，部门已领取 2 台/);
});

test('全部取回及不同轮次数量不写死初始 2→1', () => {
  const before = initial();
  for (const record of before.labRecords) {
    const action = { ...handoff, recordId: record.id, itemIds: record.itemIds };
    const after = reduceDemo(before, action);
    const summary = transferSummary(before, after, action);
    assert.ok(summary);
    assert.ok(summary.message.includes('本轮在检数量 ' + record.itemIds.length + ' → 0 台'));
    assert.ok(summary.message.includes('计量室待领取 ' + record.itemIds.length + ' 台'));
  }
});

test('空选择、缺资料、非法时间、角色拒绝及幂等重放不生成新成功摘要', () => {
  const before = initial();
  for (const invalid of [
    { ...handoff, itemIds: [] },
    { ...handoff, destination: 'direct' },
    { ...handoff, at: data.meta.referenceDate + 'T18:00' },
    { ...handoff, itemIds: [...handoff.itemIds, ...handoff.itemIds] }
  ]) assert.equal(transferSummary(before, reduceDemo(before, invalid), invalid), null);
  const manager = reduceDemo(before, { type: 'setRole', role: 'manager' });
  assert.equal(transferSummary(manager, reduceDemo(manager, handoff), handoff), null);
  const after = reduceDemo(before, handoff);
  const replay = reduceDemo(after, handoff);
  assert.equal(replay.notice.tone, 'neutral');
  assert.equal(transferSummary(after, replay, handoff), null);
  const conflict = { ...handoff, itemIds: ['DEMO-ROUND-0044-EQ-2'] };
  assert.equal(transferSummary(after, reduceDemo(after, conflict), conflict), null);
});

test('新送出轮次可派生摘要，缺少可核实事件时不伪造审计入口', () => {
  const before = reduceDemo(reduceDemo(initial(), { type: 'receive' }), { type: 'send' });
  const round = before.labRecords.at(-1);
  const action = { ...handoff, recordId: round.id, itemIds: [round.itemIds[0]] };
  const after = reduceDemo(before, action);
  const summary = transferSummary(before, after, action);
  assert.equal(summary.roundId, round.id);
  assert.ok(summary.message.includes('本轮在检数量 2 → 1 台'));
  const missingEvent = structuredClone(after);
  missingEvent.events.pop();
  assert.equal(transferSummary(before, missingEvent, action).eventId, null);
  assert.equal(transferSummary(before, after, { type: 'setScenario', scenario: 'audit' }), null);
});
