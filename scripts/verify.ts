// 临时规则自测（不入最终代码）
import { GAD7_V1, PMH_V1, getScale } from "../src/domain/scales";
import { scoreAnswers, isEscalation } from "../src/rules/scoring";
import { checkRetest, daysBetween } from "../src/rules/retest";
import { evaluateSubmission } from "../src/rules/submit";
import type { AppState, Assessment } from "../src/domain/types";
import { buildSeedState } from "../src/state/seed";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

// 1. PMH v1.0 反向计分：Q3 raw 3 → 0，Q5 raw 2 → 1
const pmh = getScale(PMH_V1.scaleKey);
const pmhResult = scoreAnswers(pmh, { Q1: 2, Q2: 2, Q3: 3, Q4: 2, Q5: 2, Q6: 3 });
check("PMH 分项 情绪=4（2+2+0）", pmhResult.subscaleScores["情绪状态"] === 4, JSON.stringify(pmhResult.subscaleScores));
check("PMH 分项 社会=3（2+1）", pmhResult.subscaleScores["社会支持"] === 3);
check("PMH 总分 10", pmhResult.total === 10, String(pmhResult.total));
check("PMH 10 分=中风险", pmhResult.risk === "risk");

// 2. GAD 高风险 17
const gad = getScale(GAD7_V1.scaleKey);
const gadResult = scoreAnswers(gad, { Q1: 3, Q2: 3, Q3: 2, Q4: 3, Q5: 2, Q6: 2, Q7: 2 });
check("GAD 总分 17", gadResult.total === 17);
check("GAD 17=高风险", gadResult.risk === "high");

// 3. 缺条目不完成
const partial = scoreAnswers(gad, { Q1: 3 });
check("缺条目 completed=false", partial.completed === false && partial.missing.length === 6);

// 4. 升级判定
check("watch→risk 升级", isEscalation("watch", "risk"));
check("high→stable 非升级", !isEscalation("high", "stable"));
check("无前次不视为升级", !isEscalation(undefined, "watch"));

// 5. 日期差
check("9/15→9/21 = 6 天", daysBetween("2026-09-15", "2026-09-21") === 6);
check("9/15→9/22 = 7 天", daysBetween("2026-09-15", "2026-09-22") === 7);

// 6. 种子数据：C-042 9/15 测评，9/21 复测被拒，剩余 1 天；9/22 可测
const seed = buildSeedState();
const r1 = checkRetest(seed.assessments, "C-042", "GAD7", "2026-09-21");
check("C-042 9/21 复测拒绝", r1.allowed === false);
check("剩余 1 天", r1.remainingDays === 1, String(r1.remainingDays));
check("列出前次日期 2026-09-15", r1.last?.assessDate === "2026-09-15");
const r2 = checkRetest(seed.assessments, "C-042", "GAD7", "2026-09-22");
check("C-042 9/22 复测允许", r2.allowed === true);
// 跨版本同量表：C-318 PMH v1.0 9/10，v2.0 也受间隔限制（9/15 前不行）
const r3 = checkRetest(seed.assessments, "C-318", "PMH", "2026-09-16");
check("同量表跨版本：基线为 r2 更正版", r3.last?.revision === 2);
check("9/16（距 9/10 仅 6 天）跨版本复测拒绝", r3.allowed === false);

// 7. 提前提交 → 整单拒绝，冲突含个案/量表/前次日期/剩余天数
const early = evaluateSubmission(seed.assessments, {
  action: "new",
  clientId: "C-042",
  scaleKey: GAD7_V1.scaleKey,
  assessDate: "2026-09-21",
  answers: { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0, Q6: 0, Q7: 0 },
  plan: {},
});
check("提前提交 blocked", early.blocked === true);
const cRetest = early.conflicts.find((c) => c.rule === "RETEST_TOO_SOON");
check("拒绝单含 RETEST_TOO_SOON", Boolean(cRetest));
check("冲突个案 C-042", cRetest?.clientId === "C-042");
check("冲突量表 GAD7", cRetest?.scaleId === "GAD7");
check("冲突含前次日期", cRetest?.prevDate === "2026-09-15");
check("冲突含剩余天数 1", cRetest?.remainingDays === 1);

// 8. 高风险无计划 → 拒绝（3 个字段各一条 + 缺条目独立）
const highNoPlan = evaluateSubmission([], {
  action: "new",
  clientId: "C-999",
  scaleKey: GAD7_V1.scaleKey,
  assessDate: "2026-09-21",
  answers: { Q1: 3, Q2: 3, Q3: 3, Q4: 3, Q5: 3, Q6: 2, Q7: 2 }, // 19
  plan: {},
});
check("19 分=高风险", highNoPlan.score.risk === "high");
check("高风险无计划 blocked", highNoPlan.blocked === true);
const planConflicts = highNoPlan.conflicts.filter((c) => c.rule === "PLAN_FIELDS_REQUIRED");
check("缺 3 项联系计划字段", planConflicts.length === 3, String(planConflicts.length));
check("字段含原值（前次风险）/新值", planConflicts.every((c) => c.oldValue && c.newValue && c.field));

// 9. 高风险计划齐全 → 通过
const highWithPlan = evaluateSubmission([], {
  action: "new",
  clientId: "C-999",
  scaleKey: GAD7_V1.scaleKey,
  assessDate: "2026-09-21",
  answers: { Q1: 3, Q2: 3, Q3: 3, Q4: 3, Q5: 3, Q6: 2, Q7: 2 },
  plan: { method: "电话回访", counselor: "王咨询师", dueDate: "2026-09-22" },
});
check("高风险计划齐全通过", highWithPlan.blocked === false);

// 10. 升级（前次 stable → watch）也强制计划
const stableGad: Assessment[] = [{
  id: "A-OLD", clientId: "C-777", scaleId: "GAD7", scaleKey: GAD7_V1.scaleKey, version: "v1.0",
  revision: 1, assessDate: "2026-09-01",
  itemScores: {}, subscaleScores: {}, total: 2, risk: "stable", status: "frozen",
  submittedAt: "2026-09-01T00:00:00Z", createdFrom: { kind: "new" },
}];
const esc = evaluateSubmission(stableGad, {
  action: "new",
  clientId: "C-777",
  scaleKey: GAD7_V1.scaleKey,
  assessDate: "2026-09-21",
  answers: { Q1: 1, Q2: 1, Q3: 1, Q4: 1, Q5: 1, Q6: 1, Q7: 1 }, // 7 watch
  plan: {},
});
check("stable→watch 触发升级", esc.planRequired === true && esc.trigger === "escalation");
check("升级无计划 blocked", esc.blocked === true);
// 未升级且非高风险：不需要计划
const stillStable = evaluateSubmission(stableGad, {
  action: "new", clientId: "C-777", scaleKey: GAD7_V1.scaleKey, assessDate: "2026-09-21",
  answers: { Q1: 0, Q2: 1, Q3: 0, Q4: 0, Q5: 1, Q6: 0, Q7: 0 }, plan: {},
});
check("仍稳定不强制计划", stillStable.planRequired === false && stillStable.blocked === false);

// 11. 更正：不查 7 天间隔、必须原因
const original = seed.assessments.find((a) => a.id.startsWith("A-004"))!;
const corrNoReason = evaluateSubmission(seed.assessments, {
  action: "correction",
  clientId: original.clientId,
  scaleKey: original.scaleKey,
  assessDate: original.assessDate,
  answers: original.itemScores,
  plan: {},
  correctsId: original.id,
});
check("更正无原因 blocked", corrNoReason.blocked === true &&
  corrNoReason.conflicts.some((c) => c.rule === "CORRECTION_REASON_REQUIRED"));
const corrOK = evaluateSubmission(seed.assessments, {
  action: "correction",
  clientId: original.clientId,
  scaleKey: original.scaleKey,
  assessDate: original.assessDate,
  answers: { ...original.itemScores, Q4: 3 },
  plan: {},
  reason: "复核更正",
  correctsId: original.id,
});
check("更正（9/10 同日）不受复测规则拦截", !corrOK.conflicts.some((c) => c.rule === "RETEST_TOO_SOON"));
check("更正有原因通过", corrOK.blocked === false);
check("更正基线为原版本风险", corrOK.baselineRisk === "risk");

// 12. 种子版本链
const c318chain = seed.assessments.filter((a) => a.clientId === "C-318");
check("C-318 保留原版本+更正版共 2 条", c318chain.length === 2);
const r1v = c318chain.find((a) => a.revision === 1)!;
const r2v = c318chain.find((a) => a.revision === 2)!;
check("原版本保留总分 10 与原始条目 Q4=2", r1v.total === 10 && r1v.itemScores.Q4 === 2);
check("新版本总分 11、Q4=3", r2v.total === 11 && r2v.itemScores.Q4 === 3);
check("原版本标记被取代", r1v.supersededById === r2v.id);
check("新版本保留更正原因", r2v.createdFrom.kind === "correction");
check("两版分项分都已冻结留存", Object.keys(r1v.subscaleScores).length === 3 && Object.keys(r2v.subscaleScores).length === 3);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
