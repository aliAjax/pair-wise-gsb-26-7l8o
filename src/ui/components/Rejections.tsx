// 拒绝单：整单拒绝时持久化留痕；复测提前、缺联系计划等均展示原值/新值与触发规则。

import { useState } from "react";
import type { AppState } from "../../domain/types";
import { ConflictTable } from "./Shared";

export function Rejections({ state }: { state: AppState }) {
  const [openId, setOpenId] = useState<string | null>(state.rejections[0]?.id ?? null);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>整单拒绝 · 不留测评数据</p>
          <h2>拒绝记录（{state.rejections.length}）</h2>
        </div>
      </div>

      {state.rejections.length === 0 && (
        <p className="muted-note">暂无拒绝记录：所有提交均通过规则校验，或尚未尝试提交。</p>
      )}

      <div className="rejection-list">
        {state.rejections.map((record) => (
          <article key={record.id} className="rejection-card">
            <header className="rejection-head" onClick={() => setOpenId(openId === record.id ? null : record.id)}>
              <div>
                <strong>
                  {record.action === "correction" ? "更正被拒绝" : "测评被拒绝"} · {record.clientId} · {record.scaleKey}
                </strong>
                <span className="muted-note">
                  {" "}
                  测评日期 {record.assessDate} · 提交时间 {new Date(record.at).toLocaleString("zh-CN")}
                </span>
              </div>
              <span className="rule-pill">{record.conflicts.length} 条冲突</span>
            </header>
            {openId === record.id && <ConflictTable conflicts={record.conflicts} />}
          </article>
        ))}
      </div>
    </section>
  );
}
