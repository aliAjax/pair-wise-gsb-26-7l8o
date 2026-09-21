import { useMemo, useState } from "react";
import { addDays, evaluateSubmission, RISK_META, todayString } from "../domain/rules";
import { COUNSELORS, SCALE_LOOKUP } from "../domain/seed";
import type { AppState, AssessmentVersion, ScaleCode } from "../domain/types";
import { submitAssessment } from "../state/store";
import { Empty, KindTag, Panel, RiskBadge, ScaleTag, StatusDot } from "./components";
import { selectCaseChains } from "./selectors";

export interface EntryPrefill {
  caseId?: string;
  scaleCode?: ScaleCode;
  correctionOfId?: string;
}

type SubmitOutcome =
  | { ok: true; assessment: AssessmentVersion; planCreated: boolean }
  | { ok: false; evaluation: NonNullable<ReturnType<typeof submitAssessment>["evaluation"]> }
  | null;

export function AssessmentEntry({
  state,
  prefill,
  onGotoCase,
  onResetPrefill,
}: {
  state: AppState;
  prefill: EntryPrefill;
  onGotoCase: (caseId: string) => void;
  onResetPrefill: () => void;
}) {
  const [caseId, setCaseId] = useState(prefill.caseId ?? state.cases[0]?.id ?? "");
  const [scaleCode, setScaleCode] = useState<ScaleCode>(prefill.scaleCode ?? "GAD7");
  const [testDate, setTestDate] = useState(todayString());
  const [mode, setMode] = useState<"new" | "correction">(prefill.correctionOfId ? "correction" : "new");
  const [correctionOfId, setCorrectionOfId] = useState<string | undefined>(prefill.correctionOfId);
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<Record<string, number>>(() => {
    if (prefill.correctionOfId) {
      const target = state.assessments.find((a) => a.id === p.correctionOfId);
      if (target) return Object.fromEntries(target.itemAnswers.map((a) => [a.itemCode, a.value]));
    }
    return {};
  });
  const [planContent, setPlanContent] = useState("");
  const [counselor, setCounselor] = useState("");
  const [deadline, setDeadline] = useState(addDays(todayString(), 2));
  const [outcome, setOutcome] = useState<SubmitOutcome>(null);

  const p = prefill;
  const scale = SCALE_LOOKUP[scaleCode];
  const caseRecord = state.cases.find((c) => c.id === caseId);
  const chains = caseId ? selectCaseChains(state, caseId) : [];
  const thisChain = chains.find((c) => c.scaleCode === scaleCode);
  const latest = thisChain?.latest;
  const correctionTarget = correctionOfId
    ? state.assessments.find((a) => a.id === correctionOfId)
    : undefined;

  const kind: "initial" | "retest" | "correction" =
    mode === "correction" ? "correction" : latest ? "retest" : "initial";

  const live = useMemo(() => {
    if (!caseRecord) return null;
    const answers = scale.items.map((item) => ({ itemCode: item.code, value: values[item.code] }));
    return evaluateSubmission(
      {
        caseId,
        scale,
        testDate,
        answers,
        kind,
        correctionOfId: mode === "correction" ? correctionOfId : undefined,
        reason,
        contact: { content: planContent, counselor, deadline },
      },
      state.assessments,
      caseRecord.code
    );
  }, [caseRecord, scale, values, testDate, kind, mode, correctionOfId, reason, planContent, counselor, deadline, state.assessments, caseId]);

  function switchCase(id: string) {
    setCaseId(id);
    setOutcome(null);
    setMode("new");
    setCorrectionOfId(undefined);
    setValues({});
    onResetPrefill();
  }

  function switchScale(code: ScaleCode) {
    setScaleCode(code);
    setOutcome(null);
    setMode("new");
    setCorrectionOfId(undefined);
    setValues({});
  }

  function chooseCorrection(id: string) {
    const target = state.assessments.find((a) => a.id === id);
    setCorrectionOfId(id);
    setMode("correction");
    setOutcome(null);
    if (target) {
      setTestDate(target.testDate);
      setValues(Object.fromEntries(target.itemAnswers.map((a) => [a.itemCode, a.value])));
    }
  }

  function backToNew() {
    setMode("new");
    setCorrectionOfId(undefined);
    setReason("");
    setValues({});
    setOutcome(null);
  }

  function handleSubmit() {
    if (!caseRecord) return;
    const result = submitAssessment({
      caseId,
      scaleCode,
      testDate,
      values,
      kind,
      correctionOfId: mode === "correction" ? correctionOfId : undefined,
      reason,
      contact: live?.gateRequired
        ? { content: planContent, counselor, deadline }
        : undefined,
    });
    if (result.ok && result.evaluation) {
      setOutcome({ ok: true, assessment: result.assessment!, planCreated: result.evaluation.gateRequired });
    } else if (result.evaluation) {
      setOutcome({ ok: false, evaluation: result.evaluation });
    }
  }

  const answeredCount = scale.items.filter((i) => values[i.code] !== undefined).length;

  return (
    <div className="entry-layout">
      <div className="entry-main">
        <Panel
          title="测评录入"
          hint="条目按量表版本绑定，正反向计分与风险阈值取自领域规则"
          actions={
            mode === "correction" ? (
              <button onClick={backToNew}>退出更正模式</button>
            ) : undefined
          }
        >
          <div className="form-grid form-grid-3">
            <label className="field">
              <span>个案</span>
              <select value={caseId} onChange={(e) => switchCase(e.target.value)}>
                {state.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.alias}（{c.tag}）
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>量表版本</span>
              <select value={scaleCode} onChange={(e) => switchScale(e.target.value as ScaleCode)}>
                {state.scales.map((s) => (
                  <option key={s.version} value={s.scaleCode}>
                    {s.version} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>测评日期</span>
              <input type="date" value={testDate} max={todayString()} onChange={(e) => { setTestDate(e.target.value); setOutcome(null); }} />
            </label>
          </div>

          <div className="version-meta">
            <ScaleTag code={scale.scaleCode} />
            <span className="muted">版本 {scale.version}（发布 {scale.publishedAt}）</span>
            <span className="pill pill-info">提交类型：<KindTag kind={kind} /></span>
            {latest && mode === "new" && (
              <span className="muted">
                前次有效：v{latest.seq} · {latest.testDate} · 总分 {latest.totalScore} ·{" "}
                {RISK_META[latest.riskLevel].label}
              </span>
            )}
          </div>
          <p className="scale-instruction">{scale.instruction}</p>

          {mode === "new" && thisChain && thisChain.versions.length > 0 && (
            <div className="correction-bar">
              <span className="muted">已完成测评已冻结；如需更正，选择要更正的版本（保留原条目/分项分/总分/风险等级）：</span>
              <select value="" onChange={(e) => e.target.value && chooseCorrection(e.target.value)}>
                <option value="">选择版本发起更正…</option>
                {thisChain.versions.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.status === "superseded"}>
                    v{v.seq} {v.kind === "correction" ? "（更正版）" : ""} · {v.testDate} · 总分 {v.totalScore} ·{" "}
                    {v.status === "valid" ? "有效，可更正" : "已冻结，不可更正"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === "correction" && correctionTarget && (
            <div className="correction-box">
              <div className="correction-box-head">
                <strong>更正目标：v{correctionTarget.seq}</strong>
                <StatusDot status={correctionTarget.status} />
                <span className="muted">原测评日期 {correctionTarget.testDate}</span>
              </div>
              <label className="field">
                <span>更正原因（必填，将随新版本留痕）</span>
                <textarea
                  rows={2}
                  value={reason}
                  placeholder="例如：来访者补充条目 3 实际为「好几天」，初测误录为「一半以上天数」"
                  onChange={(e) => { setReason(e.target.value); setOutcome(null); }}
                />
              </label>
            </div>
          )}

          <div className="item-groups">
            {scale.subscales.map((sub) => {
              const subScore = live?.subscales.find((s) => s.code === sub.code);
              return (
                <fieldset key={sub.code} className="item-group">
                  <legend>
                    {sub.name}
                    {subScore !== undefined && answeredCount === scale.items.length && (
                      <span className="subscore">分项分：{subScore.score}</span>
                    )}
                  </legend>
                  {sub.itemCodes.map((code) => {
                    const item = scale.items.find((i) => i.code === code)!;
                    return (
                      <div key={code} className="item-row">
                        <div className="item-text">
                          <span className="item-code">{code}</span>
                          {item.text}
                          {item.reverse && <span className="reverse-flag" title={`反向计分：${item.min + item.max} - 录入值`}>反向</span>}
                        </div>
                        <div className="item-options">
                          {scale.optionsLabel.map((label, idx) => {
                            const value = item.min + idx;
                            return (
                              <label key={idx} className={`option ${values[code] === value ? "selected" : ""}`}>
                                <input
                                  type="radio"
                                  name={code}
                                  checked={values[code] === value}
                                  onChange={() => { setValues((v) => ({ ...v, [code]: value })); setOutcome(null); }}
                                />
                                <span>{label}（{value}）</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
        </Panel>

        {outcome && !outcome.ok && <RejectionPanel evaluation={outcome.evaluation} caseCode={caseRecord!.code} scaleName={scale.name} />}
        {outcome && outcome.ok && (
          <SuccessPanel
            outcome={outcome}
            caseCode={caseRecord!.code}
            onView={() => onGotoCase(caseId)}
            onContinue={() => { setOutcome(null); setValues({}); setReason(""); setPlanContent(""); }}
          />
        )}
      </div>

      <aside className="entry-side">
        <Panel title="实时计分与闸门" hint="提交前预览，规则与提交时一致">
          {live && (
            <>
              <div className="score-preview">
                <div>
                  <span className="muted">总分</span>
                  <strong>{answeredCount === scale.items.length ? live.total : "—"}</strong>
                  <em className="muted">/ {scale.items.reduce((m, i) => m + i.max, 0)}</em>
                </div>
                <div>
                  <span className="muted">风险等级</span>
                  {answeredCount === scale.items.length ? <RiskBadge level={live.level} /> : <span className="muted">待答完</span>}
                </div>
                <div>
                  <span className="muted">已作答</span>
                  <strong>{answeredCount}</strong>
                  <em className="muted">/ {scale.items.length}</em>
                </div>
              </div>

              <div className="gate-box">
                <p className="gate-title">规则检查</p>
                <CheckRow ok={live.missing.length === 0} label={`条目完整（${answeredCount}/${scale.items.length}）`} />
                <CheckRow
                  ok={!live.retestBlock}
                  label={
                    live.retestBlock
                      ? `复测不足 7 天，剩余 ${live.retestBlock.remainingDays} 天`
                      : kind === "correction"
                        ? "更正不受 7 天限制"
                        : latest
                          ? "复测间隔 ≥ 7 天"
                          : "首次测评无间隔限制"
                  }
                />
                <CheckRow ok={mode !== "correction" || !!reason.trim()} label={mode === "correction" ? "更正原因已填写" : "非更正模式"} />
                <CheckRow ok={!live.gateRequired || (!!planContent.trim() && !!counselor && !!deadline)} label={live.gateRequired ? "联系计划三要素已登记" : "未触发联系计划闸门"} />
              </div>

              {live.gateRequired && (
                <div className="plan-form">
                  <p className="gate-title danger-text">
                    触发 R-GATE：{live.conflicts[0]?.rule}
                  </p>
                  <p className="muted small">
                    {live.conflicts[0]?.label}：{live.conflicts[0]?.oldValue} → {live.conflicts[0]?.newValue}
                  </p>
                  <label className="field">
                    <span>联系计划 *</span>
                    <textarea rows={3} value={planContent} placeholder="具体联系安排与安全措施" onChange={(e) => setPlanContent(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>责任咨询师 *</span>
                    <select value={counselor} onChange={(e) => setCounselor(e.target.value)}>
                      <option value="">请选择…</option>
                      {COUNSELORS.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>完成时限 *</span>
                    <input type="date" value={deadline} min={todayString()} onChange={(e) => setDeadline(e.target.value)} />
                  </label>
                </div>
              )}

              <button className="primary-action submit-btn" onClick={handleSubmit}>
                {mode === "correction" ? "提交更正并生成新版本" : "提交测评"}
              </button>
              <p className="small muted">
                不满足规则时整单拒绝；复测过早将列出个案、量表、前次日期与剩余天数。
              </p>
            </>
          )}
        </Panel>
      </aside>
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`check-row ${ok ? "check-ok" : "check-bad"}`}>
      <span className="check-icon">{ok ? "✓" : "✕"}</span>
      <span>{label}</span>
    </div>
  );
}

function RejectionPanel({
  evaluation,
  caseCode,
  scaleName,
}: {
  evaluation: NonNullable<ReturnType<typeof submitAssessment>["evaluation"]>;
  caseCode: string;
  scaleName: string;
}) {
  return (
    <Panel className="reject-panel" title="整单拒绝" hint="未写入任何测评版本或联系计划">
      {evaluation.retestBlock && (
        <div className="retest-block">
          <h3>R-RETEST 复测时间不足</h3>
          <dl className="retest-grid">
            <div><dt>个案</dt><dd>{caseCode}</dd></div>
            <div><dt>量表</dt><dd>{scaleName}</dd></div>
            <div><dt>前次有效测评日期</dt><dd>{evaluation.retestBlock.previousDate}</dd></div>
            <div><dt>剩余天数</dt><dd className="danger-text strong">{evaluation.retestBlock.remainingDays} 天</dd></div>
          </dl>
        </div>
      )}
      <ul className="reject-list">
        {evaluation.rejections.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      {evaluation.conflicts.length > 0 && (
        <table className="conflict-table">
          <thead>
            <tr><th>项</th><th>原值</th><th>新值</th><th>触发规则</th></tr>
          </thead>
          <tbody>
            {evaluation.conflicts.map((c, i) => (
              <tr key={i}>
                <td>{c.label}</td><td>{c.oldValue}</td><td>{c.newValue}</td><td>{c.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function SuccessPanel({
  outcome,
  caseCode,
  onView,
  onContinue,
}: {
  outcome: Extract<SubmitOutcome, { ok: true }>;
  caseCode: string;
  onView: () => void;
  onContinue: () => void;
}) {
  const a = outcome.assessment;
  return (
    <Panel className="success-panel" title="提交成功" hint="新版本已写入，刷新后仍一致">
      <div className="success-grid">
        <div><span className="muted">个案</span><strong>{caseCode}</strong></div>
        <div><span className="muted">版本</span><strong><KindTag kind={a.kind} /> v{a.seq}</strong></div>
        <div><span className="muted">总分</span><strong>{a.totalScore}</strong></div>
        <div><span className="muted">风险等级</span><RiskBadge level={a.riskLevel} /></div>
      </div>
      {a.reason && <p className="muted small">更正原因：{a.reason}</p>}
      {outcome.planCreated && <p className="plan-created-note">✓ 已同步登记联系计划（见「联系计划」页签）。</p>}
      <div className="success-actions">
        <button className="primary-action" onClick={onView}>查看个案档案</button>
        <button onClick={onContinue}>继续录入</button>
      </div>
    </Panel>
  );
}

// 供空状态场景使用，避免未使用告警
export function _entryEmpty() { return <Empty>请先建档个案</Empty>; }
