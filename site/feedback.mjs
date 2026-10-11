// 展示摘要只读取已提交的交接、明细与事件，不形成新的业务事实。
// 失败及幂等重放没有新交接，必须沿用原错误/重放提示，不能伪装成新成功。
export function transferSummary(before, after, action) {
  if (!['registerReturn', 'confirmPickup'].includes(action.type)
      || after.receipts.length !== before.receipts.length + 1) return null;
  const receipt = after.receipts.at(-1);
  const round = after.labRecords.find((value) => value.id === receipt.roundId);
  if (!round || receipt.roundId !== action.recordId) return null;
  const count = (state, physical) => state.objects.filter((item) => round.itemIds.includes(item.id) && item.physical === physical).length;
  const wasAtLab = count(before, 'at_lab');
  const atLab = count(after, 'at_lab');
  const label = { metering: '取回计量室', direct: '部门直领', pickup: '计量室领取' }[receipt.destination];
  const change = wasAtLab === atLab ? '保持 ' + atLab + ' 台' : ' ' + wasAtLab + ' → ' + atLab + ' 台';
  const entry = after.events.slice(before.events.length).find((value) => value.objectId === round.id && value.detail.includes(receipt.id + '；'));
  return {
    message: '本次' + label + ' ' + receipt.itemIds.length + ' 台；本轮在检数量' + change
      + '，计量室待领取 ' + count(after, 'returned') + ' 台，部门已领取 ' + count(after, 'picked_up') + ' 台。结果与证书状态未改变。',
    receiptId: receipt.id, roundId: round.id, eventId: entry?.id || null
  };
}
