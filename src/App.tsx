import { useMemo, useState } from "react";
import "./styles.css";
import { useAppState } from "./ui/useAppState";
import { AssessmentDesk, type CorrectionTarget } from "./ui/components/AssessmentDesk";
import { CaseArchive } from "./ui/components/CaseArchive";
import { RetestBoard } from "./ui/components/RetestBoard";
import { PlanBoard } from "./ui/components/PlanBoard";
import { Rejections } from "./ui/components/Rejections";
import { resetToSeed } from "./state/store";
import { SCALE_VERSIONS } from "./domain/scales";
import { RETEST_INTERVAL_DAYS, daysBetween, lastValidAssessment, todayISO } from "./rules/retest";

type Tab = "desk" | "archive" | "retest" | "plans" | "rejections";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "desk", label: "测评录入" },
  { key: "archive", label: "个案档案" },
  { key: "retest", label: "复测跟踪" },
  { key: "plans", label: "联系计划" },
  { key: "rejections", label: "拒绝记录" },
];

function App() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>("desk");
  const [correction, setCorrection] = useState<CorrectionTarget | null>(null);
  const today = todayISO();

  const metrics = useMemo(() => {
    const scaleIds = [...new Set(SCALE_VERSIONS.map((entry) => entry.scaleId))];
    const highRisk = state.clients.filter((client) =>
      state.assessments.some(
        (entry) => entry.clientId === client.id && entry.risk === "high" && !entry.supersededById,
      ),
    ).length;
    const pendingPlans = state.plans.filter((plan) => plan.status === "pending").length;
    const overduePlans = state.plans.filter(
      (plan) => plan.status === "pending" && plan.dueDate < today,
    ).length;
    const frozenRetest = state.clients.reduce((sum, client) => {
      const blocked = scaleIds.some((scaleId) => {
        const last = lastValidAssessment(state.assessments, client.id, scaleId);
        return last !== undefined && daysBetween(last.assessDate, today) < RETEST_INTERVAL_DAYS;
      });
      return sum + (blocked ? 1 : 0);
    }, 0);
    return { highRisk, pendingPlans, overduePlans, frozenRetest };
  }, [state, today]);

  function openCorrection(target: CorrectionTarget) {
    setCorrection(target);
    setTab("desk");
  }

  function exitCorrection() {
    setCorrection(null);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-12 · 测评与复测跟踪台</p>
          <h1>心理咨询个案测评管理</h1>
          <p className="subtitle">
            按量表版本录入条目，正反向计分生成总分与风险等级；高风险或升级强制登记联系计划；
            同量表七天内禁止复测；已完成测评冻结，更正生成新版本并完整保留原数据。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈（未新增依赖）</span>
          <strong>React 19 + Vite + TypeScript</strong>
          <span className="muted-note">领域数据 / 计算规则 / 界面分层 · localStorage 持久化</span>
          <button className="reset-btn" onClick={resetToSeed}>
            恢复演示数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>活跃个案</span>
          <strong>{state.clients.length}</strong>
          <i className="status-ok" />
        </article>
        <article className="metric-card">
          <span>当前高风险个案</span>
          <strong>{metrics.highRisk}</strong>
          <i className="status-danger" />
        </article>
        <article className="metric-card">
          <span>待完成联系计划（逾期 {metrics.overduePlans}）</span>
          <strong>{metrics.pendingPlans}</strong>
          <i className="status-watch" />
        </article>
        <article className="metric-card">
          <span>复测冻结中个案</span>
          <strong>{metrics.frozenRetest}</strong>
          <i className="status-watch" />
        </article>
      </section>

      <nav className="tab-bar">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            className={tab === entry.key ? "tab active" : "tab"}
            onClick={() => {
              setTab(entry.key);
              if (entry.key !== "desk") setCorrection(null);
            }}
          >
            {entry.label}
            {entry.key === "rejections" && state.rejections.length > 0 && (
              <b className="tab-badge">{state.rejections.length}</b>
            )}
          </button>
        ))}
      </nav>

      {tab === "desk" && (
        <AssessmentDesk
          state={state}
          correction={correction}
          onCorrectionDone={() => {
            exitCorrection();
            setTab("archive");
          }}
        />
      )}
      {tab === "archive" && <CaseArchive state={state} onCorrect={openCorrection} />}
      {tab === "retest" && <RetestBoard state={state} />}
      {tab === "plans" && <PlanBoard state={state} />}
      {tab === "rejections" && <Rejections state={state} />}
    </main>
  );
}

export default App;
