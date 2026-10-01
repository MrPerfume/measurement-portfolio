import { canonical, clone, requireRule } from './domain/common.mjs';
import { physicalAction } from './domain/physical.mjs';
import { weeklyAction } from './domain/weekly.mjs';
import { certificateAction, makeCertificate } from './domain/certificates.mjs';

export const ACTIONS = Object.freeze({
  SET_ROLE: 'setRole', SET_SCENARIO: 'setScenario', SET_CONTEXT: 'setContext',
  EDIT_FORM: 'editForm', SELECT_CERTIFICATE: 'selectCertificate', SELECT_CANDIDATE: 'selectCandidate',
  EDIT_CERTIFICATE: 'editCertificate', RESET: 'reset',
  MARK_EXCEPTION: 'markException', RECEIVE: 'receive', SEND: 'send', RECORD_REMINDER: 'recordReminder',
  REGISTER_RETURN: 'registerReturn', CONFIRM_PICKUP: 'confirmPickup',
  CREATE_WEEKLY: 'createWeekly', PUBLISH_WEEKLY: 'publishWeekly', PROPOSE_SCHEDULE: 'proposeSchedule',
  DECIDE_SCHEDULE: 'decideSchedule', REGISTER_ATTENDANCE: 'registerAttendance',
  RECORD_EXECUTION: 'recordExecution', LOAD_EVIDENCE: 'loadEvidence', CHECK_MATCH: 'checkMatch',
  CONFIRM_LINK: 'confirmLink', CONFIRM_CERTIFICATE: 'confirmCertificate', SKIP_CERTIFICATE: 'skipCertificate'
});

const physicalTypes = ['markException', 'receive', 'send', 'recordReminder', 'registerReturn', 'confirmPickup'];
const weeklyTypes = ['createWeekly', 'publishWeekly', 'proposeSchedule', 'decideSchedule', 'registerAttendance'];
const certificateTypes = ['recordExecution', 'loadEvidence', 'checkMatch', 'confirmLink', 'confirmCertificate', 'skipCertificate'];
export const SCENARIO_IDS = ['weekly', 'intake', 'lab', 'returns', 'certificate', 'audit'];

export function createInitialState(data) {
  const state = {
    data: clone(data), activeRole: 'metrology', activeScenario: 'intake',
    objects: [], labRecords: [], receipts: [], certificates: [],
    weekly: { id: data.weekly.id, created: false, published: false, groupIds: [], scopeIds: [], proposals: [], appointments: [], visits: [] },
    events: clone(data.auditSeed), operations: {}, revision: 0, nextRound: 1, nextCertificate: 1,
    notice: null, ui: { roundId: data.lab.records[0].id, certificateId: null, forms: {} }
  };
  for (const item of data.intake.items) state.objects.push({ ...clone(item), physical: item.status, track: 'external', source: 'intake', result: null, certificateConfirmed: false });
  for (const record of data.lab.records) {
    const itemIds = [];
    for (let index = 1; index <= record.itemCount; index++) {
      const id = record.id + '-EQ-' + index;
      itemIds.push(id);
      state.objects.push({ id, name: '演示在检仪表 ' + index, factoryNumber: id, track: 'external', source: 'seed', roundId: record.id, physical: 'at_lab', result: { value: 'pass', date: '2026-08-24' }, certificateConfirmed: false });
    }
    state.labRecords.push({ ...clone(record), itemIds });
  }
  for (const group of data.weekly.groups) {
    for (const item of group.items) state.objects.push({ ...clone(item), groupId: group.id, track: 'onsite', source: 'weekly', physical: null, result: null, certificateConfirmed: false });
  }
  state.objects.push({ id: 'DEMO-INDEPENDENT-01', name: '独立归档温度计', track: 'independent', physical: null, result: null, certificateConfirmed: false });
  state.certificates = data.certificateSamples.map((sample) => makeCertificate(state, sample.id, sample.targetId, sample.kind));
  state.ui.certificateId = state.certificates[0].id;
  return state;
}

function notice(state, tone, message) {
  return { ...state, notice: { tone, message } };
}

export function canAct(state, type) {
  if (state.activeRole === 'manager') return false;
  if (type === 'proposeSchedule') return state.activeRole === 'lab';
  if (type === 'recordReminder') return ['lab', 'metrology'].includes(state.activeRole);
  return state.activeRole === 'metrology';
}

// 所有业务转换先在副本中执行；任一步失败时丢弃副本，保留原始事实和用户输入。
// 操作键先验证身份分工，再匹配规范化载荷；幂等回执不会绕过角色守卫。
export function reduceDemo(state, action) {
  try {
    if (action.type === ACTIONS.RESET) return notice(createInitialState(state.data), 'success', '演示已重置为初始合成数据。');
    if (action.type === ACTIONS.SET_ROLE) {
      requireRule(state.data.roles.some((role) => role.id === action.role), '角色不存在。');
      return { ...state, activeRole: action.role, notice: null };
    }
    if (action.type === ACTIONS.SET_SCENARIO) {
      requireRule(SCENARIO_IDS.includes(action.scenario), '场景不存在。');
      return { ...state, activeScenario: action.scenario, notice: null };
    }
    const next = clone(state);
    if (action.type === ACTIONS.SET_CONTEXT) {
      requireRule(action.key === 'roundId' && state.labRecords.some((record) => record.id === action.value), '轮次不存在。');
      next.ui.roundId = action.value;
      next.ui.forms.returns = {};
      next.ui.forms.pickup = {};
      next.ui.forms.execution = {};
      return { ...next, notice: null };
    }
    if (action.type === ACTIONS.EDIT_FORM) {
      requireRule(['weekly', 'proposal', 'attendance', 'execution', 'returns', 'pickup'].includes(action.form), '表单不存在。');
      next.ui.forms[action.form] = clone(action.values);
      return next;
    }
    if ([ACTIONS.SELECT_CERTIFICATE, ACTIONS.SELECT_CANDIDATE, ACTIONS.EDIT_CERTIFICATE].includes(action.type)) {
      const certificate = next.certificates.find((item) => item.id === action.certificateId);
      requireRule(certificate, '证书不存在。');
      if (action.type === ACTIONS.SELECT_CERTIFICATE) {
        next.ui.certificateId = certificate.id;
        certificate.skipped = false;
      } else if (action.type === ACTIONS.SELECT_CANDIDATE) {
        requireRule(certificate.candidates.some((candidate) => candidate.id === action.candidateId), '候选不存在。');
        certificate.draft.candidateId = action.candidateId;
      } else {
        requireRule(['note', 'humanConfirmed'].includes(action.field), '复核字段无效。');
        certificate.draft[action.field] = action.value;
      }
      return { ...next, notice: null };
    }
    requireRule([...physicalTypes, ...weeklyTypes, ...certificateTypes].includes(action.type), '动作不存在。');
    requireRule(canAct(state, action.type), '当前角色不能执行此动作；请切换相应分工视角。');
    const payload = { ...action };
    delete payload.operationKey;
    for (const key of ['itemIds', 'groupIds']) if (Array.isArray(payload[key])) payload[key] = [...payload[key]].sort();
    const fingerprint = JSON.stringify(canonical(payload));
    const key = action.operationKey;
    if (key !== undefined) {
      requireRule(typeof key === 'string' && key.trim().length > 0 && key.length < 200, '操作标识无效。');
      if (Object.hasOwn(state.operations, key)) {
        requireRule(state.operations[key] === fingerprint, '同一操作标识对应不同载荷，已拒绝执行。');
        return notice(state, 'neutral', '已复用此前操作结果，没有重复留痕。');
      }
    }
    const handler = physicalTypes.includes(action.type) ? physicalAction : weeklyTypes.includes(action.type) ? weeklyAction : certificateAction;
    const message = handler(next, action);
    if (key !== undefined) Object.defineProperty(next.operations, key, { value: fingerprint, enumerable: true, writable: true, configurable: true });
    next.revision += 1;
    return notice(next, 'success', message);
  } catch (error) {
    return notice(state, 'danger', error.message);
  }
}
