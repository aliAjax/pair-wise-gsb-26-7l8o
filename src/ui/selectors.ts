import { chainOf, latestValid, retestReminder, todayString } from "../domain/rules";
import { SCALE_LOOKUP } from "../domain/seed";
import { effectivePlanStatus } from "../state/store";
import type { AppState, AssessmentVersion, CaseRecord, RiskLevel, ScaleCode } from "../domain/types";

// 界面层派生数据：所有“刷新后一致”的统计都从同一份 state 经纯函数计算。

export interface CaseRow {
  caseRecord: CaseRecord;
  chains: {
    scaleCode: ScaleCode;
    latest?: AssessmentVersion;
    reminder?: ReturnType<typeof retestReminder>;
  }[];
  topLevel: RiskLevel;
}

export function selectCaseRows(state: AppState): CaseRow[] {
  const today = todayString();
  return state.cases.map((caseRecord) => {
    const chains = Object.keys(SCALE_LOOKUP).map((code) => {
      const scaleCode = code as ScaleCode;
      const latest = latestValid(state.assessments, caseRecord.id, scaleCode);
      return {
        scaleCode,
        latest,
        reminder: latest ? retestReminder(latest, today) : undefined,
      };
    });
    const rank = { stable: 0, watch: 1, moderate: 2, high: 3 } as const;
    const topLevel = chains.reduce<RiskLevel>((acc, c) => {
      if (!c.latest) return acc;
      return rank[c.latest.riskLevel] > rank[acc] ? c.latest.riskLevel : acc;
    }, "stable");
    return { caseRecord, chains, topLevel };
  });
}

export function selectAllReminders(state: AppState) {
  const today = todayString();
  const items: {
    caseRecord: CaseRecord;
    assessment: AssessmentVersion;
    reminder: ReturnType<typeof retestReminder>;
  }[] = [];
  for (const caseRecord of state.cases) {
    for (const code of Object.keys(SCALE_LOOKUP) as ScaleCode[]) {
      const latest = latestValid(state.assessments, caseRecord.id, code);
      if (latest) items.push({ caseRecord, assessment: latest, reminder: retestReminder(latest, today) });
    }
  }
  return items.sort((a, b) => a.reminder.remainingDays - b.reminder.remainingDays);
}

export interface CaseChain {
  scaleCode: ScaleCode;
  versions: AssessmentVersion[];
  latest?: AssessmentVersion;
}

export function selectCaseChains(state: AppState, caseId: string): CaseChain[] {
  return (Object.keys(SCALE_LOOKUP) as ScaleCode[]).map((scaleCode) => {
    const versions = chainOf(state.assessments, caseId, scaleCode);
    return { scaleCode, versions, latest: versions.filter((v) => v.status === "valid").at(-1) };
  });
}

export function selectMetrics(state: AppState) {
  const rows = selectCaseRows(state);
  const today = todayString();
  return {
    activeCases: state.cases.length,
    highRisk: rows.filter((r) => r.topLevel === "high").length,
    pendingPlans: state.plans.filter((p) => effectivePlanStatus(p) !== "done").length,
    eligibleRetests: selectAllReminders(state).filter((r) => r.reminder.eligible).length,
    today,
  };
}
