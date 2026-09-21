import { PLAN_TRIGGER_LABEL, RISK_META } from "../domain/rules";
import type { AppState } from "../domain/types";
import { effectivePlanStatus } from "../state/store";
import { Empty, Panel, RiskBadge, ScaleTag } from "./components";
import { selectAllReminders, selectCaseRows, selectMetrics } from "./selectors";

export function Dashboard({
  state,
  goto,
}: {
  state: AppState;
  goto: (tab: string, caseId?: string) => void;
}) {
  const metrics = selectMetrics(state);
  const rows = selectCaseRows(state);
  const reminders = selectAllReminders(state);
  const pendingPlans = state.plans.filter((p) => effectivePlanStatus(p) !== "done");

  const cards = [
    { label: "活跃个案", value: metrics.activeCases, tone: "ok" as const, sub: "建档总量" },
    { label: "高风险关注", value: metrics.highRisk, tone: "danger" as const, sub: "最新有效测评判定" },
    { label: "待办联系计划", value: metrics.pendingPlans, tone: "watch" as const, sub: "含已逾期" },
    { label: "可复测", value: metrics.eligibleRetests, tone: "moderate" as const, sub: "距上次有效测评 ≥ 7 天" },
  ];

  return (
    <div className="stack-gap">
      <section className="metrics-grid">
        {cards.map((card) => (
          <article key={card.label} className="metric-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <em className={`metric-bar bar-${card.tone}`} />
            <small>{card.sub}</small>
          </article>
        ))}
      </section>

      <div className="dash-two-col">
        <Panel title="复测提醒" hint="按最新有效测评计算 · 刷新后自动重算">
          {reminders.length === 0 && <Empty>暂无测评记录</Empty>}
          <div className="reminder-list">
            {reminders.map(({ caseRecord, assessment, reminder }) => {
              const scale = state.scales.find((s) => s.scaleCode === assessment.scaleCode)!;
              return (
                <div
                  key={assessment.id}
                  className={`reminder-row ${reminder.eligible ? "is-eligible" : "is-waiting"}`}
                >
                  <div>
                    <strong>{caseRecord.code}</strong>
                    <span className="muted"> {caseRecord.alias}</span>
                    <div className="reminder-scale">
                      <ScaleTag code={assessment.scaleCode} />
                      <span>{scale.name}</span>
                    </div>
                  </div>
                  <div className="reminder-mid">
                    <RiskBadge level={assessment.riskLevel} size="sm" />
                    <span className="muted">前次 {assessment.testDate} · 总分 {assessment.totalScore}</span>
                  </div>
                  <div className="reminder-right">
                    {reminder.eligible ? (
                      <>
                        <span className="pill pill-ok">窗口已开放（{reminder.earliestDate} 起）</span>
                        <button
                          className="link-btn"
                          onClick={() => goto("entry", caseRecord.id + ":" + assessment.scaleCode)}
                        >
                          发起复测 →
                        </button>
                      </>
                    ) : (
                      <span className="pill pill-wait">
                        剩余 {Math.abs(reminder.remainingDays)} 天（最早 {reminder.earliestDate}）
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="高风险与升级关注" hint="R-GATE 触发记录与待办计划">
          {rows.filter((r) => r.topLevel === "high").length === 0 && pendingPlans.length === 0 && (
            <Empty>当前无高风险个案与待办联系计划</Empty>
          )}
          <div className="watch-list">
            {rows
              .filter((r) => r.topLevel === "high")
              .map((row) => (
                <button
                  key={row.caseRecord.id}
                  className="watch-row"
                  onClick={() => goto("cases", row.caseRecord.id)}
                >
                  <div>
                    <strong>{row.caseRecord.code}</strong> <RiskBadge level="high" size="sm" />
                    <p className="muted">{row.caseRecord.tag} · {row.caseRecord.alias}</p>
                  </div>
                  <span className="link-btn">个案档案 →</span>
                </button>
              ))}
          </div>
          <h3 className="sub-block-title">待办联系计划</h3>
          <div className="plan-mini-list">
            {pendingPlans.length === 0 && <Empty>无待办</Empty>}
                {pendingPlans.map((plan) => {
                  const c = state.cases.find((x) => x.id === plan.caseId)!;
                  const status = effectivePlanStatus(plan);
                  return (
                    <div key={plan.id} className={`plan-mini ${status === "overdue" ? "is-overdue" : ""}`}>
                      <div>
                        <strong>{c.code}</strong> <ScaleTag code={plan.scaleCode} />
                        <span className="pill pill-trigger">{PLAN_TRIGGER_LABEL[plan.trigger]}</span>
                        {status === "overdue" && <span className="pill pill-danger">已逾期</span>}
                    <p className="muted plan-clip">{plan.content}</p>
                  </div>
                  <div className="plan-mini-meta">
                    <span>责任咨询师：{plan.counselor}</span>
                    <span>时限：{plan.deadline}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="最近触发记录" hint="接受 / 拒绝 / 冲突统一留痕">
        <div className="log-table-wrap">
          <table className="log-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>结果</th>
                <th>规则</th>
                <th>个案 / 量表</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {state.logs.slice(0, 6).map((entry) => {
                const c = state.cases.find((x) => x.id === entry.caseId);
                return (
                  <tr key={entry.id}>
                    <td className="nowrap">{entry.at.replace("T", " ")}</td>
                    <td>
                      <span className={`outcome outcome-${entry.outcome}`}>
                        {entry.outcome === "accepted" ? "已接受" : entry.outcome === "rejected" ? "已拒绝" : "冲突"}
                      </span>
                    </td>
                    <td className="nowrap">{entry.rule}</td>
                    <td className="nowrap">
                      {c?.code ?? "—"}{entry.scaleCode ? ` · ${entry.scaleCode}` : ""}
                    </td>
                    <td>{entry.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="table-foot">
          风险等级口径：{Object.entries(RISK_META).map(([k, v]) => `${v.label}=rank${v.rank}`).join("，")}；升级判定以 rank 严格升高为准。
        </p>
      </Panel>
    </div>
  );
}
