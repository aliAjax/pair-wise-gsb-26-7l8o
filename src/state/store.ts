// 状态层：领域数据的唯一变更入口；持久化到 localStorage，刷新后一致。
// store 本体为框架无关的发布订阅；React 侧通过 useSyncExternalStore 订阅。

import type {
  AppState,
  Assessment,
  Client,
  ContactPlan,
  PlanTrigger,
  RejectionRecord,
  RuleConflict,
} from "../domain/types";
import { getScale } from "../domain/scales";
import { buildSeedState } from "./seed";
import { checkRetest } from "../rules/retest";
import { scoreAnswers } from "../rules/scoring";
import { evaluateSubmission, type PlanDraft, type SubmitDraft } from "../rules/submit";

const STORAGE_KEY = "hxwl-12-assessment-tracker:v1";

type Listener = () => void;

let state: AppState = loadState();
const listeners = new Set<Listener>();

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    // 存储不可用时退回演示数据
  }
  return buildSeedState();
}

function persist(next: AppState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略写入失败（如隐私模式），内存态仍可用
  }
  listeners.forEach((listener) => listener());
}

export function getState(): AppState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function nextId(prefix: "A" | "P" | "R" | "C"): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${stamp}${rand}`;
}

export interface SubmitOutcome {
  ok: boolean;
  conflicts: RuleConflict[];
  assessmentId?: string;
}

// 提交（新建/更正）：先跑规则，冲突则整单拒绝并记录拒绝单，不写入任何测评数据
export function submitAssessment(draft: SubmitDraft): SubmitOutcome {
  const evaluation = evaluateSubmission(state.assessments, draft);
  const scale = getScale(draft.scaleKey);

  if (evaluation.blocked) {
    const rejection: RejectionRecord = {
      id: nextId("R"),
      at: new Date().toISOString(),
      action: draft.action,
      clientId: draft.clientId,
      scaleKey: draft.scaleKey,
      assessDate: draft.assessDate,
      conflicts: evaluation.conflicts,
    };
    persist({ ...state, rejections: [rejection, ...state.rejections] });
    return { ok: false, conflicts: evaluation.conflicts };
  }

  const score = evaluation.score;
  let assessment: Assessment;
  let plan: ContactPlan | undefined;

  if (draft.action === "correction" && draft.correctsId) {
    const original = state.assessments.find((entry) => entry.id === draft.correctsId);
    if (!original) {
      const conflict: RuleConflict = {
        rule: "ORIGINAL_NOT_FOUND",
        ruleLabel: "原测评不存在",
        clientId: draft.clientId,
        scaleId: scale.scaleId,
        detail: "更正所指向的原测评已不存在，无法生成新版本。",
      };
      return { ok: false, conflicts: [conflict] };
    }
    assessment = {
      id: nextId("A"),
      clientId: draft.clientId,
      scaleId: scale.scaleId,
      scaleKey: draft.scaleKey,
      version: scale.version,
      revision: original.revision + 1,
      assessDate: original.assessDate, // 更正沿用原测评日期，不占用复测资格
      itemScores: score.itemScores,
      subscaleScores: score.subscaleScores,
      total: score.total,
      risk: score.risk,
      status: "frozen",
      submittedAt: new Date().toISOString(),
      createdFrom: {
        kind: "correction",
        correctsId: original.id,
        reason: (draft.reason ?? "").trim(),
      },
    };
    if (evaluation.planRequired && evaluation.trigger) {
      plan = buildPlan(assessment, draft.plan as PlanDraft, evaluation.trigger);
      assessment.contactPlanId = plan.id;
    }
    const nextAssessments = [
      ...state.assessments.map((entry) =>
        entry.id === original.id ? { ...entry, supersededById: assessment!.id } : entry,
      ),
      assessment,
    ];
    persist({
      ...state,
      assessments: nextAssessments,
      plans: plan ? [...state.plans, plan] : state.plans,
    });
  } else {
    assessment = {
      id: nextId("A"),
      clientId: draft.clientId,
      scaleId: scale.scaleId,
      scaleKey: draft.scaleKey,
      version: scale.version,
      revision: 1,
      assessDate: draft.assessDate,
      itemScores: score.itemScores,
      subscaleScores: score.subscaleScores,
      total: score.total,
      risk: score.risk,
      status: "frozen",
      submittedAt: new Date().toISOString(),
      createdFrom: { kind: "new" },
    };
    if (evaluation.planRequired && evaluation.trigger) {
      plan = buildPlan(assessment, draft.plan as PlanDraft, evaluation.trigger);
      assessment.contactPlanId = plan.id;
    }
    persist({
      ...state,
      assessments: [assessment, ...state.assessments],
      ...(plan ? { plans: [plan, ...state.plans] } : {}),
    });
  }

  return { ok: true, conflicts: [], assessmentId: assessment.id };
}

function buildPlan(
  assessment: Assessment,
  draft: PlanDraft,
  trigger: PlanTrigger,
): ContactPlan {
  return {
    id: nextId("P"),
    clientId: assessment.clientId,
    scaleId: assessment.scaleId,
    scaleKey: assessment.scaleKey,
    assessmentId: assessment.id,
    assessDate: assessment.assessDate,
    revision: assessment.revision,
    method: draft.method.trim(),
    counselor: draft.counselor.trim(),
    dueDate: draft.dueDate,
    trigger,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function setPlanStatus(planId: string, status: ContactPlan["status"]) {
  persist({
    ...state,
    plans: state.plans.map((plan) => (plan.id === planId ? { ...plan, status } : plan)),
  });
}

export function addClient(input: { id: string; name: string; theme: string; counselor: string }): boolean {
  const id = input.id.trim().toUpperCase();
  if (!id || state.clients.some((client) => client.id === id)) return false;
  const client: Client = {
    id,
    name: input.name.trim() || `来访者 ${id}`,
    theme: input.theme.trim() || "未分类",
    counselor: input.counselor.trim() || "未分配",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  persist({ ...state, clients: [...state.clients, client] });
  return true;
}

export function resetToSeed() {
  persist(buildSeedState());
}

// 只读派生：某个案 × 量表的复测状态（复测提醒与录入界面共用）
export function retestStatusOf(clientId: string, scaleId: string, atDate: string) {
  return checkRetest(state.assessments, clientId, scaleId, atDate);
}

export { scoreAnswers };
