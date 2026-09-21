// 领域数据模型：个案、量表版本、测评版本、联系计划、触发记录
// 本文件只描述数据结构，不包含任何界面逻辑。

export type RiskLevel = "stable" | "watch" | "moderate" | "high";

export type ScaleCode = "PHQ9" | "GAD7" | "RSES";

/** 条目选项：value 为录入值，reverse 条目计分前按 (max + min - value) 翻转 */
export interface ScaleItem {
  code: string;
  text: string;
  reverse: boolean;
  min: number;
  max: number;
}

export interface SubscaleDef {
  code: string;
  name: string;
  itemCodes: string[];
}

/** 具体版本的量表：录入条目与正反向计分均按版本绑定 */
export interface ScaleVersion {
  scaleCode: ScaleCode;
  version: string;
  name: string;
  publishedAt: string;
  instruction: string;
  optionsLabel: string[];
  items: ScaleItem[];
  subscales: SubscaleDef[];
  /** 总分分段（左闭右开，最后一段封顶 Infinity） */
  bands: { min: number; max: number; level: RiskLevel }[];
  /** 达到或超过该总分即高风险阈值 */
  highRiskThreshold: number;
}

export type CaseTag = "焦虑" | "抑郁" | "亲密关系" | "亲子" | "职业压力" | "自尊";

export interface CaseRecord {
  id: string;
  code: string;
  alias: string;
  tag: CaseTag;
  createdAt: string;
}

export type AssessmentStatus = "valid" | "superseded";
export type AssessmentKind = "initial" | "retest" | "correction";

export interface ItemAnswer {
  itemCode: string;
  value: number;
}

export interface AssessmentVersion {
  id: string;
  caseId: string;
  scaleCode: ScaleCode;
  version: string;
  /** 同一(个案,量表)下线性递增的序号：初测=1，复测/更正依次 +1 */
  seq: number;
  kind: AssessmentKind;
  /** 更正自哪一版（仅 kind=correction） */
  correctionOfId?: string;
  reason?: string;
  testDate: string;
  itemAnswers: ItemAnswer[];
  subscaleScores: { code: string; name: string; score: number }[];
  totalScore: number;
  riskLevel: RiskLevel;
  status: AssessmentStatus;
  /** 被哪一版更正替代（保留原记录，不删除） */
  supersededById?: string;
  createdAt: string;
}

export type PlanStatus = "pending" | "done" | "overdue";
export type PlanTrigger = "first-high" | "escalation";

export interface ContactPlan {
  id: string;
  caseId: string;
  scaleCode: ScaleCode;
  assessmentId: string;
  trigger: PlanTrigger;
  content: string;
  counselor: string;
  deadline: string;
  status: PlanStatus;
  completedAt?: string;
  createdAt: string;
}

export type RuleCode =
  | "R-SCORE"
  | "R-GATE"
  | "R-RETEST"
  | "R-FREEZE"
  | "R-PERSIST";

export type TriggerOutcome = "accepted" | "rejected" | "conflict";

export interface TriggerLogEntry {
  id: string;
  at: string;
  outcome: TriggerOutcome;
  rule: RuleCode;
  caseId?: string;
  scaleCode?: ScaleCode;
  message: string;
  /** 冲突时逐项展示：原值 / 新值 / 触发规则 */
  conflicts?: ConflictDetail[];
}

export interface ConflictDetail {
  label: string;
  oldValue: string;
  newValue: string;
  rule: string;
}

export interface AppState {
  cases: CaseRecord[];
  scales: ScaleVersion[];
  assessments: AssessmentVersion[];
  plans: ContactPlan[];
  logs: TriggerLogEntry[];
}
