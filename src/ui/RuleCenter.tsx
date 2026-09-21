import { RETEST_INTERVAL_DAYS, RISK_META } from "../domain/rules";
import type { AppState } from "../domain/types";
import { Panel } from "./components";

export function RuleCenter({ state }: { state: AppState }) {
  return (
    <div className="rules-layout">
      <Panel title="计分与闸门规则" hint="规则代码在拒绝提示与触发记录中复用">
        <div className="rule-list">
          <RuleBlock
            code="R-SCORE"
            name="按版本计分"
            lines={[
              "条目按所选量表版本录入；正向条目计入录入值，反向条目按「最小值 + 最大值 − 录入值」翻转。",
              "分项分为条目计分之和，总分为各分项分之和；缺任一整单拒绝。",
              "风险等级由版本分段（bands）决定：RSES 等反向量表分数越低越危险。",
            ]}
          />
          <RuleBlock
            code="R-GATE"
            name="升级 / 高风险闸门"
            lines={[
              "风险等级 rank 严格升高（总分升级）或达到高风险阈值时，必须登记联系计划。",
              "联系计划三要素：联系内容、责任咨询师、完成时限；缺一整单拒绝。",
              "初测直接达到高风险按「高风险阈值」触发；之后按「总分升级」触发。",
            ]}
          />
          <RuleBlock
            code="R-RETEST"
            name={`复测间隔（${RETEST_INTERVAL_DAYS} 天）`}
            lines={[
              `同一(个案,量表)距上次「有效」测评不足 ${RETEST_INTERVAL_DAYS} 天不能复测。`,
              "提前提交整单拒绝，并列出：个案、量表、前次日期、剩余天数。",
              "只以有效版本为基准；已冻结(superseded)版本不参与间隔计算。",
            ]}
          />
          <RuleBlock
            code="R-FREEZE"
            name="冻结与更正"
            lines={[
              "已接受的测评立即冻结；更正必须填写原因。",
              "更正生成同链新版本（seq +1），原条目的录入值、分项分、总分、风险等级全部原样保留并标记 superseded。",
              "更正不受 7 天复测限制；更正后若升级/达高风险，同样触发 R-GATE。",
            ]}
          />
          <RuleBlock
            code="R-PERSIST"
            name="一致性"
            lines={[
              "领域数据(scales)、计算规则(rules)、界面(ui) 三层分离；状态仅在 state/store 装配规则结果。",
              "数据持久化在浏览器本地；刷新后个案、测评版本、联系计划、复测提醒从同一份数据派生。",
              "冲突统一展示：个案、量表、原值、新值、触发规则（见录入台拒绝面板与触发记录）。",
            ]}
          />
        </div>
      </Panel>

      <Panel title="量表版本阈值" hint="分段为左闭右开">
        <div className="scale-rule-grid">
          {state.scales.map((s) => (
            <div key={s.version} className="scale-rule-card">
              <h3>{s.name}</h3>
              <p className="muted small">{s.version} · {s.items.length} 条目（{s.items.filter((i) => i.reverse).length} 条反向）· 满分 {s.items.reduce((m, i) => m + i.max, 0)}</p>
              <div className="band-row">
                {s.bands.map((b) => (
                  <span key={b.level} className={`band-chip band-${RISK_META[b.level].tone}`}>
                    {b.max === Infinity ? `≥${b.min}` : `${b.min}–${b.max - 1}`}
                    {RISK_META[b.level].label}
                  </span>
                ))}
              </div>
              <p className="muted small">高风险阈值：总分 ≥ {s.highRiskThreshold}（RSES 按分段判定）</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="触发记录（审计流）" hint="接受 / 拒绝 / 冲突全部留痕">
        <div className="log-table-wrap">
          <table className="log-table">
            <thead>
              <tr><th>时间</th><th>结果</th><th>规则</th><th>个案</th><th>说明</th></tr>
            </thead>
            <tbody>
              {state.logs.map((entry) => {
                const c = state.cases.find((x) => x.id === entry.caseId);
                return (
                  <tr key={entry.id}>
                    <td className="nowrap">{entry.at.replace("T", " ")}</td>
                    <td><span className={`outcome outcome-${entry.outcome}`}>
                      {entry.outcome === "accepted" ? "已接受" : entry.outcome === "rejected" ? "已拒绝" : "冲突"}
                    </span></td>
                    <td className="nowrap">{entry.rule}</td>
                    <td className="nowrap">{c?.code ?? "—"}{entry.scaleCode ? ` · ${entry.scaleCode}` : ""}</td>
                    <td>
                      {entry.message}
                      {entry.conflicts && entry.conflicts.length > 0 && (
                        <table className="conflict-table inner">
                          <thead><tr><th>项</th><th>原值</th><th>新值</th><th>规则</th></tr></thead>
                          <tbody>
                            {entry.conflicts.map((cf, i) => (
                              <tr key={i}><td>{cf.label}</td><td>{cf.oldValue}</td><td>{cf.newValue}</td><td>{cf.rule}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function RuleBlock({ code, name, lines }: { code: string; name: string; lines: string[] }) {
  return (
    <article className="rule-block">
      <header><span className="rule-code">{code}</span><h3>{name}</h3></header>
      <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </article>
  );
}
