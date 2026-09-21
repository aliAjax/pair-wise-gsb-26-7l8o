// 复测规则：同一量表距上次有效测评不足七天不得复测。
// 纯函数，入参为数据快照，不读取界面状态。

import type { Assessment } from "../domain/types";

export const RETEST_INTERVAL_DAYS = 7;

// 统一按 UTC 日期相减，避免时区与时分秒造成误差
export function daysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// 上次有效测评：同个案 + 同一量表（跨版本）中测评日期最晚的一条
export function lastValidAssessment(
  assessments: Assessment[],
  clientId: string,
  scaleId: string,
  excludeId?: string,
): Assessment | undefined {
  const candidates = assessments.filter(
    (entry) =>
      entry.clientId === clientId &&
      entry.scaleId === scaleId &&
      entry.id !== excludeId,
  );
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => {
    if (a.assessDate !== b.assessDate) return a.assessDate < b.assessDate ? 1 : -1;
    return a.submittedAt < b.submittedAt ? 1 : -1;
  })[0];
}

export interface RetestStatus {
  allowed: boolean;
  last?: Assessment;
  elapsedDays: number;
  remainingDays: number; // 距离可复测还剩的天数
}

export function checkRetest(
  assessments: Assessment[],
  clientId: string,
  scaleId: string,
  assessDate: string,
  excludeId?: string,
): RetestStatus {
  const last = lastValidAssessment(assessments, clientId, scaleId, excludeId);
  if (!last) return { allowed: true, elapsedDays: 0, remainingDays: 0 };
  const elapsedDays = daysBetween(last.assessDate, assessDate);
  const remainingDays = Math.max(0, RETEST_INTERVAL_DAYS - elapsedDays);
  return {
    allowed: elapsedDays >= RETEST_INTERVAL_DAYS,
    last,
    elapsedDays,
    remainingDays,
  };
}
