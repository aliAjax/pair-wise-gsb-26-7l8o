import { useSyncExternalStore } from "react";
import { chainOf, evaluateSubmission, levelForScore, planStatus, scoreAssessment, todayString } from "../domain/rules";
import { buildSeedState, SCALE_LOOKUP } from "../domain/seed";
import type {
  AppState,
  AssessmentVersion,
  CaseRecord,
  CaseTag,
  ContactPlan,
  ScaleCode,
  TriggerLogEntry,
  TriggerOutcome,
} from "../domain/types";

// 状态层：只负责装配规则结果、持久化与订阅；业务判定一律调用 domain/rules。

const STORAGE_KEY = "hxwl-12-assessment-console-v1";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    // 数据损坏时回落到演示数据
  }
  return buildSeedState();
}

let state: AppState = loadState();
const listeners = new Set<() => void>();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function log(
  entry: Omit<TriggerLogEntry, "id" | "at"> & { at?: string }
) {
  state.logs.unshift({
    id: nextId("log"),
    at: entry.at ?? new Date().toISOString().slice(0, 16),
    ...entry,
  });
}

// ---------- 派生快照：刷新后重算计划状态，保证各处展示一致 ----------

export function getSnapshot(): AppState {
  return state;
}

/** 计划状态按今天重算：存储里只保留 done 标记，pending/overdue 刷新即重算 */
export function effectivePlanStatus(plan: ContactPlan): ContactPlan["status"] {
  return planStatus(plan, todayString());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue) as AppState;
      } catch {
        // 忽略无法解析的跨页写入
      }
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---------- 操作 ----------

export interface SubmitDraft {
  caseId: string;
  scaleCode: ScaleCode;
  testDate: string;
  values: Record<string, number>;
  kind: "initial" | "retest" | "correction";
  correctionOfId?: string;
  reason?: string;
  contact?: { content: string; counselor: string; deadline: string };
}

export interface SubmitResult {
  ok: boolean;
  evaluation?: ReturnType<typeof evaluateSubmission>;
  assessment?: AssessmentVersion;
}

export function submitAssessment(draft: SubmitDraft): SubmitResult {
  const scale = SCALE_LOOKUP[draft.scaleCode];
  const caseRecord = state.cases.find((c) => c.id === draft.caseId);
  if (!caseRecord) return { ok: false };

  const answers = scale.items.map((item) => ({ itemCode: item.code, value: draft.values[item.code] }));
  const evaluation = evaluateSubmission(
    {
      caseId: draft.caseId,
      scale,
      testDate: draft.testDate,
      answers,
      kind: draft.kind,
      correctionOfId: draft.correctionOfId,
      reason: draft.reason,
      contact: draft.contact,
    },
    state.assessments,
    caseRecord.code
  );

  if (!evaluation.ok) {
    const outcome: TriggerOutcome = evaluation.retestBlock || evaluation.conflicts.length > 0 ? "conflict" : "rejected";
    log({
      outcome,
      rule: evaluation.retestBlock ? "R-RETEST" : evaluation.gateRequired ? "R-GATE" : "R-SCORE",
      caseId: draft.caseId,
      scaleCode: draft.scaleCode,
      message:
        evaluation.retestBlock != null
          ? `个案 ${caseRecord.code}「${scale.name}」提前复测被拒：前次 ${evaluation.retestBlock.previousDate}，剩余 ${evaluation.retestBlock.remainingDays} 天。`
          : `${caseRecord.code}「${scale.name}」提交被整单拒绝：${evaluation.rejections.join("；")}`,
      conflicts: evaluation.conflicts.length > 0 ? evaluation.conflicts : undefined,
    });
    persist();
    return { ok: false, evaluation };
  }

  // 通过：落新版本（更正时冻结原版本，保留其全部原值）
  const chain = chainOf(state.assessments, draft.caseId, draft.scaleCode);
  const seq = chain.length + 1;
  const previous = evaluation.previous;

  let correctionTarget: AssessmentVersion | undefined;
  if (draft.kind === "correction") {
    correctionTarget = state.assessments.find((a) => a.id === draft.correctionOfId);
  }

  const assessment: AssessmentVersion = {
    id: nextId("asmt"),
    caseId: draft.caseId,
    scaleCode: draft.scaleCode,
    version: scale.version,
    seq,
    kind: draft.kind,
    correctionOfId: draft.correctionOfId,
    reason: draft.reason?.trim() || undefined,
    testDate: draft.testDate,
    itemAnswers: answers,
    subscaleScores: evaluation.subscales,
    totalScore: evaluation.total,
    riskLevel: evaluation.level,
    status: "valid",
    createdAt: new Date().toISOString().slice(0, 16),
  };

  state.assessments.push(assessment);

  if (correctionTarget) {
    correctionTarget.status = "superseded";
    correctionTarget.supersededById = assessment.id;
  }

  log({
    outcome: "accepted",
    rule: "R-SCORE",
    caseId: draft.caseId,
    scaleCode: draft.scaleCode,
    message:
      draft.kind === "correction" && correctionTarget
        ? `${caseRecord.code}「${scale.name}」更正生效：v${correctionTarget.seq} 冻结保留，生成 v${seq}（${correctionTarget.totalScore} → ${assessment.totalScore}）。`
        : `${caseRecord.code}「${scale.name}」v${seq} 提交成功：总分 ${assessment.totalScore}，风险等级「${levelLabel(evaluation.level)}」。`,
  });

  if (evaluation.gateRequired && draft.contact) {
    const plan: ContactPlan = {
      id: nextId("plan"),
      caseId: draft.caseId,
      scaleCode: draft.scaleCode,
      assessmentId: assessment.id,
      trigger: evaluation.gateTrigger ?? "escalation",
      content: draft.contact.content.trim(),
      counselor: draft.contact.counselor.trim(),
      deadline: draft.contact.deadline,
      status: "pending",
      createdAt: new Date().toISOString().slice(0, 16),
    };
    state.plans.push(plan);
    log({
      outcome: "conflict",
      rule: "R-GATE",
      caseId: draft.caseId,
      scaleCode: draft.scaleCode,
      message:
        (previous
          ? `${caseRecord.code}「${scale.name}」总分升级（${previous.totalScore} → ${assessment.totalScore}）`
          : `${caseRecord.code}「${scale.name}」达到高风险阈值（${assessment.totalScore}）`) +
        `，已登记联系计划，责任咨询师 ${plan.counselor}，时限 ${plan.deadline}。`,
      conflicts: evaluation.conflicts,
    });
  }

  persist();
  return { ok: true, evaluation, assessment };
}

function levelLabel(level: ReturnType<typeof levelForScore>): string {
  return { stable: "稳定", watch: "关注", moderate: "中风险", high: "高风险" }[level];
}

export function completePlan(planId: string) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan || plan.status === "done") return;
  plan.status = "done";
  plan.completedAt = new Date().toISOString().slice(0, 16);
  persist();
}

export function addCase(input: { code: string; alias: string; tag: CaseTag }): CaseRecord | { error: string } {
  const code = input.code.trim();
  const alias = input.alias.trim();
  if (!code || !alias) return { error: "个案代号与称谓都必须填写" };
  if (state.cases.some((c) => c.code === code)) return { error: `个案代号 ${code} 已存在` };
  const record: CaseRecord = {
    id: nextId("case"),
    code,
    alias,
    tag: input.tag,
    createdAt: todayString(),
  };
  state.cases.push(record);
  log({
    outcome: "accepted",
    rule: "R-SCORE",
    caseId: record.id,
    message: `新个案 ${code}（${alias}）建档。`,
  });
  persist();
  return record;
}

export function resetDemo() {
  state = buildSeedState();
  persist();
}

export { scoreAssessment };
