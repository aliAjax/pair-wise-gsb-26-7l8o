import { addDays, levelForScore, scoreAssessment, todayString } from "./rules";
import { GAD7_2024, PHQ9_2024, RSES_2024, SCALE_VERSIONS } from "./scales";
import type {
  AssessmentKind,
  AssessmentVersion,
  CaseRecord,
  ContactPlan,
  ItemAnswer,
  TriggerLogEntry,
} from "./types";

// 演示数据：相对“今天”生成，保证 7 天复测窗口在任意日期刷新都成立。
// 所有总分 / 分项分 / 风险等级都由规则层函数计算，不手写。

export const COUNSELORS = ["李敏", "周岚", "陈恪"];

function answers(values: number[], prefix: string): ItemAnswer[] {
  return values.map((value, i) => ({ itemCode: `${prefix}-${i + 1}`, value }));
}

function buildAssessment(
  partial: Omit<
    AssessmentVersion,
    "version" | "subscaleScores" | "totalScore" | "riskLevel" | "status"
  > & { status?: AssessmentVersion["status"] }
): AssessmentVersion {
  const scale = SCALE_VERSIONS.find((s) => s.scaleCode === partial.scaleCode)!;
  const scored = scoreAssessment(scale, partial.itemAnswers);
  return {
    ...partial,
    version: scale.version,
    subscaleScores: scored.subscales,
    totalScore: scored.total,
    riskLevel: levelForScore(scale, scored.total),
    status: partial.status ?? "valid",
  };
}

export function buildSeedState() {
  const t = todayString();

  const cases: CaseRecord[] = [
    { id: "case-042", code: "C-042", alias: "来访者 042", tag: "焦虑", createdAt: addDays(t, -45) },
    { id: "case-119", code: "C-119", alias: "来访者 119", tag: "亲密关系", createdAt: addDays(t, -60) },
    { id: "case-203", code: "C-203", alias: "来访者 203", tag: "职业压力", createdAt: addDays(t, -30) },
    { id: "case-318", code: "C-318", alias: "来访者 318", tag: "抑郁", createdAt: addDays(t, -21) },
    { id: "case-407", code: "C-407", alias: "来访者 407", tag: "自尊", createdAt: addDays(t, -25) },
  ];

  // C-042 焦虑：关注 → 复测高风险（升级，挂待办联系计划）
  const a042_1 = buildAssessment({
    id: "asmt-042-1",
    caseId: "case-042",
    scaleCode: "GAD7",
    seq: 1,
    kind: "initial",
    testDate: addDays(t, -20),
    itemAnswers: answers([1, 2, 1, 2, 1, 1, 1], "GAD7"),
    createdAt: addDays(t, -20) + "T09:30",
  });
  const a042_2 = buildAssessment({
    id: "asmt-042-2",
    caseId: "case-042",
    scaleCode: "GAD7",
    seq: 2,
    kind: "retest",
    testDate: addDays(t, -3),
    itemAnswers: answers([3, 3, 2, 3, 2, 2, 2], "GAD7"),
    createdAt: addDays(t, -3) + "T14:10",
  });

  // C-119 自尊：关注，距上次 40 天，可复测
  const a119_1 = buildAssessment({
    id: "asmt-119-1",
    caseId: "case-119",
    scaleCode: "RSES",
    seq: 1,
    kind: "initial",
    testDate: addDays(t, -40),
    itemAnswers: answers([2, 1, 2, 2, 1, 1, 2, 1, 1, 2], "RSES"),
    createdAt: addDays(t, -40) + "T10:05",
  });

  // C-203 抑郁初测稳定，第 9 天（已到复测窗口）
  const a203_1 = buildAssessment({
    id: "asmt-203-1",
    caseId: "case-203",
    scaleCode: "PHQ9",
    seq: 1,
    kind: "initial",
    testDate: addDays(t, -9),
    itemAnswers: answers([0, 1, 1, 0, 0, 1, 0, 0, 0], "PHQ9"),
    createdAt: addDays(t, -9) + "T11:20",
  });

  // C-318：v1 已冻结（被更正替代），v2 为带原因的更正版本
  const a318_1 = buildAssessment({
    id: "asmt-318-1",
    caseId: "case-318",
    scaleCode: "PHQ9",
    seq: 1,
    kind: "initial",
    testDate: addDays(t, -14),
    itemAnswers: answers([2, 1, 2, 1, 1, 1, 1, 0, 0], "PHQ9"),
    status: "superseded",
    supersededById: "asmt-318-2",
    createdAt: addDays(t, -14) + "T15:00",
  });
  const a318_2 = buildAssessment({
    id: "asmt-318-2",
    caseId: "case-318",
    scaleCode: "PHQ9",
    seq: 2,
    kind: "correction",
    correctionOfId: "asmt-318-1",
    reason: "来访者补充：条目 6 实际为“好几天”，初测误录为“一半以上天数”，总分偏高 1 分。",
    testDate: addDays(t, -14),
    itemAnswers: answers([1, 1, 1, 1, 1, 1, 1, 0, 0], "PHQ9"),
    createdAt: addDays(t, -10) + "T16:40",
  });

  // C-407：中风险 → 复测高风险（升级），联系计划已完成
  const a407_1 = buildAssessment({
    id: "asmt-407-1",
    caseId: "case-407",
    scaleCode: "RSES",
    seq: 1,
    kind: "initial",
    testDate: addDays(t, -18),
    itemAnswers: answers([1, 2, 1, 1, 2, 2, 1, 2, 2, 1], "RSES"),
    createdAt: addDays(t, -18) + "T09:00",
  });
  const a407_2 = buildAssessment({
    id: "asmt-407-2",
    caseId: "case-407",
    scaleCode: "RSES",
    seq: 2,
    kind: "retest",
    testDate: addDays(t, -6),
    itemAnswers: answers([0, 3, 0, 0, 3, 3, 0, 3, 3, 0], "RSES"),
    createdAt: addDays(t, -6) + "T13:25",
  });

  const assessments: AssessmentVersion[] = [
    a042_1, a042_2, a119_1, a203_1, a318_1, a318_2, a407_1, a407_2,
  ];

  const plans: ContactPlan[] = [
    {
      id: "plan-042-1",
      caseId: "case-042",
      scaleCode: "GAD7",
      assessmentId: a042_2.id,
      trigger: "escalation",
      content: "24 小时内电话安全评估，确认自伤意念与支持系统；48 小时内安排复诊并书面记录。",
      counselor: "李敏",
      deadline: addDays(t, 2),
      status: "pending",
      createdAt: addDays(t, -3) + "T14:10",
    },
    {
      id: "plan-407-1",
      caseId: "case-407",
      scaleCode: "RSES",
      assessmentId: a407_2.id,
      trigger: "escalation",
      content: "危机干预会谈，启动书面安全计划，经知情同意联系紧急陪同人。",
      counselor: "周岚",
      deadline: addDays(t, -1),
      status: "done",
      completedAt: addDays(t, -5) + "T17:30",
      createdAt: addDays(t, -6) + "T13:25",
    },
  ];

  const logs: TriggerLogEntry[] = [
    {
      id: "log-seed-1",
      at: addDays(t, -3) + "T14:10",
      outcome: "conflict",
      rule: "R-GATE",
      caseId: "case-042",
      scaleCode: "GAD7",
      message: "C-042 GAD-7 风险等级由「关注」升级为「高风险」（9 → 17），已强制登记联系计划。",
      conflicts: [
        { label: "风险等级", oldValue: "关注（v1 总分 9）", newValue: "高风险（总分 17）", rule: "R-GATE 总分升级" },
      ],
    },
    {
      id: "log-seed-2",
      at: addDays(t, -10) + "T16:40",
      outcome: "accepted",
      rule: "R-FREEZE",
      caseId: "case-318",
      scaleCode: "PHQ9",
      message: "C-318 PHQ-9 更正生效：v1 冻结保留，生成 v2（9 → 7，等级不变）。",
    },
  ];

  return { cases, scales: SCALE_VERSIONS, assessments, plans, logs };
}

export const SCALE_LOOKUP: Record<string, (typeof SCALE_VERSIONS)[number]> = {
  PHQ9: PHQ9_2024,
  GAD7: GAD7_2024,
  RSES: RSES_2024,
};

export type { AssessmentKind };
