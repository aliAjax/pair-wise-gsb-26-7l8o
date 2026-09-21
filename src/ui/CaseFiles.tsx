import { useEffect, useState } from "react";
import { PLAN_TRIGGER_LABEL, RISK_META } from "../domain/rules";
import type { AppState, AssessmentVersion, CaseTag } from "../domain/types";
import { addCase, effectivePlanStatus } from "../state/store";
import { Empty, KindTag, Panel, RiskBadge, ScaleTag, StatusDot } from "./components";
import { selectCaseChains, selectCaseRows } from "./selectors";

const TAGS: CaseTag[] = ["焦虑", "抑郁", "亲密关系", "亲子", "职业压力", "自尊"];

export function CaseFiles({
  state,
  selectedId,
  onSelect,
  onCorrect,
}: {
  state: AppState;
  selectedId?: string;
  onSelect: (id: string) => void;
  onCorrect: (caseId: string, scaleCode: AssessmentVersion["scaleCode"], assessmentId: string) => void;
}) {
  const rows = selectCaseRows(state);
  const [activeId, setActiveId] = useState(selectedId ?? rows[0]?.caseRecord.id ?? "");
  const [code, setCode] = useState("");
  const [alias, setAlias] = useState("");
  const [tag, setTag] = useState<CaseTag>("焦虑");
  const [addError, setAddError] = useState("");

  useEffect(() => {
    if (selectedId) setActiveId(selectedId);
  }, [selectedId]);

  const active = state.cases.find((c) => c.id === activeId);
  const chains = active ? selectCaseChains(state, active.id) : [];

  function handleAdd() {
    const result = addCase({ code, alias, tag });
    if ("error" in result) {
      setAddError(result.error);
      return;
    }
    setCode("");
    setAlias("");
    setAddError("");
    setActiveId(result.id);
  }

  return (
    <div className="cases-layout">
      <aside className="case-list panel">
        <h2>个案列表</h2>
        <div className="case-add">
          <input placeholder="代号，如 C-512" value={code} onChange={(e) => setCode(e.target.value)} />
          <input placeholder="称谓" value={alias} onChange={(e) => setAlias(e.target.value)} />
          <div className="case-add-row">
            <select value={tag} onChange={(e) => setTag(e.target.value as CaseTag)}>
              {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="primary-action" onClick={handleAdd}>建档</button>
          </div>
          {addError && <p className="danger-text small">{addError}</p>}
        </div>
        <div className="case-items">
          {rows.map((row) => (
            <button
              key={row.caseRecord.id}
              className={`case-item ${row.caseRecord.id === activeId ? "active" : ""}`}
              onClick={() => { setActiveId(row.caseRecord.id); onSelect(row.caseRecord.id); }}
            >
              <div className="case-item-top">
                <strong>{row.caseRecord.code}</strong>
                <RiskBadge level={row.topLevel} size="sm" />
              </div>
              <span className="muted small">{row.caseRecord.alias} · {row.caseRecord.tag}</span>
              <span className="muted small">
                {row.chains.filter((c) => c.latest).length} 个量表有有效测评
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="case-detail">
        {!active ? (
          <Panel><Empty>暂无个案，请先建档</Empty></Panel>
        ) : (
          <>
            <Panel
              title={`${active.code} · ${active.alias}`}
              hint={`建档 ${active.createdAt} · 主题：${active.tag}`}
            >
              <div className="chain-overview">
                {chains.map((chain) => (
                  <div key={chain.scaleCode} className="chain-card">
                    <div className="chain-head">
                      <ScaleTag code={chain.scaleCode} />
                      <span>{state.scales.find((s) => s.scaleCode === chain.scaleCode)?.name}</span>
                    </div>
                    {chain.latest ? (
                      <div className="chain-latest">
                        <RiskBadge level={chain.latest.riskLevel} size="sm" />
                        <span className="muted small">
                          v{chain.latest.seq} · {chain.latest.testDate} · 总分 {chain.latest.totalScore}
                        </span>
                      </div>
                    ) : (
                      <span className="muted small">尚未测评</span>
                    )}
                    <span className="muted small">共 {chain.versions.length} 个版本</span>
                  </div>
                ))}
              </div>
            </Panel>

            {chains.flatMap((chain) =>
              chain.versions.length === 0
                ? []
                : [
                    <Panel
                      key={chain.scaleCode}
                      title={state.scales.find((s) => s.scaleCode === chain.scaleCode)?.name}
                      hint={`${chain.scaleCode} · ${chain.versions[0].version}`}
                    >
                      <div className="version-timeline">
                        {[...chain.versions].reverse().map((v) => (
                          <VersionCard
                            key={v.id}
                            state={state}
                            assessment={v}
                            onCorrect={() => onCorrect(active.id, chain.scaleCode, v.id)}
                          />
                        ))}
                      </div>
                    </Panel>,
                  ]
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VersionCard({
  state,
  assessment,
  onCorrect,
}: {
  state: AppState;
  assessment: AssessmentVersion;
  onCorrect: () => void;
}) {
  const scale = state.scales.find((s) => s.scaleCode === assessment.scaleCode)!;
  const plans = state.plans.filter((p) => p.assessmentId === assessment.id);
  const frozen = assessment.status === "superseded";

  return (
    <article className={`version-card ${frozen ? "is-frozen" : ""}`}>
      <header className="version-head">
        <div className="version-head-left">
          <h3>v{assessment.seq}</h3>
          <KindTag kind={assessment.kind} />
          <StatusDot status={assessment.status} />
        </div>
        <div className="version-head-right">
          <span className="muted small">{assessment.testDate}</span>
          <strong className="version-total">{assessment.totalScore} 分</strong>
          <RiskBadge level={assessment.riskLevel} size="sm" />
          {!frozen && (
            <button className="link-btn" onClick={onCorrect}>更正（生成新版本）</button>
          )}
        </div>
      </header>

      {assessment.reason && (
        <p className="correction-reason"><strong>更正原因：</strong>{assessment.reason}</p>
      )}

      <div className="version-scores">
        {assessment.subscaleScores.map((s) => (
          <span key={s.code} className="subscore-chip">{s.name}：{s.score}</span>
        ))}
        <span className="subscore-chip subscore-total">总分：{assessment.totalScore}</span>
        <span className="subscore-chip">风险：{RISK_META[assessment.riskLevel].label}</span>
      </div>

      <details className="item-detail">
        <summary>查看原始条目与计分（{assessment.itemAnswers.length} 条）</summary>
        <table className="items-table">
          <thead>
            <tr><th>条目</th><th>描述</th><th>录入值</th><th>计分</th></tr>
          </thead>
          <tbody>
            {assessment.itemAnswers.map((ans) => {
              const item = scale.items.find((i) => i.code === ans.itemCode)!;
              const scored = item.reverse ? item.min + item.max - ans.value : ans.value;
              return (
                <tr key={ans.itemCode}>
                  <td className="nowrap">{ans.itemCode}{item.reverse && <em className="reverse-flag">反向</em>}</td>
                  <td>{item.text}</td>
                  <td className="nowrap">{scale.optionsLabel[ans.value - item.min]}（{ans.value}）</td>
                  <td className="nowrap strong">{scored}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      {plans.length > 0 && (
        <div className="version-plans">
          {plans.map((p) => {
            const status = effectivePlanStatus(p);
            return (
            <div key={p.id} className={`plan-mini ${status === "overdue" ? "is-overdue" : ""}`}>
              <span className="pill pill-trigger">{PLAN_TRIGGER_LABEL[p.trigger]}</span>
              <span className="muted small">责任咨询师 {p.counselor} · 时限 {p.deadline}</span>
              <span className={`pill ${status === "done" ? "pill-ok" : status === "overdue" ? "pill-danger" : "pill-wait"}`}>
                {status === "done" ? `已完成 ${p.completedAt?.slice(0, 10) ?? ""}` : status === "overdue" ? "已逾期" : "待办"}
              </span>
              <p className="muted small plan-clip">{p.content}</p>
            </div>
            );
          })}
        </div>
      )}

      {frozen && (
        <p className="frozen-note">
          该版本已冻结：原条目、分项分、总分与风险等级均保留；更正记录见后续版本。
        </p>
      )}
    </article>
  );
}
