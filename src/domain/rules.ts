import type {
  AssessmentVersion,
  ConflictDetail,
  ContactPlan,
  ItemAnswer,
  PlanTrigger,
  RiskLevel,
  ScaleCode,
  ScaleVersion,
} from "./types";

// 计算规则层：纯函数，不依赖 React、localStorage 或任何界面状态。

export const RISK_META: Record<
  RiskLevel,
  { label: string; rank: number; tone: "ok" | "watch" | "moderate" | "danger" }
> = {
  stable: { label: "稳定", rank: 0, tone: "ok" },
  watch: { label: "关注", rank: 1, tone: "watch" },
  moderate: { label: "中风险", rank: 2, tone: "moderate" },
  high: { label: "高风险", rank: 3, tone: "danger" },
};

export const PLAN_TRIGGER_LABEL: Record<PlanTrigger, string> = {
  "first-high": "高风险阈值",
  escalation: "总分升级",
};

export const RETEST_INTERVAL_DAYS = 7;

// ---------- 日期工具（按本地日历日比较，避免 UTC 偏移） ----------

function parseDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** b - a 的日历天数差 */
export function diffDays(fromISO: string, toISO: string): number {
  const ms = parseDate(toISO).getTime() - parseDate(fromISO).getTime();
  return Math.round(ms / 86400000);
}

// ---------- R-SCORE：正反向计分、分项分、总分、风险等级 ----------

export function scoreItem(item: { reverse: boolean; min: number; max: number }, value: number): number {
  return item.reverse ? item.min + item.max - value : value;
}

export interface ScoreResult {
  total: number;
  subscales: { code: string; name: string; score: number }[];
  missing: string[];
}

export function scoreAssessment(scale: ScaleVersion, answers: ItemAnswer[]): ScoreResult {
  const byCode = new Map(answers.map((a) => [a.itemCode, a.value]));
  const missing: string[] = [];

  const subscales = scale.subscales.map((sub) => {
    let score = 0;
    for (const code of sub.itemCodes) {
      const item = scale.items.find((i) => i.code === code)!;
      const value = byCode.get(code);
      if (value === undefined) {
        missing.push(code);
      } else {
        score += scoreItem(item, value);
      }
    }
    return { code: sub.code, name: sub.name, score };
  });

  return { total: subscales.reduce((sum, s) => sum + s.score, 0), subscales, missing };
}

export function levelForScore(scale: ScaleVersion, total: number): RiskLevel {
  const band = scale.bands.find((b) => total >= b.min && total < b.max) ?? scale.bands[scale.bands.length - 1];
  return band.level;
}

// ---------- 测评链查询 ----------

export function chainOf(
  assessments: AssessmentVersion[],
  caseId: string,
  scaleCode: ScaleCode
): AssessmentVersion[] {
  return assessments
    .filter((a) => a.caseId === caseId && a.scaleCode === scaleCode)
    .sort((a, b) => a.seq - b.seq);
}

export function latestValid(
  assessments: AssessmentVersion[],
  caseId: string,
  scaleCode: ScaleCode
): AssessmentVersion | undefined {
  return chainOf(assessments, caseId, scaleCode)
    .filter((a) => a.status === "valid")
    .at(-1);
}

// ---------- R-GATE：升级 / 高风险闸门判定 ----------

export interface GateResult {
  required: boolean;
  trigger: PlanTrigger;
  conflicts: ConflictDetail[];
}

/**
 * 总分升级（风险等级严格升高）或达到高风险阈值时，必须登记联系计划。
 * 同一(个案,量表)无有效前次时，等级达到高风险即触发。
 */
export function evaluateGate(
  scale: ScaleVersion,
  previous: AssessmentVersion | undefined,
  total: number,
  level: RiskLevel
): GateResult {
  const conflicts: ConflictDetail[] = [];
  const isHigh = level === "high";

  if (!previous) {
    if (isHigh) {
      conflicts.push({
        label: "风险等级",
        oldValue: "无前次有效测评",
        newValue: `${RISK_META[level].label}（总分 ${total} ≥ 阈值 ${scale.highRiskThreshold}）`,
        rule: "R-GATE 高风险阈值",
      });
      return { required: true, trigger: "first-high", conflicts };
    }
    return { required: false, trigger: "first-high", conflicts: [] };
  }

  const escalated = RISK_META[level].rank > RISK_META[previous.riskLevel].rank;
  if (escalated || isHigh) {
    conflicts.push({
      label: "风险等级",
      oldValue: `${RISK_META[previous.riskLevel].label}（v${previous.seq} 总分 ${previous.totalScore}）`,
      newValue: `${RISK_META[level].label}（总分 ${total}）`,
      rule: escalated ? "R-GATE 总分升级" : "R-GATE 高风险阈值",
    });
    return {
      required: true,
      trigger: isHigh && !escalated ? "first-high" : "escalation",
      conflicts,
    };
  }
  return { required: false, trigger: "escalation", conflicts: [] };
}

// ---------- 提交整体评估：缺条目 / 复测 7 天 / 冻结更正 / 闸门 ----------

export interface SubmitInput {
  caseId: string;
  scale: ScaleVersion;
  testDate: string;
  answers: ItemAnswer[];
  kind: "initial" | "retest" | "correction";
  correctionOfId?: string;
  reason?: string;
  contact?: { content: string; counselor: string; deadline: string };
}

export interface SubmitEvaluation {
  ok: boolean;
  total: number;
  level: RiskLevel;
  subscales: { code: string; name: string; score: number }[];
  missing: string[];
  /** 阻断性错误：任一存在即整单拒绝 */
  rejections: string[];
  /** 复测被拒时的结构化提示 */
  retestBlock?: {
    caseCode: string;
    scaleName: string;
    previousDate: string;
    remainingDays: number;
  };
  /** 冲突清单：个案、量表、原值、新值、触发规则 */
  conflicts: ConflictDetail[];
  gateRequired: boolean;
  gateTrigger?: PlanTrigger;
  previous?: AssessmentVersion;
}

export function evaluateSubmission(
  input: SubmitInput,
  assessments: AssessmentVersion[],
  caseCode: string,
  today: string = todayString()
): SubmitEvaluation {
  const { scale, caseId } = input;
  const rejections: string[] = [];
  const conflicts: ConflictDetail[] = [];

  const scored = scoreAssessment(scale, input.answers);
  const total = scored.total;
  const level = levelForScore(scale, total);

  const previous = latestValid(assessments, caseId, scale.scaleCode);
  const chain = chainOf(assessments, caseId, scale.scaleCode);

  // 1) 缺条目 → 整单拒绝
  if (scored.missing.length > 0) {
    rejections.push(
      `有 ${scored.missing.length} 个条目未作答（${scored.missing.join("、")}），按量表版本必须全部录入`
    );
  }

  // 2) 越界值
  for (const answer of input.answers) {
    const item = scale.items.find((i) => i.code === answer.itemCode);
    if (item && (answer.value < item.min || answer.value > item.max)) {
      rejections.push(`条目 ${answer.itemCode} 录入值 ${answer.value} 超出 ${item.min}–${item.max} 范围`);
    }
  }

  // 3) 更正模式：原版本必须存在且已冻结
  let correctionTarget: AssessmentVersion | undefined;
  if (input.kind === "correction") {
    correctionTarget = chain.find((a) => a.id === input.correctionOfId);
    if (!correctionTarget) {
      rejections.push("更正目标版本不存在，无法生成新版本");
    } else {
      if (correctionTarget.status !== "valid") {
        rejections.push(`v${correctionTarget.seq} 已被替代冻结，只能更正当前有效版本`);
        conflicts.push({
          label: `v${correctionTarget.seq} 状态`,
          oldValue: "valid",
          newValue: "superseded",
          rule: "R-FREEZE 已冻结版本",
        });
      }
      if (!input.reason?.trim()) {
        rejections.push("更正必须登记原因");
      }
    }
  }

  // 4) 非更正：7 天复测限制（只看“有效”测评）
  let retestBlock: SubmitEvaluation["retestBlock"];
  if (input.kind !== "correction" && previous && input.testDate) {
    const elapsed = diffDays(previous.testDate, input.testDate);
    if (elapsed < RETEST_INTERVAL_DAYS) {
      const remaining = RETEST_INTERVAL_DAYS - elapsed;
      retestBlock = {
        caseCode,
        scaleName: scale.name,
        previousDate: previous.testDate,
        remainingDays: remaining,
      };
      rejections.push(
        `个案 ${caseCode} 的 ${scale.name} 距前次有效测评 ${previous.testDate} 仅 ${elapsed} 天，` +
          `不足 ${RETEST_INTERVAL_DAYS} 天，剩余 ${remaining} 天`
      );
      conflicts.push({
        label: "复测间隔",
        oldValue: `前次 ${previous.testDate}（v${previous.seq}）`,
        newValue: `本次 ${input.testDate}（间隔 ${elapsed} 天）`,
        rule: `R-RETEST 间隔须 ≥ ${RETEST_INTERVAL_DAYS} 天，剩余 ${remaining} 天`,
      });
    }
  }

  // 5) R-GATE：升级 / 高风险必须登记联系计划（更正同样适用）
  const baseline =
    input.kind === "correction"
      ? chain.filter((a) => a.id !== correctionTarget?.id && a.status === "valid").at(-1)
      : previous;
  const gate = evaluateGate(scale, baseline, total, level);
  if (gate.required) {
    conflicts.push(...gate.conflicts);
    const c = input.contact;
    if (!c || !c.content.trim() || !c.counselor.trim() || !c.deadline) {
      rejections.push("总分升级或达到高风险阈值，必须登记联系计划、责任咨询师和完成时限，否则整单拒绝");
    } else if (diffDays(today, c.deadline) < 0) {
      rejections.push("完成时限不能早于提交日期");
    }
  }

  return {
    ok: rejections.length === 0,
    total,
    level,
    subscales: scored.subscales,
    missing: scored.missing,
    rejections,
    retestBlock,
    conflicts,
    gateRequired: gate.required,
    gateTrigger: gate.trigger,
    previous,
  };
}

// ---------- 复测提醒 ----------

export interface RetestReminder {
  assessment: AssessmentVersion;
  earliestDate: string;
  remainingDays: number;
  eligible: boolean;
}

export function retestReminder(
  assessment: AssessmentVersion,
  today: string = todayString()
): RetestReminder {
  const earliestDate = addDays(assessment.testDate, RETEST_INTERVAL_DAYS);
  const remainingDays = diffDays(today, earliestDate);
  return {
    assessment,
    earliestDate,
    remainingDays,
    eligible: remainingDays >= 0,
  };
}

export function planStatus(plan: ContactPlan, today: string = todayString()): ContactPlan["status"] {
  if (plan.status === "done") return "done";
  return diffDays(today, plan.deadline) < 0 ? "overdue" : "pending";
}
