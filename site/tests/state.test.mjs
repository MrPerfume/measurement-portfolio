import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ACTIONS, createInitialState, reduceDemo } from '../state.mjs';

const data = JSON.parse(await readFile(new URL('../data/demo.json', import.meta.url), 'utf8'));

test('异常设备单独留证，正常设备继续接收和送出', () => {
  let state = createInitialState(data);

  state = reduceDemo(state, { type: ACTIONS.RECEIVE });
  assert.equal(state.intakeItems.filter((item) => item.status === 'received').length, 2);
  assert.equal(state.intakeItems.filter((item) => item.status === 'exception').length, 1);

  state = reduceDemo(state, { type: ACTIONS.SEND });
  assert.equal(state.intakeItems.filter((item) => item.status === 'at_lab').length, 2);
  assert.equal(state.events.filter((event) => event.type === 'submission.sent').length, 1);
});

test('重复收件和送出不会重复生成业务事件', () => {
  let state = createInitialState(data);

  state = reduceDemo(state, { type: ACTIONS.RECEIVE });
  state = reduceDemo(state, { type: ACTIONS.RECEIVE });
  state = reduceDemo(state, { type: ACTIONS.SEND });
  state = reduceDemo(state, { type: ACTIONS.SEND });

  assert.equal(state.events.filter((event) => event.type === 'intake.received').length, 1);
  assert.equal(state.events.filter((event) => event.type === 'submission.sent').length, 1);
});

test('44 天不提醒，45 天只形成一次提醒', () => {
  let state = createInitialState(data);

  state = reduceDemo(state, { type: ACTIONS.RECORD_REMINDER, recordId: 'DEMO-ROUND-0044' });
  assert.equal(state.events.filter((event) => event.type === 'lab.reminder_recorded').length, 0);

  state = reduceDemo(state, { type: ACTIONS.RECORD_REMINDER, recordId: 'DEMO-ROUND-0045' });
  state = reduceDemo(state, { type: ACTIONS.RECORD_REMINDER, recordId: 'DEMO-ROUND-0045' });
  assert.equal(state.events.filter((event) => event.type === 'lab.reminder_recorded').length, 1);
});

test('投递结果未知时禁止自动重发', () => {
  let state = createInitialState(data);

  state = reduceDemo(state, { type: ACTIONS.RECORD_REMINDER, recordId: 'DEMO-ROUND-0066' });

  assert.match(state.notice.message, /停止自动重发/);
  assert.equal(state.events.filter((event) => event.type === 'lab.reminder_recorded').length, 0);
});

test('回件后设备退出当前在检清单', () => {
  let state = createInitialState(data);

  state = reduceDemo(state, { type: ACTIONS.REGISTER_RETURN, recordId: 'DEMO-ROUND-0045' });

  assert.equal(
    state.labRecords.find((record) => record.id === 'DEMO-ROUND-0045').status,
    'returned',
  );
  assert.equal(state.events.filter((event) => event.type === 'submission.returned').length, 1);
});

test('关键冲突或非唯一候选必须转人工复核', () => {
  let state = createInitialState(data);

  state = reduceDemo(state, {
    type: ACTIONS.SELECT_CANDIDATE,
    candidateId: 'DEMO-EQ-0008',
  });
  state = reduceDemo(state, { type: ACTIONS.REVIEW_CERTIFICATE });

  assert.equal(state.certificateOutcome, 'manual_required');
  assert.equal(state.events.at(-1).type, 'certificate.manual_required');
});

test('高分、无关键冲突且唯一候选允许自动关联', () => {
  let state = createInitialState(data);

  state = reduceDemo(state, { type: ACTIONS.REVIEW_CERTIFICATE });

  assert.equal(state.certificateOutcome, 'auto_linked');
  assert.equal(state.events.at(-1).type, 'certificate.auto_linked');
});

test('场景切换会对齐最适合的观察角色', () => {
  let state = createInitialState(data);

  state = reduceDemo(state, { type: ACTIONS.SET_SCENARIO, scenario: 'lab' });
  assert.equal(state.activeRole, 'lab');

  state = reduceDemo(state, { type: ACTIONS.SET_SCENARIO, scenario: 'certificate' });
  assert.equal(state.activeRole, 'metrology');

  state = reduceDemo(state, { type: ACTIONS.SET_SCENARIO, scenario: 'audit' });
  assert.equal(state.activeRole, 'manager');
});

test('重置恢复初始数据并保留明确反馈', () => {
  let state = createInitialState(data);
  state = reduceDemo(state, { type: ACTIONS.RECEIVE });
  state = reduceDemo(state, { type: ACTIONS.RESET });

  assert.equal(state.intakeItems.filter((item) => item.status === 'ready').length, 2);
  assert.equal(state.events.length, 1);
  assert.match(state.notice.message, /已重置/);
});
