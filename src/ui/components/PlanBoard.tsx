// 联系计划跟踪：所有因「高风险阈值 / 风险升级」强制登记的计划、责任咨询师与时限。

import type { AppState } from "../../domain/types";
import { setPlanStatus } from "../../state/store";
import { todayISO } from "../../rules/retest";
import { RiskBadge } from "./Shared";

export function PlanBoard({ state }: { state: AppState }) {
  const today = todayISO();
  const sorted = [...state.plans].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>总分升级或达到高风险阈值时强制生成</p>
          <h2>联系计划（{state.plans.length}）</h2>
        </div>
        <span className="muted-note">
          待完成 {state.plans.filter((p) => p.status === "pending").length} · 已完成{" "}
          {state.plans.filter((p) => p.status === "done").length}
        </span>
      </div>

      <div className="plan-list">
        {sorted.length === 0 && <p className="muted-note">暂无联系计划。</p>}
        {sorted.map((plan) => {
          const assessment = state.assessments.find((entry) => entry.id === plan.assessmentId);
          const overdue = plan.status === "pending" && plan.dueDate < today;
          return (
            <article key={plan.id} className={`plan-card ${overdue ? "overdue" : ""} ${plan.status}`}>
              <div className="plan-main">
                <div className="plan-title">
                  <strong>
                    {plan.clientId} · {plan.scaleKey} · r{plan.revision}
                  </strong>
                  <span className={`trigger-tag trigger-${plan.trigger}`}>
                    {plan.trigger === "high" ? "高风险阈值" : "风险升级"}
                  </span>
                  {plan.status === "done" ? (
                    <span className="state-tag ready">已完成</span>
                  ) : overdue ? (
                    <span className="state-tag blocked">已逾期（时限 {plan.dueDate}）</span>
                  ) : (
                    <span className="state-tag watch">待完成 · 时限 {plan.dueDate}</span>
                  )}
                </div>
                <p className="plan-method">{plan.method}</p>
                <p className="plan-meta">
                  责任咨询师：<b>{plan.counselor}</b> · 测评日期 {plan.assessDate} · 完成时限 {plan.dueDate}
                  {assessment && (
                    <span className="plan-score">
                      {" "}
                      · 触发时总分 {assessment.total} <RiskBadge level={assessment.risk} />
                    </span>
                  )}
                </p>
              </div>
              <div className="plan-actions">
                {plan.status === "pending" ? (
                  <button onClick={() => setPlanStatus(plan.id, "done")}>标记已完成</button>
                ) : (
                  <button onClick={() => setPlanStatus(plan.id, "pending")}>撤销完成</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
