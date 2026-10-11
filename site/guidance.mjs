import { object, progress } from './domain/common.mjs';

const readOnly = {
  weekly: '查看周单范围、正式预约、到场和结果进度；预约不等于已经执行。',
  intake: '查看接收清单、异常与送出事实；接收和送出由计量管理员登记。',
  lab: '查看在检轮次、剩余数量与提醒状态；结果未知的提醒停止重发。',
  returns: '查看当前轮次的取回、待领取与已领取数量，以及交接记录；登记由计量管理员完成。',
  certificate: '查看当前证书的匹配依据、冲突与复核状态；匹配建议不替代管理员人工确认。',
  audit: '查看审计事实和各分支闭环条件；页面导航不会新增业务事实。'
};

function weeklyGuidance(state) {
  const week = state.weekly;
  const items = week.scopeIds.map((id) => object(state, id));
  const p = progress(items);
  if (week.published && p.total && p.closed === p.total) return '周单已闭环，只读查看到场、结果、证书与审计依据。';
  if (state.activeRole === 'lab') {
    if (!week.published) return '周单尚未发布，等待计量管理员建立并冻结范围后再提交排期建议。';
    if (items.every((item) => item.visitId)) return '周单设备已全部核对到场；查看进度，后续结果和证书由计量管理员确认。';
    if (week.proposals.some((value) => value.status === 'pending')) return '已有待确认排期建议，查看版本并等待管理员决定；未接受改期前原预约继续有效。';
    return '可为尚未到场的计划组提交排期或改期建议；管理员接受前原正式预约继续有效。';
  }
  if (!week.created) return '选择预置计划组，建立周单草稿；此时尚未形成预约或到场事实。';
  if (!week.published) return '核对周单草稿范围后发布并冻结；发布后由检测方提出排期建议。';
  if (week.proposals.some((value) => value.status === 'pending')) return '核对待确认排期建议并接受或拒绝；接受前原正式预约继续有效。';
  const partial = items.some((item) => item.visitId && !item.result) ? '已到场部分可登记实际校验结果。' : '';
  if (items.some((item) => !item.visitId && week.appointments.some((value) => value.groupId === item.groupId))) return '按正式预约勾选本次实际到场设备；未到场设备仍留在周单，不能用预约替代到场。' + partial;
  if (items.some((item) => !item.visitId)) return '周单仍有设备未到场，等待检测方提交建议并确认正式预约；不补造到场事实。' + partial;
  if (p.executed < p.total) return '到场已核对，下一步登记实际校验结果；到场不等于结果已完成。';
  return '结果已登记，载入合成证书或进入连续复核；相关证书全部确认后周单才闭环。';
}

function returnGuidance(state) {
  const round = state.labRecords.find((value) => value.id === state.ui.roundId);
  const items = round.itemIds.map((id) => object(state, id));
  const atLab = items.filter((item) => item.physical === 'at_lab').length;
  const atRoom = items.filter((item) => item.physical === 'returned').length;
  if (state.revision === 0 && round.id === state.data.lab.records[0].id && atLab === 2 && atRoom === 0) {
    return '初始样例：勾选一台设备 → 选择“取回计量室” → 登记取回 → 查看在检数量从 2 变 1 → 查看审计记录。';
  }
  if (atLab) return '当前轮次仍有 ' + atLab + ' 台在检测方，勾选本次实际交接设备并明确去向后登记取回。' + (atRoom ? '另有 ' + atRoom + ' 台已回计量室，需另行确认领取。' : '') + '未选设备继续在检；数量以当前明细为准。';
  if (atRoom) return '当前轮次已无设备在检测方，计量室仍有 ' + atRoom + ' 台待领取；核对实际领取人、部门与时间后确认计量室领取。';
  const p = progress(items);
  return p.total && p.closed === p.total
    ? '本轮实物、结果与证书均已完成，查看交接与审计依据；无需重复登记。'
    : '本轮实物已全部领取，仍需核对结果与证书是否完成；实物领取不等于整体闭环。';
}

function certificateGuidance(state) {
  const selected = state.certificates.find((value) => value.id === state.ui.certificateId);
  if (!selected) {
    const pending = state.certificates.filter((value) => value.status !== 'confirmed').length;
    return pending
      ? '当前没有可自动接续的证书，仍有 ' + pending + ' 份未确认；跳过或仅关联不算完成。从队列选回待办继续核对。'
      : '队列证书已全部确认，可查看审计；证书完成不改变实物位置，也不单独证明整体闭环。';
  }
  if (selected.status === 'confirmed') return '当前证书已确认，只读核对已保存结果或选择下一份；切换候选不会覆盖确认事实。';
  const linked = selected.status === 'linked' ? '当前证书仅关联，复核尚未完成。' : '';
  if (!selected.evidenceComplete) return linked + '当前证书证据缺失，保留输入与待办，核验源材料；不能确认关联或推进结果。';
  const candidate = selected.candidates.find((value) => value.id === selected.draft.candidateId);
  if (candidate.criticalConflict || !candidate.uniqueBest) return linked + '当前候选存在关键冲突，不能确认；可执行匹配检查查看依据，保留输入与待办。';
  if (selected.assessment?.candidateId !== candidate.id || !selected.assessment.passed) return linked + '先对当前候选执行匹配检查；分数和依据只是建议，不代表已关联或复核完成。';
  if (!selected.draft.humanConfirmed) return linked + '当前候选匹配检查通过，下一步人工核对日期、结论与证据并勾选确认；仅确认关联不等于复核完成。';
  return linked + '已完成当前候选检查和人工核对，可确认复核并推进结果；仍以提交时的业务守卫为准，证书确认不改变实物位置。';
}

/** 只读派生当前任务，不保存引导状态、不执行动作，不以全局版本代替场景与分工。 */
export function taskGuidance(state) {
  if (state.activeRole === 'manager') return '管理者只读：' + readOnly[state.activeScenario];
  if (state.activeRole === 'lab') {
    if (state.activeScenario === 'weekly') return '检测方视角：' + weeklyGuidance(state);
    if (state.activeScenario === 'lab') return '检测方视角：查看在检轮次与剩余数量；达到 45 天且提醒尚未记录时可记录首次提醒，结果未知则停发。';
    return '检测方视角：' + readOnly[state.activeScenario];
  }
  let text;
  switch (state.activeScenario) {
    case 'weekly': text = weeklyGuidance(state); break;
    case 'returns': text = returnGuidance(state); break;
    case 'certificate': text = certificateGuidance(state); break;
    case 'intake': {
      const items = state.objects.filter((item) => item.source === 'intake');
      text = items.some((item) => item.physical === 'ready') ? '核对接收清单，接收正常设备；异常设备保留待办，再从已接收设备形成送出轮次。'
        : items.some((item) => item.physical === 'received') ? '正常设备已接收，下一步形成送出轮次，再到在检跟进核对。'
        : items.some((item) => item.physical === 'exception') ? '正常设备已送出；仍有异常设备待核对，不以送出事实关闭异常。'
        : '本次设备已形成送出轮次，进入在检跟进查看剩余数量与后续交接。';
      break;
    }
    case 'lab': text = '查看当前在检轮次、剩余数量和提醒状态；有实际交接时进入取回与领取。44 天不提醒，结果未知停止重发。'; break;
    case 'audit': text = '查看审计记录与各分支未完成条件；预约、实物、结果和证书分别留下依据，导航不新增事实。'; break;
  }
  return '计量管理员：' + text;
}
