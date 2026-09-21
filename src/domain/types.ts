// 领域类型：个案、量表版本、测评、联系计划、规则冲突
// 只描述领域概念，不包含任何计算逻辑与界面代码。

export type RiskLevel = "stable" | "watch" | "risk" | "high";

export type ItemDirection = "forward" | "reverse";

export interface ScaleItem {
  code: string; // 条目编号 Q1...
  text: string; // 条目表述
  direction: ItemDirection; // 正向 / 反向计分
  subscale: string; // 所属分项
}

export interface RiskBand {
  min: number;
  max: number;
  level: RiskLevel;
}

export interface ScaleVersion {
  scaleId: string; // 量表标识（同一量表不同版本共用）
  scaleName: string;
  version: string; // 版本号
  scaleKey: string; // scaleId@version，录入按版本选择
  releasedOn: string;
  note: string;
  optionValues: number[]; // 可选原始分值
  optionLabels: string[]; // 对应文案
  items: ScaleItem[];
  bands: RiskBand[]; // 总分区间 -> 风险等级
}

export interface Client {
  id: string; // 来访者代号 C-042
  name: string;
  theme: string; // 咨询主题
  counselor: string; // 默认责任咨询师
  createdAt: string;
}

export interface Assessment {
  id: string;
  clientId: string;
  scaleId: string;
  scaleKey: string;
  version: string;
  revision: number; // 同一测评的更正版次：1 为首版，更正递增
  assessDate: string; // 测评日期
  itemScores: Record<string, number>; // 条目原始作答（冻结保留）
  subscaleScores: Record<string, number>; // 分项分（冻结保留）
  total: number; // 总分（冻结保留）
  risk: RiskLevel; // 风险等级（冻结保留）
  status: "frozen"; // 已完成即冻结
  submittedAt: string;
  createdFrom:
    | { kind: "new" }
    | { kind: "correction"; correctsId: string; reason: string };
  contactPlanId?: string;
  supersededById?: string; // 被哪个更正版本取代
}

export type PlanTrigger = "high" | "escalation";

export interface ContactPlan {
  id: string;
  clientId: string;
  scaleId: string;
  scaleKey: string;
  assessmentId: string;
  assessDate: string;
  revision: number;
  method: string; // 联系计划（方式与内容）
  counselor: string; // 责任咨询师
  dueDate: string; // 完成时限
  trigger: PlanTrigger;
  status: "pending" | "done";
  createdAt: string;
}

export interface RuleConflict {
  rule: string; // 触发规则代码
  ruleLabel: string; // 触发规则名称
  clientId: string;
  scaleId?: string;
  field?: string; // 冲突字段
  oldValue?: string; // 原值
  newValue?: string; // 新值
  detail: string; // 说明（含剩余天数等）
  prevDate?: string;
  remainingDays?: number;
}

export interface RejectionRecord {
  id: string;
  at: string;
  action: "new" | "correction";
  clientId: string;
  scaleKey: string;
  assessDate: string;
  conflicts: RuleConflict[];
}

export interface AppState {
  clients: Client[];
  assessments: Assessment[];
  plans: ContactPlan[];
  rejections: RejectionRecord[];
}
