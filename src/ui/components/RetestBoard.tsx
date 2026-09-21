// 复测跟踪台：按「个案 × 量表」汇总上次有效测评、间隔与剩余天数。
// 提前提交将被拒绝；刷新后与档案版本链保持一致（同一状态源）。

import { useMemo } from "react";
import { SCALE_VERSIONS } from "../../domain/scales";
import type { AppState } from "../../domain/types";
import { RETEST_INTERVAL_DAYS, daysBetween, lastValidAssessment, todayISO } from "../../rules/retest";
import { RiskBadge } from "./Shared";

export function RetestBoard({ state }: { state: AppState }) {
  const today = todayISO();

  const rows = useMemo(() => {
    const scaleIds = [...new Set(SCALE_VERSIONS.map((entry) => entry.scaleId))];
    return state.clients.flatMap((client) =>
      scaleIds.map((scaleId) => {
        const last = lastValidAssessment(state.assessments, client.id, scaleId);
        const elapsed = last ? daysBetween(last.assessDate, today) : null;
        const remaining = last ? Math.max(0, RETEST_INTERVAL_DAYS - (elapsed ?? 0)) : 0;
        return { client, scaleId, last, elapsed, remaining };
      }),
    );
  }, [state.clients, state.assessments, today]);

  const frozenCount = rows.filter((row) => row.last && row.remaining > 0).length;
  const readyCount = rows.filter((row) => row.last && row.remaining === 0).length;
  const neverCount = rows.filter((row) => !row.last).length;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>复测提醒 · 同一量表间隔 {RETEST_INTERVAL_DAYS} 天</p>
          <h2>复测跟踪</h2>
        </div>
        <div className="retest-summary">
          <span className="sum-pill block">间隔内冻结 {frozenCount}</span>
          <span className="sum-pill ok">可复测 {readyCount}</span>
          <span className="sum-pill never">从未测评 {neverCount}</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>个案</th>
              <th>量表</th>
              <th>当前版本</th>
              <th>前次有效测评日期</th>
              <th>前次总分/风险</th>
              <th>已隔天数</th>
              <th>剩余天数</th>
              <th>复测状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ client, scaleId, last, elapsed, remaining }) => {
              const versions = SCALE_VERSIONS.filter((entry) => entry.scaleId === scaleId);
              const latestVersion = versions[versions.length - 1];
              return (
                <tr key={`${client.id}-${scaleId}`} className={last && remaining > 0 ? "row-blocked" : "row-ready"}>
                  <td>{client.id}</td>
                  <td>{latestVersion.scaleName}</td>
                  <td>{latestVersion.scaleKey}</td>
                  <td>{last ? last.assessDate : "—"}</td>
                  <td>
                    {last ? (
                      <span className="inline-score">
                        {last.total}（{last.scaleKey} · r{last.revision}） <RiskBadge level={last.risk} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{elapsed === null ? "—" : elapsed}</td>
                  <td>
                    {last ? (
                      <b className={remaining > 0 ? "num-warn" : "num-ok"}>{remaining}</b>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {!last ? (
                      <span className="state-tag never">从未测评 · 可首次测评</span>
                    ) : remaining > 0 ? (
                      <span className="state-tag blocked">
                        冻结中 · {last.assessDate} 起 {RETEST_INTERVAL_DAYS} 天内拒绝复测
                      </span>
                    ) : (
                      <span className="state-tag ready">可复测</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
