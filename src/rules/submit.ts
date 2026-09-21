// 提交规则（整单校验，任一冲突即拒绝）：
// 1. 条目必须按版本全部作答；
// 2. 新建测评受七天复测间隔约束（更正不占用复测资格、不受此限）；
// 3. 更正必须填写原因，生成新版本并保留原版本；
// 4. 总分达到高风险阈值或相对前次升级时，必须登记联系计划、责任咨询师、完成时限。

import { getScale, RISK_LABEL } from "../domain/scales";
import type {
  Assessment,
  PlanTrigger,
  RiskLevel,
  RuleConflict,
} from "../domain/types";
import { checkRetest } from "./retest";
import { isEscalation, scoreAnswers } from "./scoring";

export interface PlanDraft {
  method: string;
  counselor: string;
  dueDate: string;
}

export interface SubmitDraft {
  action: "new" | "correction";
  clientId: string;
  scaleKey: string;
  assessDate: string;
  answers: Record<string, number>;
  plan: Partial<PlanDraft>;
  reason?: string;
  correctsId?: string;
}

export interface Evaluation {
  blocked: boolean;
  conflicts: RuleConflict[];
  planRequired: boolean;
  trigger?: PlanTrigger;
  baseline?: Assessment;
  baselineRisk?: RiskLevel;
  score: ReturnType<typeof scoreAnswers>;
}

const RULE_LABELS = {
  ITEMS_MISSING: "条目必须全部作答",
  ASSESS_DATE_REQUIRED: "测评日期必填",
  RETEST_TOO_SOON: "七天复测间隔",
  CORRECTION_REASON_REQUIRED: "更正须填写原因并生成新版本",
  PLAN_FIELDS_REQUIRED: "高风险/升级须登记联系计划",
};

function baseConflict(
  draft: SubmitDraft,
  rule: keyof typeof RULE_LABELS,
  extra: Partial<RuleConflict>,
): RuleConflict {
  const scale = getScale(draft.scaleKey);
  return {
    rule,
    ruleLabel: RULE_LABELS[rule],
    clientId: draft.clientId,
    scaleId: scale.scaleId,
    detail: "",
    ...extra,
  };
}

export function evaluateSubmission(
  assessments: Assessment[],
  draft: SubmitDraft,
): Evaluation {
  const scale = getScale(draft.scaleKey);
  const score = scoreAnswers(scale, draft.answers);
  const conflicts: RuleConflict[] = [];

  // 0. 测评日期
  if (!draft.assessDate) {
    conflicts.push(
      baseConflict(draft, "ASSESS_DATE_REQUIRED", {
        field: "测评日期",
        oldValue: "",
        newValue: "（空）",
        detail: "提交测评必须填写测评日期。",
      }),
    );
  }

  // 1. 条目完整性
  if (!score.completed) {
    conflicts.push(
      baseConflict(draft, "ITEMS_MISSING", {
        field: "条目作答",
        oldValue: "",
        newValue: `缺 ${score.missing.length} 条：${score.missing.join("、")}`,
        detail: `量表 ${scale.scaleKey} 共 ${scale.items.length} 条，未作答 ${score.missing.join("、")}，不生成总分。`,
      }),
    );
  }

  // 2. 七天复测间隔（仅新建；更正沿用原测评日期，不触发复测）
  const retest =
    draft.action === "new" && draft.assessDate
      ? checkRetest(assessments, draft.clientId, scale.scaleId, draft.assessDate)
      : undefined;

  if (retest && !retest.allowed && retest.last) {
    conflicts.push(
      baseConflict(draft, "RETEST_TOO_SOON", {
        field: "测评日期",
        oldValue: `前次有效测评 ${retest.last.assessDate}（${retest.last.scaleKey}）`,
        newValue: `本次提交 ${draft.assessDate}（${scale.scaleKey}），仅间隔 ${retest.elapsedDays} 天`,
        prevDate: retest.last.assessDate,
        remainingDays: retest.remainingDays,
        detail:
          `个案 ${draft.clientId} 的量表 ${scale.scaleName} 距上次有效测评不足七天：` +
          `前次日期 ${retest.last.assessDate}，剩余 ${retest.remainingDays} 天后方可复测。`,
      }),
    );
  }

  // 3. 更正原因
  if (draft.action === "correction" && !(draft.reason ?? "").trim()) {
    const original = draft.correctsId
      ? assessments.find((entry) => entry.id === draft.correctsId)
      : undefined;
    conflicts.push(
      baseConflict(draft, "CORRECTION_REASON_REQUIRED", {
        field: "更正原因",
        oldValue: original
          ? `原版本 r${original.revision}（已冻结）`
          : "原版本（已冻结）",
        newValue: "（空）",
        detail: "已完成测评已冻结；更正必须登记原因，系统据此生成新版本并保留原条目与分数。",
      }),
    );
  }

  // 4. 高风险 / 升级 → 强制联系计划
  // 更正比对原版本；新建比对同量表前次有效测评。
  let baseline: Assessment | undefined;
  if (draft.action === "correction" && draft.correctsId) {
    baseline = assessments.find((entry) => entry.id === draft.correctsId);
  } else {
    baseline = retest?.last;
  }

  const baselineRisk = baseline?.risk;
  const planRequired =
    score.completed &&
    (score.risk === "high" || isEscalation(baselineRisk, score.risk));

  let trigger: PlanTrigger | undefined;
  if (planRequired) {
    trigger = score.risk === "high" ? "high" : "escalation";
    const newLabel = RISK_LABEL[score.risk];
    const oldLabel = baselineRisk ? RISK_LABEL[baselineRisk] : "无历史测评";
    const reason =
      score.risk === "high"
        ? `总分 ${score.total} 达到高风险阈值（${scale.scaleKey}）`
        : `风险等级由「${oldLabel}」升级为「${newLabel}」（总分 ${score.total}）`;

    const planChecks: Array<{ key: keyof PlanDraft; label: string }> = [
      { key: "method", label: "联系计划" },
      { key: "counselor", label: "责任咨询师" },
      { key: "dueDate", label: "完成时限" },
    ];
    planChecks.forEach(({ key, label }) => {
      const value = draft.plan[key] ?? "";
      if (!value.trim()) {
        conflicts.push(
          baseConflict(draft, "PLAN_FIELDS_REQUIRED", {
            field: label,
            oldValue: `前次风险等级：${oldLabel}`,
            newValue: `新风险等级：${newLabel}`,
            detail: `${reason}，必须登记${label}，当前缺失，整单拒绝。`,
          }),
        );
      }
    });
  }

  return {
    blocked: conflicts.length > 0,
    conflicts,
    planRequired,
    trigger,
    baseline,
    baselineRisk,
    score,
  };
}
