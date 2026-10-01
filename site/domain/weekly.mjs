import { actualTime, dateAt, event, ids, object, progress, requireRule } from './common.mjs';

// 周单只保存报送与预约事实；执行、证书和实物仍分别属于明细，不能互相补造。
export function weeklyAction(state, action) {
  const week = state.weekly;
  const data = state.data.weekly;
  if (week.published) requireRule(progress(week.scopeIds.map((id) => object(state, id))).closed !== week.scopeIds.length, '周单已闭环，只能查看。');
  switch (action.type) {
    case 'createWeekly': {
      requireRule(!week.published, '发布范围已冻结，不能修改。');
      const groups = ids(action.groupIds);
      requireRule(groups.every((id) => data.groups.some((group) => group.id === id)), '计划组不存在。');
      const scope = data.groups.filter((group) => groups.includes(group.id)).flatMap((group) => group.items.map((item) => item.id));
      if (JSON.stringify(week.scopeIds) === JSON.stringify(scope)) return '草稿范围未变。';
      week.created = true;
      week.groupIds = groups;
      week.scopeIds = scope;
      event(state, 'weekly.draft', week.id, '周单草稿已建立', scope.length + ' 台参考设备；未登记执行或发送消息。');
      return '草稿已建立，可以发布并冻结范围。';
    }
    case 'publishWeekly': {
      requireRule(week.created, '请先从计划组建立草稿。');
      if (week.published) return '周单已发布，未重复发布。';
      week.published = true;
      event(state, 'weekly.published', week.id, '周单范围已冻结', week.scopeIds.length + ' 台；排期与结果尚未形成。');
      return '周单已发布。切换检测方可以提出排期建议。';
    }
    case 'proposeSchedule': {
      requireRule(week.published && week.groupIds.includes(action.groupId), '请选择已发布周单内的计划组。');
      requireRule(week.scopeIds.some((id) => object(state, id).groupId === action.groupId && !object(state, id).visitId), '该组已全部到场，不再改写预约。');
      requireRule(dateAt(action.end) > dateAt(action.start), '结束时刻必须晚于开始时刻。');
      const current = week.appointments.find((item) => item.groupId === action.groupId);
      requireRule(!current || (typeof action.reason === 'string' && action.reason.trim().length > 0), '改期建议必须填写原因。');
      const previous = week.proposals.filter((item) => item.groupId === action.groupId);
      const identical = previous.find((item) => item.status === 'pending' && item.start === action.start && item.end === action.end && item.reason === (action.reason || ''));
      if (identical) return '相同排期建议已待确认，未重复创建。';
      previous.filter((item) => item.status === 'pending').forEach((item) => { item.status = 'superseded'; });
      const proposal = { id: 'DEMO-PROPOSAL-' + (week.proposals.length + 1), groupId: action.groupId, version: previous.length + 1, start: action.start, end: action.end, reason: action.reason || '', status: 'pending' };
      week.proposals.push(proposal);
      event(state, 'weekly.proposed', week.id, '新增排期建议 v' + proposal.version, proposal.id + '；管理员接受前原预约继续有效。');
      return '建议已提交，切换计量管理员确认。';
    }
    case 'decideSchedule': {
      const proposal = week.proposals.find((item) => item.id === action.proposalId);
      requireRule(proposal && proposal.status === 'pending', '建议已处理或已被新版本替代，请查看最新建议。');
      requireRule(['accepted', 'rejected'].includes(action.decision), '审核决定无效。');
      if (action.decision === 'accepted') {
        requireRule(week.scopeIds.some((id) => object(state, id).groupId === proposal.groupId && !object(state, id).visitId), '该组已全部到场，不能替换预约。');
        week.appointments = week.appointments.filter((item) => item.groupId !== proposal.groupId);
        week.appointments.push({ ...proposal });
      }
      proposal.status = action.decision;
      event(state, 'weekly.decided', week.id, action.decision === 'accepted' ? '排期建议已接受' : '排期建议已拒绝', proposal.id + '；已有到场事实保持不变。');
      return action.decision === 'accepted' ? '正式预约已更新。' : '已拒绝建议，原正式预约保持有效。';
    }
    case 'registerAttendance': {
      const selected = ids(action.itemIds);
      const appointment = week.appointments.find((item) => item.id === action.appointmentId);
      requireRule(appointment, '正式预约不存在或已被替代。');
      requireRule(selected.every((id) => week.scopeIds.includes(id) && object(state, id).groupId === appointment.groupId), '实际清单超出预约计划组。');
      const items = selected.map((id) => object(state, id));
      requireRule(items.every((item) => !item.visitId), '所选设备已被到场安排占用，未新增受理。');
      actualTime(state, action.at, appointment.start + ':00+08:00');
      const visit = { id: 'DEMO-VISIT-' + (week.visits.length + 1), appointmentId: appointment.id, at: action.at, itemIds: selected };
      week.visits.push(visit);
      items.forEach((item) => { item.visitId = visit.id; item.attendedAt = action.at; });
      event(state, 'weekly.attended', week.id, '分次到场核对 ' + selected.length + ' 台', visit.id + '；未到场设备仍留在原周单。');
      state.ui.forms.attendance = {};
      return '本次到场已核对，尚未登记执行结果。';
    }
    default: throw new Error('未知周单动作。');
  }
}
