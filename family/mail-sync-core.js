import {validateBill, duplicateKey, normalizePayment} from './core.js';

export function mergeMailBills(localBills, incoming) {
  if (!Array.isArray(localBills) || !localBills.every(validateBill) || !Array.isArray(incoming) || incoming.length > 4500 || !incoming.every(validateBill)) throw Error('账单数据校验未通过，未修改本机记录。');
  const map = new Map(localBills.map(bill => [duplicateKey(bill), bill]));
  const conflicts = [];
  let added = 0;
  for (const candidate of incoming) {
    const key = duplicateKey(candidate), existing = map.get(key);
    if (existing) {
      if (existing.amount !== candidate.amount || existing.minimum !== candidate.minimum || existing.due !== candidate.due) conflicts.push({bank: candidate.bank, tail: candidate.tail, period: candidate.period, reason: '新读取的金额或日期与已有账单不同；已有账单和还款记录已保留，请核对原邮件。'});
      continue;
    }
    // Email data never supplies repayment marks. Those are exclusively user records.
    map.set(key, normalizePayment({...candidate, paid: false, payments: []}));
    added++;
  }
  return {bills: [...map.values()], added, conflicts};
}

export function syncIsStale(lastSuccessAt, now = Date.now()) {
  const time = Date.parse(lastSuccessAt);
  return !Number.isFinite(time) || now - time > 48 * 3600000;
}
