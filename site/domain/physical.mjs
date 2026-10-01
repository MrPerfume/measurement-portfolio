import { actualTime, dayNumber, event, ids, object, requireRule } from './common.mjs';

export function physicalAction(state, action) {
  const intake = state.objects.filter((item) => item.source === 'intake');
  switch (action.type) {
    case 'markException': {
      const item = object(state, action.itemId);
      requireRule(item.source === 'intake' && ['ready', 'exception'].includes(item.physical), '已经接收的设备不能改写接收前异常。');
      requireRule(typeof action.exception === 'boolean', '异常状态无效。');
      item.physical = action.exception ? 'exception' : 'ready';
      return '异常只影响对应设备，其他设备仍可接收。';
    }
    case 'receive': {
      const ready = intake.filter((item) => item.physical === 'ready');
      if (!ready.length) return '没有新的可接收设备；重复操作不会新增事实。';
      ready.forEach((item) => { item.physical = 'received'; });
      event(state, 'intake.received', state.data.intake.batchId, '已接收 ' + ready.length + ' 台正常设备', '异常项继续独立留证。');
      return '接收成功。现在可以形成送出轮次。';
    }
    case 'send': {
      const received = intake.filter((item) => item.physical === 'received');
      if (!received.length) return '没有待送出设备，未新增轮次。';
      const id = 'DEMO-ROUND-NEW-' + state.nextRound++;
      received.forEach((item) => { item.physical = 'at_lab'; item.roundId = id; });
      state.labRecords.push({ id, lab: state.data.intake.lab, sentOn: state.data.meta.referenceDate, itemIds: received.map((item) => item.id), reminderStatus: 'not_due' });
      event(state, 'submission.sent', id, '已送出 ' + received.length + ' 台设备', '新轮次与接收清单引用同一份实物明细。');
      state.ui.roundId = id;
      return '送出成功。在检跟进与取回页面已同步本轮次。';
    }
    case 'recordReminder': {
      const round = state.labRecords.find((item) => item.id === action.recordId);
      requireRule(round, '轮次不存在。');
      if (!round.itemIds.some((id) => object(state, id).physical === 'at_lab')) return '设备均已取走，未发送提醒已失效。';
      const days = dayNumber(state.data.meta.referenceDate) - dayNumber(round.sentOn);
      requireRule(round.reminderStatus !== 'unknown', '上次投递结果未知，停止自动重发，等待人工核对。');
      if (days < state.data.lab.thresholdDays) return '尚未达到 45 天阈值，不生成提醒。';
      if (round.reminderStatus === 'sent') return '该轮次已记录提醒，不重复生成。';
      round.reminderStatus = 'sent';
      event(state, 'lab.reminder_recorded', round.id, '已记录首次 45 天提醒', '只记录演示快照，不发送真实消息。');
      return '提醒快照已记录。';
    }
    case 'registerReturn':
    case 'confirmPickup': {
      const selected = ids(action.itemIds);
      const round = state.labRecords.find((item) => item.id === action.recordId);
      requireRule(round && selected.every((id) => round.itemIds.includes(id)), '选择超出了当前送出轮次。');
      const items = selected.map((id) => object(state, id));
      const pickup = action.type === 'confirmPickup';
      if (pickup) requireRule(items.every((item) => item.physical === 'returned'), '只能领取已经取回计量室的设备。');
      else {
        requireRule(['metering', 'direct'].includes(action.destination), '请明确选择交接方式。');
        requireRule(items.every((item) => item.physical === 'at_lab'), '所选设备不全在检测方，请重新选择。');
      }
      const direct = action.destination === 'direct';
      if (direct || pickup) requireRule(state.data.people.includes(action.receiver) && state.data.departments.includes(action.department), '请选择合成领取人与使用部门。');
      const earliest = pickup ? items.map((item) => item.returnedAt + ':00+08:00').sort().at(-1) : round.sentOn + 'T00:00:00+08:00';
      actualTime(state, action.at, earliest);
      items.forEach((item) => {
        item.physical = pickup || direct ? 'picked_up' : 'returned';
        if (!pickup) { item.destination = action.destination; item.returnedAt = action.at; }
        if (pickup || direct) { item.receiver = action.receiver; item.department = action.department; }
      });
      const receipt = { id: 'DEMO-RECEIPT-' + state.receipts.length, roundId: round.id, itemIds: selected, destination: pickup ? 'pickup' : action.destination, at: action.at, receiver: action.receiver || null, department: action.department || null };
      state.receipts.push(receipt);
      event(state, pickup ? 'submission.picked_up' : 'submission.returned', round.id,
        selected.length + ' 台 · ' + (pickup ? '计量室领取完成' : direct ? '检测单位直领完成' : '已回计量室，待领取'),
        '交接记录 ' + receipt.id + '；未选择设备保持原状，不改变校验结果或证书。');
      // 两项交接可同时准备；一项成功不能清掉另一项尚未提交的草稿。
      state.ui.forms[pickup ? 'pickup' : 'returns'] = {};
      return '交接已登记，所有视图已按明细同步。';
    }
    default: throw new Error('未知实物动作。');
  }
}
