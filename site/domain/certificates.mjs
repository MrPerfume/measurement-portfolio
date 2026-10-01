import { dayNumber, event, ids, object, requireRule, sourceItems } from './common.mjs';

export function makeCertificate(state, id, targetId, kind = 'normal') {
  const target = object(state, targetId);
  const conflict = kind === 'conflict';
  return {
    id, targetId, kind, number: id, name: target.name, source: target.track === 'onsite' ? 'weekly' : target.track === 'external' ? 'round' : 'independent',
    sourceId: target.track === 'onsite' ? state.weekly.id : target.roundId || null,
    calibrationDate: target.result?.date || '2026-09-06', result: target.result?.value || 'pass',
    evidenceComplete: kind !== 'missing', status: 'pending', linkedCandidateId: null, assessment: null,
    candidates: [
      { id: targetId, name: target.name, score: 96, uniqueBest: true, criticalConflict: conflict, reasons: ['合成编号一致', '设备名称一致', '校验日期可核对'], conflicts: conflict ? ['关键身份字段冲突，需回到源材料核验'] : [] },
      { id: 'DEMO-ALTERNATIVE-' + id, name: '另一合成候选', score: 78, uniqueBest: false, criticalConflict: true, reasons: ['类别接近'], conflicts: ['本厂编号冲突', '不是唯一最高分'] }
    ],
    draft: { candidateId: targetId, humanConfirmed: false, note: '' }, skipped: false
  };
}

export function nextCertificate(state, currentId) {
  const index = state.certificates.findIndex((item) => item.id === currentId);
  const ordered = [...state.certificates.slice(index + 1), ...state.certificates.slice(0, index)];
  const next = ordered.find((item) => item.status !== 'confirmed' && !item.skipped);
  state.ui.certificateId = next?.id || null;
}

// 评分只形成建议。关联和结果确认是两个显式动作，提交失败不得修改源业务明细。
export function certificateAction(state, action) {
  if (action.type === 'recordExecution') {
    const source = sourceItems(state, action.source, action.sourceId);
    const selected = ids(action.itemIds);
    requireRule(selected.every((id) => source.some((item) => item.id === id)), '选择超出了当前业务范围。');
    requireRule(action.humanConfirmed === true, '请确认这是演示中实际发生的执行结果。');
    requireRule(['pass', 'fail'].includes(action.result), '请选择校验结论。');
    dayNumber(action.date);
    requireRule(action.date <= state.data.meta.referenceDate, '校验日期不能晚于演示参考日期。');
    const items = selected.map((id) => object(state, id));
    for (const item of items) {
      requireRule(item.track !== 'onsite' || item.visitId, '现场设备尚未核对到场。');
      const earliest = item.track === 'onsite' ? item.attendedAt.slice(0, 10) : state.labRecords.find((round) => round.id === item.roundId).sentOn;
      requireRule(action.date >= earliest, '校验日期不能早于到场或送出日期。');
      requireRule(!item.result || (item.result.value === action.result && item.result.date === action.date), '已有结果不同，不能直接覆盖。');
    }
    const fresh = items.filter((item) => !item.result);
    if (!fresh.length) return '相同结果已记录，未重复留痕。';
    fresh.forEach((item) => { item.result = { value: action.result, date: action.date }; });
    event(state, 'execution.recorded', action.sourceId, '已登记 ' + fresh.length + ' 台校验结果', '执行结果与证书、实物交接独立。');
    state.ui.forms.execution = {};
    return '执行结果已登记。现在可以载入合成证书。';
  }
  if (action.type === 'loadEvidence') {
    const items = sourceItems(state, action.source, action.sourceId).filter((item) => item.result);
    requireRule(items.length, '请先登记实际执行结果，再载入对应证书。');
    const fresh = items.filter((item) => !state.certificates.some((certificate) => certificate.targetId === item.id));
    if (!fresh.length) return '对应证书已在队列，不重复载入。';
    const certificates = fresh.map((item) => makeCertificate(state, 'DEMO-CERT-AUTO-' + state.nextCertificate++, item.id));
    state.certificates.push(...certificates);
    state.ui.certificateId = certificates[0].id;
    event(state, 'certificate.loaded', action.sourceId, '载入 ' + fresh.length + ' 份合成证书', '仅构造演示材料，不上传或解析真实文件。');
    return '合成证书已进入连续复核队列。';
  }
  const certificate = state.certificates.find((item) => item.id === action.certificateId);
  requireRule(certificate, '请先选择证书。');
  if (action.type === 'skipCertificate') {
    certificate.skipped = true;
    nextCertificate(state, certificate.id);
    return '已跳过，原待办没有关闭；可从队列重新选择。';
  }
  const candidate = certificate.candidates.find((item) => item.id === action.candidateId);
  requireRule(candidate, '请选择有效的候选设备。');
  if (action.type === 'checkMatch') {
    certificate.assessment = {
      candidateId: candidate.id,
      passed: candidate.score >= 70 && candidate.uniqueBest && !candidate.criticalConflict && certificate.evidenceComplete
    };
    return certificate.assessment.passed ? '匹配检查通过；仍需人工确认，尚未关联或推进结果。' : '存在冲突或证据缺口，请保留待办并核验源材料。';
  }
  requireRule(certificate.evidenceComplete, '证据缺失，保留输入和待办，不允许确认。');
  requireRule(certificate.assessment?.candidateId === candidate.id && certificate.assessment.passed, '请先对当前候选执行匹配检查，冲突不能跳过。');
  requireRule(candidate.id === certificate.targetId, '候选与来源事实不一致，不能改绑。');
  requireRule(!certificate.linkedCandidateId || certificate.linkedCandidateId === candidate.id, '已有确认关联不能覆盖。');
  const target = object(state, candidate.id);
  if (action.type === 'confirmLink') {
    if (certificate.linkedCandidateId) return '关联已确认，未重复留痕。';
    certificate.linkedCandidateId = candidate.id;
    certificate.status = 'linked';
    event(state, 'certificate.linked', certificate.id, '证书已确认关联', '仅关联设备，不确认校验结果，也不改变实物位置。');
  } else {
    requireRule(action.type === 'confirmCertificate', '未知证书动作。');
    requireRule(action.humanConfirmed === true, '请勾选人工核对日期、结论与证据的确认项。');
    if (certificate.status === 'confirmed') return '本证书已确认，重复操作不新增事件。';
    requireRule(target.track === 'independent' || target.result, '业务来源尚无执行结果。');
    requireRule(!target.result || (target.result.value === certificate.result && target.result.date === certificate.calibrationDate), '证书与已登记结果冲突，不能覆盖事实。');
    certificate.linkedCandidateId = candidate.id;
    certificate.status = 'confirmed';
    target.result ||= { value: certificate.result, date: certificate.calibrationDate };
    target.certificateConfirmed = true;
    event(state, 'certificate.confirmed', certificate.id, '人工复核已确认', '已确认本轮结果与证书；实物状态保持不变。');
  }
  certificate.skipped = false;
  nextCertificate(state, certificate.id);
  return '本份处理成功，已转到下一份可处理证书。';
}
