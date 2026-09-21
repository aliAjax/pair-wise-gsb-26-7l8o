import type { ReactNode } from "react";
import { RISK_META } from "../domain/rules";
import type { RiskLevel, ScaleCode } from "../domain/types";

// 界面层通用原子组件：只负责呈现，业务文案由调用方传入。

export function RiskBadge({ level, size = "md" }: { level: RiskLevel; size?: "sm" | "md" }) {
  const meta = RISK_META[level];
  return <span className={`risk-badge risk-${meta.tone} ${size === "sm" ? "risk-sm" : ""}`}>{meta.label}</span>;
}

export function ScaleTag({ code }: { code: ScaleCode }) {
  return <span className="scale-tag">{code}</span>;
}

export function Panel({
  title,
  hint,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="section-heading">
          <div>
            {hint && <p className="panel-hint">{hint}</p>}
            {title && <h2>{title}</h2>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function KindTag({ kind }: { kind: "initial" | "retest" | "correction" }) {
  const map = { initial: "初测", retest: "复测", correction: "更正" } as const;
  return <span className={`kind-tag kind-${kind}`}>{map[kind]}</span>;
}

export function StatusDot({ status }: { status: "valid" | "superseded" }) {
  return (
    <span className={`status-dot ${status === "valid" ? "dot-valid" : "dot-frozen"}`}>
      {status === "valid" ? "有效" : "已冻结"}
    </span>
  );
}
