// 计算规则：按量表版本进行正反向计分、分项分、总分与风险等级
// 全部为纯函数，界面录入与状态层共用同一套计算。

import { RISK_LABEL, RISK_ORDER } from "../domain/scales";
import type { RiskLevel, ScaleVersion } from "../domain/types";

export interface ScoreResult {
  itemScores: Record<string, number>;
  scoredItems: Record<string, number>;
  subscaleScores: Record<string, number>;
  total: number;
  risk: RiskLevel;
  maxTotal: number;
}

// 单条目计分：正向取原始分；反向取「最大可选分 - 原始分」
export function scoreItem(scale: ScaleVersion, code: string, raw: number): number {
  const item = scale.items.find((entry) => entry.code === code);
  if (!item) throw new Error(`未知条目：${code}`);
  const max = Math.max(...scale.optionValues);
  return item.direction === "reverse" ? max - raw : raw;
}

export function levelByTotal(scale: ScaleVersion, total: number): RiskLevel {
  const band = scale.bands.find((entry) => total >= entry.min && total <= entry.max);
  if (!band) throw new Error(`总分 ${total} 超出 ${scale.scaleKey} 区间`);
  return band.level;
}

export function isEscalation(from: RiskLevel | undefined, to: RiskLevel): boolean {
  if (!from) return false;
  return RISK_ORDER.indexOf(to) > RISK_ORDER.indexOf(from);
}

// 完整计分：缺条目的条目保留为 undefined 并返回 completed=false，便于界面逐步填写
export function scoreAnswers(
  scale: ScaleVersion,
  answers: Record<string, number>,
): ScoreResult & { completed: boolean; missing: string[] } {
  const itemScores: Record<string, number> = {};
  const scoredItems: Record<string, number> = {};
  const subscaleScores: Record<string, number> = {};
  const missing: string[] = [];

  scale.items.forEach((item) => {
    subscaleScores[item.subscale] ??= 0;
    const raw = answers[item.code];
    if (raw === undefined) {
      missing.push(item.code);
      return;
    }
    const scored = scoreItem(scale, item.code, raw);
    itemScores[item.code] = raw;
    scoredItems[item.code] = scored;
    subscaleScores[item.subscale] += scored;
  });

  const total = Object.values(scoredItems).reduce((sum, value) => sum + value, 0);
  const maxTotal =
    scale.items.length * Math.max(...scale.optionValues);
  const completed = missing.length === 0;

  return {
    itemScores,
    scoredItems,
    subscaleScores,
    total,
    risk: completed ? levelByTotal(scale, total) : "stable",
    maxTotal,
    completed,
    missing,
  };
}

export function riskLabel(level: RiskLevel): string {
  return RISK_LABEL[level];
}
