// 个案档案：个案列表 + 每个个案的测评版本链。
// 已完成测评冻结不可改；更正入口打开录入台更正模式，新版本保留原条目与全部分数。

import { useMemo, useState } from "react";
import { RISK_LABEL, getScale } from "../../domain/scales";
import type { AppState, Assessment } from "../../domain/types";
import { addClient } from "../../state/store";
import { RiskBadge } from "./Shared";
import type { CorrectionTarget } from "./AssessmentDesk";

export function CaseArchive({
  state,
  onCorrect,
}: {
  state: AppState;
  onCorrect: (target: CorrectionTarget) => void;
}) {
  const [activeId, setActiveId] = useState(state.clients[0]?.id ?? "");
  const [newId, setNewId] = useState("");
  const [newTheme, setNewTheme] = useState("");
  const [newCounselor, setNewCounselor] = useState("");
  const [addError, setAddError] = useState("");

  const active = state.clients.find((client) => client.id === activeId);
  const chain = useMemo(
    () =>
      state.assessments
        .filter((entry) => entry.clientId === activeId)
        .sort((a, b) => (a.assessDate < b.assessDate ? 1 : a.assessDate > b.assessDate ? -1 : b.revision - a.revision)),
    [state.assessments, activeId],
  );

  function handleAdd() {
    const ok = addClient({
      id: newId,
      name: "",
      theme: newTheme,
      counselor: newCounselor,
    });
    if (ok) {
      setActiveId(newId.trim().toUpperCase());
      setNewId("");
      setNewTheme("");
      setNewCounselor("");
      setAddError("");
    } else {
      setAddError("代号为空或已存在");
    }
  }

  return (
    <div className="archive-grid">
      <aside className="panel client-list">
        <h2>个案（{state.clients.length}）</h2>
        {state.clients.map((client) => {
          const latest = state.assessments
            .filter((entry) => entry.clientId === client.id && !entry.supersededById)
            .sort((a, b) => (a.assessDate < b.assessDate ? 1 : -1))[0];
          return (
            <button
              key={client.id}
              className={client.id === activeId ? "client-item active" : "client-item"}
              onClick={() => setActiveId(client.id)}
            >
              <span className="client-id">{client.id}</span>
              <span className="client-theme">{client.theme}</span>
              {latest && <RiskBadge level={latest.risk} />}
            </button>
          );
        })}
        <div className="add-client">
          <h3>新增个案</h3>
          <input placeholder="代号，如 C-401" value={newId} onChange={(e) => setNewId(e.target.value)} />
          <input placeholder="咨询主题" value={newTheme} onChange={(e) => setNewTheme(e.target.value)} />
          <input placeholder="责任咨询师" value={newCounselor} onChange={(e) => setNewCounselor(e.target.value)} />
          {addError && <p className="inline-error">{addError}</p>}
          <button onClick={handleAdd}>登记个案</button>
        </div>
      </aside>

      <section className="panel">
        {active && (
          <>
            <div className="section-heading">
              <div>
                <p>{active.theme} · 默认责任咨询师 {active.counselor}</p>
                <h2>{active.name}</h2>
              </div>
              <span className="muted-note">建档 {active.createdAt}</span>
            </div>

            <div className="version-chain">
              {chain.length === 0 && <p className="muted-note">尚无测评记录，可到「测评录入」首次测评。</p>}
              {chain.map((assessment) => (
                <VersionCard
                  key={assessment.id}
                  state={state}
                  assessment={assessment}
                  onCorrect={() => onCorrect({ assessment })}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function VersionCard({
  state,
  assessment,
  onCorrect,
}: {
  state: AppState;
  assessment: Assessment;
  onCorrect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const scale = getScale(assessment.scaleKey);
  const plan = state.plans.find((entry) => entry.assessmentId === assessment.id);
  const superseded = Boolean(assessment.supersededById);
  const correctedFrom =
    assessment.createdFrom.kind === "correction"
      ? state.assessments.find((entry) => entry.id === (assessment.createdFrom as { correctsId: string }).correctsId)
      : undefined;

  return (
    <article className={`version-card ${superseded ? "is-superseded" : ""}`}>
      <header className="version-head" onClick={() => setExpanded((v) => !v)}>
        <div>
          <strong>
            {assessment.scaleKey} · r{assessment.revision}
          </strong>
          {superseded && <span className="chain-tag old">已被新版本取代 · 冻结保留</span>}
          {!superseded && <span className="chain-tag current">当前版本 · 已冻结</span>}
          {assessment.createdFrom.kind === "correction" && (
            <span className="chain-tag corrected">更正版（原因留痕）</span>
          )}
        </div>
        <div className="version-meta">
          <span>测评日期 {assessment.assessDate}</span>
          <span>
            总分 <b>{assessment.total}</b>
          </span>
          <RiskBadge level={assessment.risk} />
          <button
            onClick={(event) => {
              event.stopPropagation();
              onCorrect();
            }}
          >
            更正（生成 r{assessment.revision + 1}）
          </button>
        </div>
      </header>

      {expanded && (
        <div className="version-body">
          {assessment.createdFrom.kind === "correction" && (
            <p className="reason-line">
              更正原因：{(assessment.createdFrom as { reason: string }).reason}
              {correctedFrom && `（原版本 r${correctedFrom.revision} 保留）`}
            </p>
          )}
          <div className="snapshot-grid">
            <div>
              <h4>分项分（冻结）</h4>
              <ul className="score-list">
                {Object.entries(assessment.subscaleScores).map(([name, value]) => (
                  <li key={name}>
                    {name} <b>{value}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="item-snapshot">
              <h4>条目作答（原始分 → 计分值）</h4>
              <ul className="score-list compact">
                {scale.items.map((item) => {
                  const raw = assessment.itemScores[item.code];
                  const max = Math.max(...scale.optionValues);
                  const scored = item.direction === "reverse" ? max - raw : raw;
                  return (
                    <li key={item.code} className={correctedFrom && correctedFrom.itemScores[item.code] !== raw ? "changed" : ""}>
                      {item.code}
                      <em className={item.direction === "reverse" ? "dir-reverse" : "dir-forward"}>
                        {item.direction === "reverse" ? "反" : "正"}
                      </em>
                      {raw} → {scored}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h4>结论（冻结）</h4>
              <p>
                总分 <b>{assessment.total}</b> · 风险等级 <b>{RISK_LABEL[assessment.risk]}</b>
              </p>
              {plan ? (
                <p className="plan-linked">
                  联系计划：{plan.counselor} · 时限 {plan.dueDate} ·{" "}
                  {plan.status === "done" ? "已完成" : "待完成"}
                </p>
              ) : (
                <p className="muted-note">无联系计划（未触发强制规则）</p>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
