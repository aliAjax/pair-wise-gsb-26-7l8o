// 状态层端到端：模拟 localStorage，验证拒绝不写入、接受落版本/计划、持久化往返
import { GAD7_2024, PHQ9_2024 } from "../src/domain/scales";

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}
(globalThis as any).localStorage = new MemStorage();
(globalThis as any).window = { addEventListener() {}, removeEventListener() {} };

const store = await import("../src/state/store.ts");

let pass = 0, fail = 0;
const assert = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, detail); }
};

const s0 = store.getSnapshot();
const asmtCount0 = s0.assessments.length;
const planCount0 = s0.plans.length;
const logCount0 = s0.logs.length;
const targetCase = s0.cases.find((c) => c.code === "C-203")!; // PHQ9 v1 在 9 天前

// 1) 提前复测（今天距 v1 仅 9 天但选择今天提交 → 间隔 9 天通过；改测昨天→8 天也通过）
// C-203 的 v1 是 9 天前：提交 3 天前的日期 = 间隔 6 天 → 拒绝
const early = store.submitAssessment({
  caseId: targetCase.id,
  scaleCode: "PHQ9",
  testDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
  values: Object.fromEntries(PHQ9_2024.items.map((i) => [i.code, 2])),
  kind: "retest",
});
assert("提前复测被拒", !early.ok);
assert("拒绝未写入测评版本", store.getSnapshot().assessments.length === asmtCount0);
assert("拒绝未写入联系计划", store.getSnapshot().plans.length === planCount0);
assert("拒绝已留痕（log +1）", store.getSnapshot().logs.length === logCount0 + 1);
assert("拒绝信息列出个案/量表/前次/剩余天数",
  early.evaluation?.retestBlock?.caseCode === "C-203" &&
  early.evaluation.retestBlock.scaleName.includes("PHQ") &&
  early.evaluation?.retestBlock?.remainingDays === 1,
  JSON.stringify(early.evaluation?.retestBlock));

// 2) 升级但缺联系计划 → 拒绝；补齐后接受，版本+计划落库
const c042 = s0.cases.find((c) => c.code === "C-042")!; // GAD7 上次 3 天前，复测会先撞 7 天
// 改用无近期记录的新个案：建档
const created = store.addCase({ code: "C-900", alias: "测试来访者", tag: "焦虑" });
assert("新个案建档", !("error" in created));
if (!("error" in created)) {
  // 初测高风险但无计划 → 拒绝
  const noGate = store.submitAssessment({
    caseId: created.id, scaleCode: "GAD7",
    testDate: new Date().toISOString().slice(0, 10),
    values: Object.fromEntries(GAD7_2024.items.map((i) => [i.code, 3])),
    kind: "initial",
  });
  assert("初测高风险无计划 → 拒绝", !noGate.ok && noGate.evaluation?.gateTrigger === "first-high");

  const before = store.getSnapshot().assessments.length;
  const ok = store.submitAssessment({
    caseId: created.id, scaleCode: "GAD7",
    testDate: new Date().toISOString().slice(0, 10),
    values: Object.fromEntries(GAD7_2024.items.map((i) => [i.code, 3])),
    kind: "initial",
    contact: { content: "24h 内安全通话", counselor: "陈恪", deadline: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) },
  });
  assert("三要素齐全 → 接受", ok.ok && !!ok.assessment);
  assert("接受后测评版本 +1", store.getSnapshot().assessments.length === before + 1);
  const newPlan = store.getSnapshot().plans.find((p) => p.assessmentId === ok.assessment?.id);
  assert("联系计划随单登记且为 pending", !!newPlan && newPlan.status === "pending" && newPlan.counselor === "陈恪");

  store.completePlan(newPlan!.id);
  assert("完成计划标记 done", store.getSnapshot().plans.find((p) => p.id === newPlan!.id)?.status === "done");
}

// 3) 持久化往返：重置内存存储重建 store 模块状态不可行（模块单例），
// 改为直接校验 localStorage 中的 JSON 与当前状态一致
const raw = (globalThis as any).localStorage.getItem("hxwl-12-assessment-console-v1");
const persisted = JSON.parse(raw);
const live = store.getSnapshot();
assert("持久化测评版本数与内存一致", persisted.assessments.length === live.assessments.length);
assert("持久化计划数与内存一致", persisted.plans.length === live.plans.length);
assert("持久化含新个案 C-900", persisted.cases.some((c: any) => c.code === "C-900"));
assert("冻结版本保留原字段（C-318 v1 superseded 且总分 9）",
  persisted.assessments.some((a: any) => a.caseId === "case-318" && a.seq === 1 && a.status === "superseded" && a.totalScore === 9));

// 4) 重置演示
store.resetDemo();
assert("重置后恢复 8 个演示测评", store.getSnapshot().assessments.length === 8);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
