// 初始演示数据：通过规则层计分函数生成，保证条目、分项分、总分、风险等级一致。

import { GAD7_V1, PMH_V1, getScale } from "../domain/scales";
import type { AppState, Assessment, Client, ContactPlan } from "../domain/types";
import { scoreAnswers } from "../rules/scoring";

// 演示基准日：固定在 2026-09-21，使「剩余天数」复测提醒可复现
const NOW = "2026-09-21T09:00:00.000Z";

const CLIENTS: Client[] = [
  { id: "C-042", name: "来访者 C-042", theme: "焦虑", counselor: "王咨询师", createdAt: "2026-08-20" },
  { id: "C-119", name: "来访者 C-119", theme: "亲密关系", counselor: "林咨询师", createdAt: "2026-07-11" },
  { id: "C-203", name: "来访者 C-203", theme: "职业压力", counselor: "赵咨询师", createdAt: "2026-06-02" },
  { id: "C-318", name: "来访者 C-318", theme: "亲子", counselor: "王咨询师", createdAt: "2026-09-05" },
];

function buildAssessment(
  clientId: string,
  scaleKey: string,
  assessDate: string,
  answers: Record<string, number>,
  order: number,
  extra?: {
    revision?: number;
    createdFrom?: Assessment["createdFrom"];
    contactPlanId?: string;
    idSuffix?: string;
  },
): Assessment {
  const scale = getScale(scaleKey);
  const result = scoreAnswers(scale, answers);
  return {
    id: `A-${String(order).padStart(3, "0")}${extra?.idSuffix ?? ""}`,
    clientId,
    scaleId: scale.scaleId,
    scaleKey,
    version: scale.version,
    revision: extra?.revision ?? 1,
    assessDate,
    itemScores: result.itemScores,
    subscaleScores: result.subscaleScores,
    total: result.total,
    risk: result.risk,
    status: "frozen",
    submittedAt: `${assessDate}T0${order}:00:00.000Z`,
    createdFrom: extra?.createdFrom ?? { kind: "new" },
    contactPlanId: extra?.contactPlanId,
  };
}

// C-042 GAD-7：9/15 中风险（11 分），9/19 复测间隔内 → 复测提醒剩余 5 天
const a042 = buildAssessment(
  "C-042",
  GAD7_V1.scaleKey,
  "2026-09-15",
  { Q1: 1, Q2: 2, Q3: 2, Q4: 1, Q5: 1, Q6: 2, Q7: 2 },
  1,
);

// C-119 GAD-7：9/02 稳定（2 分），间隔已满足，可复测
const a119 = buildAssessment(
  "C-119",
  GAD7_V1.scaleKey,
  "2026-09-02",
  { Q1: 0, Q2: 1, Q3: 0, Q4: 0, Q5: 1, Q6: 0, Q7: 0 },
  2,
);

// C-203 GAD-7：9/18 高风险（17 分），已登记联系计划
const a203 = buildAssessment(
  "C-203",
  GAD7_V1.scaleKey,
  "2026-09-18",
  { Q1: 3, Q2: 3, Q3: 2, Q4: 3, Q5: 2, Q6: 2, Q7: 2 },
  3,
  { contactPlanId: "P-001" },
);

const plan203: ContactPlan = {
  id: "P-001",
  clientId: "C-203",
  scaleId: "GAD7",
  scaleKey: GAD7_V1.scaleKey,
  assessmentId: a203.id,
  assessDate: "2026-09-18",
  revision: 1,
  method: "当日电话安全评估，48 小时内安排危机会谈；每日晚 20:00 短信确认状态",
  counselor: "赵咨询师",
  dueDate: "2026-09-22",
  trigger: "high",
  status: "pending",
  createdAt: NOW,
};

// C-318 PMH v1.0：9/10 原始版 10 分中风险（Q3 原始分 3→计 0，Q5 原始分 2→计 1）
const a318OriginalAnswers: Record<string, number> = {
  Q1: 2,
  Q2: 2,
  Q3: 3,
  Q4: 2,
  Q5: 2,
  Q6: 3,
};
const a318 = buildAssessment("C-318", PMH_V1.scaleKey, "2026-09-10", a318OriginalAnswers, 4);

// 同日更正：Q4 由 2 更正为 3 → 11 分，仍中风险（无升级，不强制计划）；原条目与分数保留
const a318CorrectedAnswers = { ...a318OriginalAnswers, Q4: 3 };
const a318r2 = buildAssessment(
  "C-318",
  PMH_V1.scaleKey,
  "2026-09-10",
  a318CorrectedAnswers,
  5,
  {
    revision: 2,
    idSuffix: "-r2",
    createdFrom: { kind: "correction", correctsId: a318.id, reason: "来访者反馈 Q4 理解偏差，复核会谈录音后更正。" },
  },
);
a318.supersededById = a318r2.id;

export function buildSeedState(): AppState {
  return {
    clients: CLIENTS,
    assessments: [a042, a119, a203, a318, a318r2],
    plans: [plan203],
    rejections: [],
  };
}
