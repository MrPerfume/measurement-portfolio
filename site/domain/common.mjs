export const clone = (value) => structuredClone(value);
export function requireRule(condition, message) {
  if (!condition) throw new Error(message);
}
export function ids(value) {
  requireRule(Array.isArray(value) && value.length > 0, '请至少选择一台设备或一个计划组。');
  requireRule(value.every((id) => typeof id === 'string' && id.trim() === id && id !== ''), '选择包含无效标识。');
  requireRule(new Set(value).size === value.length, '选择包含重复项，请重新选择。');
  return [...value].sort();
}
export function object(state, id) {
  const result = state.objects.find((item) => item.id === id);
  requireRule(result, '对象不存在，状态没有改变。');
  return result;
}
export function event(state, type, objectId, title, detail) {
  state.events.push({ id: 'EVT-' + String(state.events.length).padStart(3, '0'), type, objectId, title, detail });
}
export function dayNumber(date) {
  requireRule(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date), '日期格式无效。');
  const time = Date.parse(date + 'T00:00:00Z');
  requireRule(Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date, '日期不存在。');
  return time / 86400000;
}
export function dateAt(value) {
  requireRule(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), '请填写完整的北京时间。');
  dayNumber(value.slice(0, 10));
  requireRule(Number(value.slice(11, 13)) < 24 && Number(value.slice(14)) < 60, '时间格式无效。');
  return Date.parse(value + ':00+08:00');
}
export function actualTime(state, value, earliest) {
  const time = dateAt(value);
  requireRule(time <= Date.parse(state.data.meta.referenceAt), '实际时间不能晚于演示参考时刻。');
  requireRule(time >= Date.parse(earliest), '实际时间不能早于对应送出或预约时间。');
  return value;
}
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
export function sourceItems(state, source, sourceId) {
  if (source === 'weekly') {
    requireRule(state.weekly.published && sourceId === state.weekly.id, '请先发布周报检单。');
    return state.weekly.scopeIds.map((id) => object(state, id));
  }
  requireRule(source === 'round', '业务来源无效。');
  const round = state.labRecords.find((item) => item.id === sourceId);
  requireRule(round, '送出轮次不存在。');
  return round.itemIds.map((id) => object(state, id));
}
export function progress(items) {
  const executed = items.filter((item) => item.result).length;
  const certified = items.filter((item) => item.certificateConfirmed).length;
  const closed = items.filter((item) => item.result && item.certificateConfirmed
    && (item.track !== 'external' || item.physical === 'picked_up')).length;
  return { total: items.length, executed, certified, closed };
}
