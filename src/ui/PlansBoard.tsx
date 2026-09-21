import { PLAN_TRIGGER_LABEL } from "../domain/rules";
import type { AppState } from "../domain/types";
import { completePlan, effectivePlanStatus } from "../state/store";
import { Empty, Panel, RiskBadge, ScaleTag } from "./components";

export function PlansBoard({
  state,
  gotoCase,
}: {
  state: AppState;
  gotoCase: (caseId: string) => void;
}) {
  const groups = [
    { key: "pending", title: "待办", match: (s: string) => s === "pending" },
    { key: "overdue", title: "已逾期", match: (s: string) => s === "overdue" },
    { key: "done", title: "已完成", match: (s: string) => s === "done" },
  ] as const;

  return (
    <div className="stack-gap">
      {groups.map((group) => {
        const plans = state.plans.filter((p) => group.match(effectivePlanStatus(p)));
        return (
          <Panel key={group.key} title={`${group.title}（${plans.length}）`} hint="所有计划均由 R-GATE 在提交接受时强制生成">
            {plans.length === 0 && <Empty>暂无{group.title}计划</Empty>}
            <div className="plans-grid">
              {plans.map((plan) => {
                const c = state.cases.find((x) => x.id === plan.caseId)!;
                const a = state.assessments.find((x) => x.id === plan.assessmentId);
                const status = effectivePlanStatus(plan);
                return (
                  <article key={plan.id} className={`plan-card plan-${status}`}>
                    <header>
                      <button className="plan-case-btn" onClick={() => gotoCase(plan.caseId)}>
                        <strong>{c.code}</strong> <RiskBadge level={a?.riskLevel ?? "stable"} size="sm" />
                      </button>
                      <ScaleTag code={plan.scaleCode} />
                      <span className="pill pill-trigger">{PLAN_TRIGGER_LABEL[plan.trigger]}</span>
                    </header>
                    <p className="plan-content">{plan.content}</p>
                    <dl className="plan-meta">
                      <div><dt>责任咨询师</dt><dd>{plan.counselor}</dd></div>
                      <div><dt>完成时限</dt><dd>{plan.deadline}</dd></div>
                      <div><dt>登记时间</dt><dd>{plan.createdAt.replace("T", " ")}</dd></div>
                      {plan.completedAt && <div><dt>完成时间</dt><dd>{plan.completedAt.replace("T", " ")}</dd></div>}
                    </dl>
                    {status !== "done" && (
                      <button className="primary-action plan-done-btn" onClick={() => completePlan(plan.id)}>
                        标记已完成
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
