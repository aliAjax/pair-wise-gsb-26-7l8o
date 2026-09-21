// 测评录入台：个案按量表版本录入条目；实时按正反向规则计算分项分/总分/风险等级。
// 提交由规则层整单校验；冲突时展示个案、量表、原值、新值与触发规则。

import { useMemo, useState } from "react";
import { SCALE_VERSIONS, getScale } from "../../domain/scales";
import type { AppState, Assessment } from "../../domain/types";
import { checkRetest } from "../../rules/retest";
import { scoreAnswers, isEscalation } from "../../rules/scoring";
import {
  evaluateSubmission,
  type PlanDraft,
} from "../../rules/submit";
import { submitAssessment } from "../../state/store";
import { ConflictTable, RiskBadge, TRIGGER_LABEL } from "./Shared";

export interface CorrectionTarget {
  assessment: Assessment;
}

export function AssessmentDesk({
  state,
  correction,
  onCorrectionDone,
}: {
  state: AppState;
  correction?: CorrectionTarget | null;
  onCorrectionDone: () => void;
}) {
  const isCorrection = Boolean(correction);
  const source = correction?.assessment;

  const [clientId, setClientId] = useState(source?.clientId ?? state.clients[0]?.id ?? "");
  const [scaleKey, setScaleKey] = useState(source?.scaleKey ?? SCALE_VERSIONS[0].scaleKey);
  const [assessDate, setAssessDate] = useState(source?.assessDate ?? new Date().toISOString().slice(0, 10));
  const [answers, setAnswers] = useState<Record<string, number>>(
    () => ({ ...(source?.itemScores ?? {}) }),
  );
  const sourcePlan = source
    ? state.plans.find((plan) => plan.assessmentId === source.id)
    : undefined;
  const [plan, setPlan] = useState<PlanDraft>({
    method: sourcePlan?.method ?? "",
    counselor: sourcePlan?.counselor ?? "",
    dueDate: sourcePlan?.dueDate ?? "",
  });
  const [reason, setReason] = useState(source?.createdFrom.kind === "correction" ? "" : "");
  const [result, setResult] = useState<
    | { ok: true; revision: number }
    | { ok: false; conflicts: ReturnType<typeof evaluateSubmission>["conflicts"] }
    | null
  >(null);

  const scale = getScale(scaleKey);
  const client = state.clients.find((entry) => entry.id === clientId);

  const preview = useMemo(() => scoreAnswers(scale, answers), [scale, answers]);

  // 风险基线：更正取原版本，新建取同量表上次有效测评
  const baseline = useMemo<Assessment | undefined>(() => {
    if (isCorrection && source) return source;
    return checkRetest(state.assessments, clientId, scale.scaleId, assessDate || "2999-01-01").last;
  }, [isCorrection, source, state.assessments, clientId, scale.scaleId, assessDate]);

  const escalated = preview.completed && isEscalation(baseline?.risk, preview.risk);
  const planRequired = preview.completed && (preview.risk === "high" || escalated);
  const trigger = preview.risk === "high" ? "high" : "escalation";

  const retest = useMemo(
    () =>
      !isCorrection && assessDate
        ? checkRetest(state.assessments, clientId, scale.scaleId, assessDate)
        : undefined,
    [isCorrection, state.assessments, clientId, scale.scaleId, assessDate],
  );

  function chooseScale(key: string) {
    setScaleKey(key);
    setAnswers({});
    setResult(null);
  }

  function handleSubmit() {
    const outcome = submitAssessment({
      action: isCorrection ? "correction" : "new",
      clientId,
      scaleKey,
      assessDate,
      answers,
      plan,
      reason: reason.trim() || undefined,
      correctsId: source?.id,
    });
    if (outcome.ok) {
      setResult({ ok: true, revision: isCorrection && source ? source.revision + 1 : 1 });
      if (isCorrection) {
        window.setTimeout(onCorrectionDone, 1200);
      } else {
        setAnswers({});
        setPlan({ method: "", counselor: "", dueDate: "" });
      }
    } else {
      setResult({ ok: false, conflicts: outcome.conflicts });
    }
  }

  return (
    <div className="desk-grid">
      <section className="panel entry-panel">
        <div className="section-heading">
          <div>
            <p>{isCorrection ? "更正模式 · 已冻结测评生成新版本" : "新建测评"}</p>
            <h2>{isCorrection ? `更正 ${source?.id}（r${source?.revision}）` : "按量表版本录入条目"}</h2>
          </div>
          {isCorrection && (
            <button onClick={onCorrectionDone}>退出更正</button>
          )}
        </div>

        <div className="form-row">
          <label>
            <span>个案</span>
            <select value={clientId} disabled={isCorrection} onChange={(event) => setClientId(event.target.value)}>
              {state.clients.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.id} · {entry.theme}（默认 {entry.counselor}）
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>量表版本</span>
            <select value={scaleKey} disabled={isCorrection} onChange={(event) => chooseScale(event.target.value)}>
              {SCALE_VERSIONS.map((entry) => (
                <option key={entry.scaleKey} value={entry.scaleKey}>
                  {entry.scaleName} {entry.version}（{entry.items.length} 条 · 发布 {entry.releasedOn}）
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>测评日期</span>
            <input
              type="date"
              value={assessDate}
              disabled={isCorrection}
              onChange={(event) => setAssessDate(event.target.value)}
            />
          </label>
        </div>
        <p className="scale-note">{scale.note}</p>

        {!isCorrection && retest?.last && (
          <div className={`retest-hint ${retest.allowed ? "hint-ok" : "hint-block"}`}>
            <strong>
              前次有效测评：{retest.last.assessDate}（{retest.last.scaleKey}，r{retest.last.revision}）
            </strong>
            {retest.allowed ? (
              <span>间隔 {retest.elapsedDays} 天，已满足七天复测要求，可提交。</span>
            ) : (
              <span>
                同一量表间隔不足七天：提前提交将被整单拒绝，当前剩余 {retest.remainingDays} 天。
              </span>
            )}
          </div>
        )}

        <div className="items-block">
          {scale.items.map((item, index) => (
            <fieldset key={item.code} className="item-row">
              <legend>
                <span className="item-code">{item.code}</span>
                {item.text}
                <em className={`dir-tag dir-${item.direction}`}>
                  {item.direction === "forward" ? "正向" : "反向"}
                </em>
                <em className="sub-tag">{item.subscale}</em>
              </legend>
              <div className="option-group">
                {scale.optionValues.map((value, optionIndex) => (
                  <button
                    key={value}
                    type="button"
                    className={answers[item.code] === value ? "option selected" : "option"}
                    onClick={() => setAnswers((prev) => ({ ...prev, [item.code]: value }))}
                  >
                    <b>{value}</b>
                    {scale.optionLabels[optionIndex]}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        {isCorrection && (
          <label className="reason-block">
            <span>更正原因（必填，将随新版本留痕；原条目、分项分、总分、风险等级保留）</span>
            <textarea
              value={reason}
              rows={2}
              placeholder="例如：来访者反馈某条目理解偏差，复核后更正"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        )}
      </section>

      <aside className="panel side-panel">
        <h2>实时计分</h2>
        <dl className="score-summary">
          {Object.entries(preview.subscaleScores).map(([name, value]) => (
            <div key={name} className="subscore-row">
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="total-line">
          <span>
            总分 <strong>{preview.completed ? preview.total : "—"}</strong> / {preview.maxTotal}
          </span>
          {preview.completed ? (
            <RiskBadge level={preview.risk} />
          ) : (
            <span className="muted-note">缺 {preview.missing.length} 条：{preview.missing.join("、")}</span>
          )}
        </div>

        {preview.completed && baseline && (
          <div className="baseline-box">
            <p>对比前次有效测评（{baseline.assessDate} · r{baseline.revision}）</p>
            <div className="compare-line">
              <span>原总分 {baseline.total}</span>
              <RiskBadge level={baseline.risk} />
              <span className="arrow">→</span>
              <span>新总分 {preview.total}</span>
              <RiskBadge level={preview.risk} />
            </div>
            {escalated && <p className="trigger-note">检测到风险升级，触发联系计划强制登记。</p>}
          </div>
        )}
        {preview.completed && preview.risk === "high" && (
          <div className="baseline-box danger-box">
            <p>总分 {preview.total} 达到 {scale.scaleKey} 高风险阈值。</p>
          </div>
        )}

        <div className={`plan-block ${planRequired ? "plan-required" : ""}`}>
          <h3>
            联系计划
            {planRequired && <span className="must-tag">必须登记 · {TRIGGER_LABEL[trigger]}</span>}
          </h3>
          {!planRequired && (
            <p className="muted-note">当前未达高风险阈值且未升级，无需登记联系计划；如有需要仍可填写留痕。</p>
          )}
          <label>
            <span>联系计划（方式与内容）</span>
            <input
              value={plan.method}
              placeholder="如：24 小时内电话回访，必要时启动危机流程"
              onChange={(event) => setPlan((prev) => ({ ...prev, method: event.target.value }))}
            />
          </label>
          <label>
            <span>责任咨询师</span>
            <input
              value={plan.counselor}
              placeholder={client ? `默认：${client.counselor}` : "选择个案后带出"}
              onChange={(event) => setPlan((prev) => ({ ...prev, counselor: event.target.value }))}
            />
          </label>
          <label>
            <span>完成时限</span>
            <input
              type="date"
              value={plan.dueDate}
              min={isCorrection ? source?.assessDate : assessDate}
              onChange={(event) => setPlan((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
          </label>
        </div>

        <button className="primary-action submit-btn" onClick={handleSubmit}>
          {isCorrection ? "提交更正并生成新版本" : "提交测评"}
        </button>

        {result?.ok && (
          <div className="result-ok">
            ✓ 已提交并冻结：{clientId} · {scale.scaleKey} · {isCorrection ? `新版本 r${result.revision}` : "r1"} · 原数据保留
          </div>
        )}
        {result && !result.ok && (
          <div className="result-blocked">
            <h3>整单拒绝 · {result.conflicts.length} 条规则冲突</h3>
            <ConflictTable conflicts={result.conflicts} />
          </div>
        )}
      </aside>
    </div>
  );
}
