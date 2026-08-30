export const ACTIONS = Object.freeze({
  SET_ROLE: 'setRole',
  SET_SCENARIO: 'setScenario',
  MARK_EXCEPTION: 'markException',
  RECEIVE: 'receive',
  SEND: 'send',
  RECORD_REMINDER: 'recordReminder',
  REGISTER_RETURN: 'registerReturn',
  SELECT_CANDIDATE: 'selectCandidate',
  REVIEW_CERTIFICATE: 'reviewCertificate',
  RESET: 'reset',
});

const clone = (value) => JSON.parse(JSON.stringify(value));

export function createInitialState(data) {
  return {
    data: clone(data),
    activeRole: 'metrology',
    activeScenario: 'intake',
    intakeItems: clone(data.intake.items),
    labRecords: clone(data.lab.records),
    selectedCandidateId: data.certificate.candidates[0].id,
    certificateOutcome: null,
    events: clone(data.auditSeed),
    notice: null,
    noticeSequence: 0,
  };
}

function withNotice(state, tone, message) {
  return {
    ...state,
    noticeSequence: state.noticeSequence + 1,
    notice: {
      id: state.noticeSequence + 1,
      tone,
      message,
    },
  };
}

function appendEvent(state, type, title, detail) {
  const sequence = state.events.length;

  return {
    ...state,
    events: [
      ...state.events,
      {
        id: `EVT-${String(sequence).padStart(3, '0')}`,
        type,
        title,
        detail,
      },
    ],
  };
}

function roleScenario(role) {
  return {
    metrology: 'intake',
    lab: 'lab',
    manager: 'audit',
  }[role] ?? 'intake';
}

function scenarioRole(scenario) {
  return {
    intake: 'metrology',
    lab: 'lab',
    certificate: 'metrology',
    audit: 'manager',
  }[scenario] ?? 'metrology';
}

export function reduceDemo(state, action) {
  switch (action.type) {
    case ACTIONS.SET_ROLE: {
      const roleExists = state.data.roles.some((role) => role.id === action.role);

      if (!roleExists) {
        return withNotice(state, 'danger', '这个视角不存在，演示状态没有改变。');
      }

      return {
        ...state,
        activeRole: action.role,
        activeScenario: roleScenario(action.role),
        notice: null,
      };
    }

    case ACTIONS.SET_SCENARIO: {
      const scenarioExists = state.data.scenarios.some((scenario) => scenario.id === action.scenario);

      if (!scenarioExists) {
        return withNotice(state, 'danger', '这个业务场景不存在，演示状态没有改变。');
      }

      return {
        ...state,
        activeRole: scenarioRole(action.scenario),
        activeScenario: action.scenario,
        notice: null,
      };
    }

    case ACTIONS.MARK_EXCEPTION: {
      const item = state.intakeItems.find((candidate) => candidate.id === action.itemId);

      if (!item || ['received', 'at_lab'].includes(item.status)) {
        return withNotice(state, 'danger', '已形成接收事实的设备不能在此处改写异常状态。');
      }

      const toException = item.status !== 'exception';
      const intakeItems = state.intakeItems.map((candidate) => candidate.id === action.itemId
        ? {
            ...candidate,
            status: toException ? 'exception' : 'ready',
            issue: toException ? '现场核对异常，逐台留证' : null,
          }
        : candidate);
      const next = {
        ...state,
        intakeItems,
      };

      return withNotice(
        next,
        toException ? 'warning' : 'success',
        toException ? '已单独记录异常；其他设备仍可继续收件。' : '异常标记已撤销，设备恢复为可接收状态。',
      );
    }

    case ACTIONS.RECEIVE: {
      const readyCount = state.intakeItems.filter((item) => item.status === 'ready').length;

      if (readyCount === 0) {
        return withNotice(state, 'neutral', '没有新的可接收设备；重复操作不会新增事实。');
      }

      const next = {
        ...state,
        intakeItems: state.intakeItems.map((item) => item.status === 'ready'
          ? { ...item, status: 'received' }
          : item),
      };
      const withEvent = appendEvent(
        next,
        'intake.received',
        `已接收 ${readyCount} 台正常设备`,
        '异常设备保留原状态，没有阻断同批正常项。',
      );

      return withNotice(withEvent, 'success', `已接收 ${readyCount} 台；异常项继续等待核对。`);
    }

    case ACTIONS.SEND: {
      const receivedCount = state.intakeItems.filter((item) => item.status === 'received').length;

      if (receivedCount === 0) {
        return withNotice(state, 'neutral', '没有待送出的已接收设备；重复操作不会新增送出轮次。');
      }

      const next = {
        ...state,
        intakeItems: state.intakeItems.map((item) => item.status === 'received'
          ? { ...item, status: 'at_lab' }
          : item),
      };
      const withEvent = appendEvent(
        next,
        'submission.sent',
        `已送出 ${receivedCount} 台设备`,
        `按 ${state.data.intake.batchId} 的本次实际送出事实形成在检轮次。`,
      );

      return withNotice(withEvent, 'success', '送出事实已形成，可从检测方视角查看当前在检。');
    }

    case ACTIONS.RECORD_REMINDER: {
      const record = state.labRecords.find((candidate) => candidate.id === action.recordId);

      if (!record || record.status !== 'at_lab') {
        return withNotice(state, 'neutral', '该轮次已不在检，原提醒不会继续发送。');
      }

      if (record.days < state.data.lab.thresholdDays) {
        return withNotice(state, 'neutral', `当前在检 ${record.days} 天，尚未达到 45 天提醒阈值。`);
      }

      if (record.reminderStatus === 'unknown') {
        return withNotice(state, 'danger', '上次投递结果未知，系统已停止自动重发，等待人工核对。');
      }

      if (record.reminderStatus === 'sent') {
        return withNotice(state, 'neutral', '该轮次的 45 天提醒已经形成，重复操作被幂等保护。');
      }

      const next = {
        ...state,
        labRecords: state.labRecords.map((candidate) => candidate.id === action.recordId
          ? { ...candidate, reminderStatus: 'sent' }
          : candidate),
      };
      const withEvent = appendEvent(
        next,
        'lab.reminder_recorded',
        '已形成首次 45 天提醒',
        `${record.id} 只会形成一次相同阈值提醒。`,
      );

      return withNotice(withEvent, 'success', '提醒快照已记录；再次点击将复用现有结果。');
    }

    case ACTIONS.REGISTER_RETURN: {
      const record = state.labRecords.find((candidate) => candidate.id === action.recordId);

      if (!record || record.status === 'returned') {
        return withNotice(state, 'neutral', '该轮次已经登记回件，重复操作不会生成新事件。');
      }

      const next = {
        ...state,
        labRecords: state.labRecords.map((candidate) => candidate.id === action.recordId
          ? { ...candidate, status: 'returned' }
          : candidate),
      };
      const withEvent = appendEvent(
        next,
        'submission.returned',
        `已登记 ${record.itemCount} 台设备回件`,
        `${record.id} 已退出当前在检清单。`,
      );

      return withNotice(withEvent, 'success', '回件事实已登记，相关未发送提醒将自动失效。');
    }

    case ACTIONS.SELECT_CANDIDATE:
      return {
        ...state,
        selectedCandidateId: action.candidateId,
        certificateOutcome: null,
        notice: null,
      };

    case ACTIONS.REVIEW_CERTIFICATE: {
      const candidate = state.data.certificate.candidates.find(
        (item) => item.id === state.selectedCandidateId,
      );

      if (!candidate) {
        return withNotice(state, 'danger', '请先选择一个候选设备。');
      }

      const autoLink = candidate.score >= 70
        && candidate.uniqueBest
        && !candidate.criticalConflict;
      const outcome = autoLink ? 'auto_linked' : 'manual_required';

      if (state.certificateOutcome === outcome) {
        return withNotice(state, 'neutral', '本次复核结论已经记录，重复操作不会覆盖证据。');
      }

      const next = {
        ...state,
        certificateOutcome: outcome,
      };
      const withEvent = appendEvent(
        next,
        autoLink ? 'certificate.auto_linked' : 'certificate.manual_required',
        autoLink ? '证书已通过自动关联闸门' : '证书已转人工复核',
        autoLink
          ? `${candidate.id} 高分、无关键冲突且候选唯一。`
          : `${candidate.id} 未同时满足自动关联条件，系统没有猜测。`,
      );

      return withNotice(
        withEvent,
        autoLink ? 'success' : 'warning',
        autoLink ? '自动关联已完成，并保留评分依据。' : '已保留候选与冲突，等待人工判断。',
      );
    }

    case ACTIONS.RESET:
      return withNotice(createInitialState(state.data), 'success', '演示已重置为初始脱敏数据。');

    default:
      return state;
  }
}
