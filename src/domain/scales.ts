// 领域数据：量表及版本目录
// 一个量表可有多个版本；条目随版本录入；正/反向计分由条目 direction 决定。
// 风险等级区间随版本定义，数据变更只改本文件。

import type { RiskLevel, ScaleVersion } from "./types";

const GAD_OPTIONS = ["完全不会", "好几天", "一半以上天数", "几乎每天"];

const PMH_OPTIONS = ["从不", "偶尔", "经常", "总是"];

export const RISK_LABEL: Record<RiskLevel, string> = {
  stable: "稳定",
  watch: "关注",
  risk: "中风险",
  high: "高风险",
};

export const RISK_ORDER: RiskLevel[] = ["stable", "watch", "risk", "high"];

// GAD-7 焦虑筛查 v1.0（7 条，均为正向，0-3 分）
export const GAD7_V1: ScaleVersion = {
  scaleId: "GAD7",
  scaleName: "广泛性焦虑筛查",
  version: "v1.0",
  scaleKey: "GAD7@v1.0",
  releasedOn: "2025-01-01",
  note: "7 条 0-3 四级评分，全部正向计分；概念分项用于趋势观察。",
  optionValues: [0, 1, 2, 3],
  optionLabels: GAD_OPTIONS,
  items: [
    { code: "Q1", text: "感到紧张、焦虑或急切", direction: "forward", subscale: "情绪唤起" },
    { code: "Q2", text: "不能停止或控制担忧", direction: "forward", subscale: "情绪唤起" },
    { code: "Q3", text: "对各种各样的事情担忧过多", direction: "forward", subscale: "情绪唤起" },
    { code: "Q4", text: "很难放松下来", direction: "forward", subscale: "躯体反应" },
    { code: "Q5", text: "坐立不安，难以静坐", direction: "forward", subscale: "躯体反应" },
    { code: "Q6", text: "变得容易烦恼或急躁", direction: "forward", subscale: "躯体反应" },
    { code: "Q7", text: "感到将有可怕的事情发生而害怕", direction: "forward", subscale: "灾难预期" },
  ],
  bands: [
    { min: 0, max: 4, level: "stable" },
    { min: 5, max: 9, level: "watch" },
    { min: 10, max: 14, level: "risk" },
    { min: 15, max: 21, level: "high" },
  ],
};

// 心理健康状态 PMH v1.0（6 条，0-3 分；Q3、Q5 反向计分；总分 6-24）
export const PMH_V1: ScaleVersion = {
  scaleId: "PMH",
  scaleName: "心理健康状态评估",
  version: "v1.0",
  scaleKey: "PMH@v1.0",
  releasedOn: "2024-06-01",
  note: "6 条 0-3 评分，Q3、Q5 反向计分（3-原始分）；含情绪、社会、自我三个分项。",
  optionValues: [0, 1, 2, 3],
  optionLabels: PMH_OPTIONS,
  items: [
    { code: "Q1", text: "我对日常生活感到有兴趣", direction: "forward", subscale: "情绪状态" },
    { code: "Q2", text: "我能平静地面对自己的情绪", direction: "forward", subscale: "情绪状态" },
    { code: "Q3", text: "我常常感到难以入睡、疲惫不堪", direction: "reverse", subscale: "情绪状态" },
    { code: "Q4", text: "我愿意主动联系朋友或家人", direction: "forward", subscale: "社会支持" },
    { code: "Q5", text: "我在人群中会感到孤立无援", direction: "reverse", subscale: "社会支持" },
    { code: "Q6", text: "我觉得自己有能力应对当前困扰", direction: "forward", subscale: "自我效能" },
  ],
  bands: [
    { min: 0, max: 8, level: "high" },
    { min: 9, max: 13, level: "risk" },
    { min: 14, max: 18, level: "watch" },
    { min: 19, max: 24, level: "stable" },
  ],
};

// PMH v2.0：修订 Q5 表述、新增 Q7 条目；区间沿用 v1.0 语义（新满分 27）
export const PMH_V2: ScaleVersion = {
  scaleId: "PMH",
  scaleName: "心理健康状态评估",
  version: "v2.0",
  scaleKey: "PMH@v2.0",
  releasedOn: "2026-03-01",
  note: "修订 Q5 表述并新增 Q7 条目；Q3、Q5 仍为反向计分；分项口径不变。",
  optionValues: [0, 1, 2, 3],
  optionLabels: PMH_OPTIONS,
  items: [
    { code: "Q1", text: "我对日常生活感到有兴趣", direction: "forward", subscale: "情绪状态" },
    { code: "Q2", text: "我能平静地面对自己的情绪", direction: "forward", subscale: "情绪状态" },
    { code: "Q3", text: "我常常感到难以入睡、疲惫不堪", direction: "reverse", subscale: "情绪状态" },
    { code: "Q4", text: "我愿意主动联系朋友或家人", direction: "forward", subscale: "社会支持" },
    { code: "Q5", text: "即便身处人群，我也常感到孤立无援", direction: "reverse", subscale: "社会支持" },
    { code: "Q6", text: "我觉得自己有能力应对当前困扰", direction: "forward", subscale: "自我效能" },
    { code: "Q7", text: "我能够为咨询中设定的目标持续行动", direction: "forward", subscale: "自我效能" },
  ],
  bands: [
    { min: 0, max: 9, level: "high" },
    { min: 10, max: 15, level: "risk" },
    { min: 16, max: 21, level: "watch" },
    { min: 22, max: 27, level: "stable" },
  ],
};

export const SCALE_VERSIONS: ScaleVersion[] = [GAD7_V1, PMH_V1, PMH_V2];

export function getScale(scaleKey: string): ScaleVersion {
  const scale = SCALE_VERSIONS.find((entry) => entry.scaleKey === scaleKey);
  if (!scale) throw new Error(`未知量表版本：${scaleKey}`);
  return scale;
}

export function versionsOf(scaleId: string): ScaleVersion[] {
  return SCALE_VERSIONS.filter((entry) => entry.scaleId === scaleId);
}
