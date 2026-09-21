import { useState } from "react";
import "./styles.css";
import type { ScaleCode } from "./domain/types";
import { resetDemo, useAppState } from "./state/store";
import { AssessmentEntry, type EntryPrefill } from "./ui/AssessmentEntry";
import { CaseFiles } from "./ui/CaseFiles";
import { Dashboard } from "./ui/Dashboard";
import { PlansBoard } from "./ui/PlansBoard";
import { RuleCenter } from "./ui/RuleCenter";

const TABS = [
  { key: "dashboard", label: "跟踪台" },
  { key: "entry", label: "测评录入" },
  { key: "cases", label: "个案档案" },
  { key: "plans", label: "联系计划" },
  { key: "rules", label: "规则与记录" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function App() {
  const state = useAppState();
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [prefill, setPrefill] = useState<EntryPrefill & { selectedCase?: string }>({});

  function goto(next: string, payload?: string) {
    if (next === "entry" && payload) {
      const [caseId, scaleCode] = payload.split(":") as [string, ScaleCode?];
      setPrefill({ caseId, scaleCode });
    }
    setTab(next as TabKey);
  }

  function correctFromArchive(caseId: string, scaleCode: ScaleCode, assessmentId: string) {
    setPrefill({ caseId, scaleCode, correctionOfId: assessmentId });
    setTab("entry");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-12 · 测评与复测跟踪台</p>
          <h1>心理测评 · 计分 · 复测跟踪</h1>
          <p className="subtitle">
            个案按量表版本录入条目，按正反向计分生成总分与风险等级；升级或高风险强制登记联系计划；
            同量表 7 天内拒绝复测；已完成测评冻结，更正带原因生成新版本。
          </p>
        </div>
        <div className="stack-card">
          <span>分层架构（无新增依赖）</span>
          <strong>domain 数据与规则 · state 状态持久化 · ui 界面</strong>
          <button
            className="reset-btn"
            onClick={() => {
              resetDemo();
              setPrefill({});
              setTab("dashboard");
            }}
          >
            重置为演示数据
          </button>
        </div>
      </section>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab active" : "tab"}
            onClick={() => {
              setTab(t.key);
              if (t.key !== "cases") setPrefill((p) => ({ ...p, selectedCase: undefined }));
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && <Dashboard state={state} goto={goto} />}
      {tab === "entry" && (
        <AssessmentEntry
          key={prefill.correctionOfId ?? `${prefill.caseId}-${prefill.scaleCode ?? "none"}`}
          state={state}
          prefill={prefill}
          onGotoCase={(caseId) => {
            setPrefill({ selectedCase: caseId });
            setTab("cases");
          }}
          onResetPrefill={() => setPrefill({})}
        />
      )}
      {tab === "cases" && (
        <CaseFiles
          state={state}
          selectedId={prefill.selectedCase}
          onSelect={(id) => setPrefill({ selectedCase: id })}
          onCorrect={correctFromArchive}
        />
      )}
      {tab === "plans" && (
        <PlansBoard state={state} gotoCase={(id) => { setPrefill({ selectedCase: id }); setTab("cases"); }} />
      )}
      {tab === "rules" && <RuleCenter state={state} />}
    </main>
  );
}

export default App;
