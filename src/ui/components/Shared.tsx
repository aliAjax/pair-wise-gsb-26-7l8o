// 共享展示组件：风险徽标与规则冲突表（冲突时展示个案、量表、原值、新值、触发规则）

import { RISK_LABEL } from "../../domain/scales";
import type { RiskLevel, RuleConflict } from "../../domain/types";

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`risk-badge risk-${level}`}>{RISK_LABEL[level]}</span>;
}

export const TRIGGER_LABEL = {
  high: "达到高风险阈值",
  escalation: "风险等级升级",
} as const;

export function ConflictTable({
  conflicts,
  emptyText = "暂无冲突记录",
}: {
  conflicts: RuleConflict[];
  emptyText?: string;
}) {
  if (conflicts.length === 0) {
    return <p className="muted-note">{emptyText}</p>;
  }
  return (
    <div className="conflict-wrap">
      <table className="conflict-table">
        <thead>
          <tr>
            <th>个案</th>
            <th>量表</th>
            <th>字段</th>
            <th>原值</th>
            <th>新值</th>
            <th>触发规则</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map((conflict, index) => (
            <tr key={`${conflict.rule}-${index}`}>
              <td>{conflict.clientId}</td>
              <td>{conflict.scaleId ?? "—"}</td>
              <td>{conflict.field ?? "—"}</td>
              <td className="old-value">{conflict.oldValue ?? "—"}</td>
              <td className="new-value">{conflict.newValue ?? "—"}</td>
              <td>
                <span className="rule-pill">{conflict.ruleLabel}</span>
                <p className="conflict-detail">{conflict.detail}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
