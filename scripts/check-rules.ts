import { evaluateSubmission, scoreAssessment, levelForScore, diffDays, addDays, retestReminder } from "../src/domain/rules";
import { SCALE_VERSIONS, PHQ9_2024, GAD7_2024, RSES_2024 } from "../src/domain/scales";
import { buildSeedState } from "../src/domain/seed";
import type { AssessmentVersion, ItemAnswer } from "../src/domain/types";

let pass = 0;
let fail = 0;
function assert(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name, detail); }
}

// 1. 正向计分 PHQ9 全 1 = 9，关注
{
  const ans: ItemAnswer[] = PHQ9_2024.items.map((i) => ({ itemCode: i.code, value: 1 }));
  const r = scoreAssessment(PHQ9_2024, ans);
  assert("PHQ9 全 1 → 总分 9", r.total === 9, `got ${r.total}`);
  assert("PHQ9 9 分 → 关注", levelForScore(PHQ9_2024, 9) === "watch");
}

// 2. RSES 反向计分：全选 0 时，正向条目 0、反向条目 3 → 15（中风险）
{
  const ans: ItemAnswer[] = RSES_2024.items.map((i) => ({ itemCode: i.code, value: 0 }));
  const r = scoreAssessment(RSES_2024, ans);
  assert("RSES 全 0：5 反向条目翻转为 3 → 总分 15", r.total === 15, `got ${r.total}`);
  assert("RSES 15 → 中风险（分越低越危险）", levelForScore(RSES_2024, 15) === "moderate");
  const neg = r.subscales.find((s) => s.code === "RSES-NEG")!;
  assert("RSES 自我否定分项分 15", neg.score === 15);
  // 全选 3 时反向 → 0，正向 3*5=15... 正向 15，反向 0 = 15？实际 正向3*5=15
  const ans3 = RSES_2024.items.map((i) => ({ itemCode: i.code, value: 3 }));
  const r3 = scoreAssessment(RSES_2024, ans3);
  assert("RSES 全 3：正向 15 + 反向 0 = 15（对称性）", r3.total === 15, `got ${r3.total}`);
  // 全部选最“健康”组合：正向3、反向0 → 30 稳定
  const healthy = RSES_2024.items.map((i) => ({ itemCode: i.code, value: i.reverse ? 0 : 3 }));
  const rh = scoreAssessment(RSES_2024, healthy);
  assert("RSES 健康作答 → 30 稳定", rh.total === 30 && levelForScore(RSES_2024, 30) === "stable", `got ${rh.total}`);
}

// 3. 缺条目拒绝
{
  const seed = buildSeedState();
  const c = seed.cases[0];
  const ev = evaluateSubmission(
    { caseId: c.id, scale: GAD7_2024, testDate: addDays("2026-01-01", 30), answers: [], kind: "initial" },
    [], c.code, addDays("2026-01-01", 30)
  );
  assert("缺 7 条 → 拒绝且列出缺失", !ev.ok && ev.missing.length === 7);
}

// 4. 7 天复测闸门：构造 v1 后第 3 天提交 → 拒绝并给出剩余 4 天
{
  const scale = GAD7_2024;
  const day0 = "2026-03-01";
  const v1: AssessmentVersion = {
    id: "a1", caseId: "c1", scaleCode: "GAD7", version: scale.version, seq: 1, kind: "initial",
    testDate: day0,
    itemAnswers: scale.items.map((i) => ({ itemCode: i.code, value: 1 })),
    subscaleScores: [], totalScore: 7, riskLevel: "watch", status: "valid", createdAt: day0,
  };
  const earlyAnswers = scale.items.map((i) => ({ itemCode: i.code, value: 0 }));
  const ev = evaluateSubmission(
    { caseId: "c1", scale, testDate: addDays(day0, 3), answers: earlyAnswers, kind: "retest" },
    [v1], "C-TEST", day0
  );
  assert("第 3 天复测被拒", !ev.ok && !!ev.retestBlock);
  assert("剩余 4 天", ev.retestBlock?.remainingDays === 4, `got ${ev.retestBlock?.remainingDays}`);
  assert("拒绝信息含个案/量表/前次日期", ev.retestBlock?.caseCode === "C-TEST" && ev.retestBlock.previousDate === day0);
  assert("冲突含原值/新值/规则", ev.conflicts[0]?.oldValue.includes(day0) && ev.conflicts[0]?.rule.includes("R-RETEST"));

  const ev7 = evaluateSubmission(
    { caseId: "c1", scale, testDate: addDays(day0, 7), answers: earlyAnswers, kind: "retest" },
    [v1], "C-TEST", day0
  );
  assert("第 7 天复测通过（未升级无需计划）", ev7.ok, ev7.rejections.join(";"));
}

// 5. R-GATE：关注 → 高风险，无联系计划拒绝；补齐后通过
{
  const scale = GAD7_2024;
  const day0 = "2026-03-01";
  const v1: AssessmentVersion = {
    id: "a1", caseId: "c1", scaleCode: "GAD7", version: scale.version, seq: 1, kind: "initial",
    testDate: addDays(day0, -20),
    itemAnswers: scale.items.map((i) => ({ itemCode: i.code, value: 1 })),
    subscaleScores: [], totalScore: 7, riskLevel: "watch", status: "valid", createdAt: day0,
  };
  const high = scale.items.map((i) => ({ itemCode: i.code, value: 3 }));
  const noPlan = evaluateSubmission(
    { caseId: "c1", scale, testDate: day0, answers: high, kind: "retest" },
    [v1], "C-TEST", day0
  );
  assert("升级高风险且无计划 → 拒绝", !noPlan.ok && noPlan.gateRequired && noPlan.conflicts.length > 0);
  assert("触发类型 escalation", noPlan.gateTrigger === "escalation");
  const withPlan = evaluateSubmission(
    {
      caseId: "c1", scale, testDate: day0, answers: high, kind: "retest",
      contact: { content: "电话随访", counselor: "李敏", deadline: addDays(day0, 2) },
    },
    [v1], "C-TEST", day0
  );
  assert("三要素齐全 → 接受", withPlan.ok, withPlan.rejections.join(";"));
  const lateDeadline = evaluateSubmission(
    {
      caseId: "c1", scale, testDate: day0, answers: high, kind: "retest",
      contact: { content: "x", counselor: "李敏", deadline: addDays(day0, -1) },
    },
    [v1], "C-TEST", day0
  );
  assert("时限早于提交日 → 拒绝", !lateDeadline.ok);
}

// 6. 初测直接高风险（first-high）
{
  const scale = PHQ9_2024;
  const day0 = "2026-03-01";
  const high = scale.items.map((i) => ({ itemCode: i.code, value: 3 })); // 27
  const ev = evaluateSubmission(
    { caseId: "c9", scale, testDate: day0, answers: high, kind: "initial" },
    [], "C-NEW", day0
  );
  assert("初测 27 分高风险 → first-high 闸门", ev.gateRequired && ev.gateTrigger === "first-high");
  assert("无计划 → 拒绝", !ev.ok);
}

// 7. 更正：冻结目标须 valid；更正不受 7 天限制
{
  const scale = GAD7_2024;
  const day0 = "2026-03-01";
  const v1: AssessmentVersion = {
    id: "a1", caseId: "c1", scaleCode: "GAD7", version: scale.version, seq: 1, kind: "initial",
    testDate: addDays(day0, -1),
    itemAnswers: scale.items.map((i) => ({ itemCode: i.code, value: 2 })),
    subscaleScores: [], totalScore: 14, riskLevel: "moderate", status: "valid", createdAt: day0,
  };
  const corrected = scale.items.map((i) => ({ itemCode: i.code, value: 1 }));
  const noReason = evaluateSubmission(
    { caseId: "c1", scale, testDate: day0, answers: corrected, kind: "correction", correctionOfId: "a1" },
    [v1], "C-TEST", day0
  );
  assert("隔日更正不受 7 天限制但缺原因 → 拒绝", !noReason.ok && !noReason.retestBlock);

  const frozen = { ...v1, status: "superseded" as const };
  const evFrozen = evaluateSubmission(
    { caseId: "c1", scale, testDate: day0, answers: corrected, kind: "correction", correctionOfId: "a1", reason: "误录" },
    [frozen], "C-TEST", day0
  );
  assert("更正已冻结版本 → 拒绝且 R-FREEZE 冲突", !evFrozen.ok && evFrozen.conflicts.some((c) => c.rule.includes("R-FREEZE")));

  const ok = evaluateSubmission(
    { caseId: "c1", scale, testDate: day0, answers: corrected, kind: "correction", correctionOfId: "a1", reason: "误录更正" },
    [v1], "C-TEST", day0
  );
  assert("带原因更正有效版本 → 接受", ok.ok, ok.rejections.join(";"));
  assert("更正后 7 分（关注）不触发闸门", !ok.gateRequired);
}

// 8. 种子数据自检
{
  const seed = buildSeedState();
  const c042g = seed.assessments.filter((a) => a.caseId === "case-042" && a.scaleCode === "GAD7");
  assert("C-042 GAD7 v1=9 关注、v2=17 高风险", c042g[0].totalScore === 9 && c042g[0].riskLevel === "watch" && c042g[1].totalScore === 17 && c042g[1].riskLevel === "high");
  const c318 = seed.assessments.filter((a) => a.caseId === "case-318");
  assert("C-318 v1 superseded、v2 correction valid", c318[0].status === "superseded" && c318[1].status === "valid" && c318[1].kind === "correction");
  const rem = retestReminder(c042g[1]);
  assert("复测提醒 earliestDate = 前次+7", rem.earliestDate === addDays(c042g[1].testDate, 7) && diffDays(c042g[1].testDate, rem.earliestDate) === 7);
  assert("量表目录 3 个版本", SCALE_VERSIONS.length === 3);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
