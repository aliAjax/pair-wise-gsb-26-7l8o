import type { RiskLevel, ScaleVersion } from "./types";

// 量表版本目录：条目、正反向标记、分段阈值全部是领域数据，
// 界面与计分规则只引用，不在组件里硬编码。

const LEVEL: Record<RiskLevel, RiskLevel> = {
  stable: "stable",
  watch: "watch",
  moderate: "moderate",
  high: "high",
};

const phq9Options = ["完全不会", "好几天", "一半以上天数", "几乎每天"];

export const PHQ9_2024: ScaleVersion = {
  scaleCode: "PHQ9",
  version: "PHQ-9-2024",
  name: "患者健康问卷 · 抑郁（PHQ-9）",
  publishedAt: "2024-01",
  instruction: "根据过去两周的实际情况，为每个条目选择出现频率。所有条目均为正向计分（0–3）。",
  optionsLabel: phq9Options,
  items: [
    { code: "PHQ9-1", text: "做事时提不起劲或没有兴趣", reverse: false, min: 0, max: 3 },
    { code: "PHQ9-2", text: "感到心情低落、沮丧或绝望", reverse: false, min: 0, max: 3 },
    { code: "PHQ9-3", text: "入睡困难、睡不安稳或睡眠过多", reverse: false, min: 0, max: 3 },
    { code: "PHQ9-4", text: "感觉疲倦或没有活力", reverse: false, min: 0, max: 3 },
    { code: "PHQ9-5", text: "食欲不振或吃太多", reverse: false, min: 0, max: 3 },
    { code: "PHQ9-6", text: "觉得自己很糟，或觉得自己很失败，或让自己/家人失望", reverse: false, min: 0, max: 3 },
    { code: "PHQ9-7", text: "对事物专注有困难，例如阅读报纸或看电视时", reverse: false, min: 0, max: 3 },
    { code: "PHQ9-8", text: "动作或说话速度缓慢到他人已察觉，或正好相反——烦躁、动来动去", reverse: false, min: 0, max: 3 },
    { code: "PHQ9-9", text: "有不如死掉或用某种方式伤害自己的念头", reverse: false, min: 0, max: 3 },
  ],
  subscales: [
    {
      code: "PHQ9-CORE",
      name: "情绪与躯体",
      itemCodes: ["PHQ9-1", "PHQ9-2", "PHQ9-3", "PHQ9-4", "PHQ9-5", "PHQ9-6", "PHQ9-7", "PHQ9-8", "PHQ9-9"],
    },
  ],
  bands: [
    { min: 0, max: 5, level: LEVEL.stable },
    { min: 5, max: 10, level: LEVEL.watch },
    { min: 10, max: 15, level: LEVEL.moderate },
    { min: 15, max: 28, level: LEVEL.high },
  ],
  highRiskThreshold: 15,
};

const gad7Options = ["完全不会", "好几天", "一半以上天数", "几乎每天"];

export const GAD7_2024: ScaleVersion = {
  scaleCode: "GAD7",
  version: "GAD-7-2024",
  name: "广泛性焦虑量表（GAD-7）",
  publishedAt: "2024-01",
  instruction: "根据过去两周的实际情况，为每个条目选择出现频率。所有条目均为正向计分（0–3）。",
  optionsLabel: gad7Options,
  items: [
    { code: "GAD7-1", text: "感觉紧张、焦虑或急切", reverse: false, min: 0, max: 3 },
    { code: "GAD7-2", text: "不能停止或控制担忧", reverse: false, min: 0, max: 3 },
    { code: "GAD7-3", text: "对各种各样的事情担忧过多", reverse: false, min: 0, max: 3 },
    { code: "GAD7-4", text: "很难放松下来", reverse: false, min: 0, max: 3 },
    { code: "GAD7-5", text: "烦躁不安，以至于难以静坐", reverse: false, min: 0, max: 3 },
    { code: "GAD7-6", text: "变得容易烦恼或急躁", reverse: false, min: 0, max: 3 },
    { code: "GAD7-7", text: "感到似乎有可怕的事情发生而害怕", reverse: false, min: 0, max: 3 },
  ],
  subscales: [
    {
      code: "GAD7-CORE",
      name: "焦虑总体",
      itemCodes: ["GAD7-1", "GAD7-2", "GAD7-3", "GAD7-4", "GAD7-5", "GAD7-6", "GAD7-7"],
    },
  ],
  bands: [
    { min: 0, max: 5, level: LEVEL.stable },
    { min: 5, max: 10, level: LEVEL.watch },
    { min: 10, max: 15, level: LEVEL.moderate },
    { min: 15, max: 22, level: LEVEL.high },
  ],
  highRiskThreshold: 15,
};

const rsesOptions = ["很不同意", "不同意", "同意", "很同意"];

export const RSES_2024: ScaleVersion = {
  scaleCode: "RSES",
  version: "RSES-2024",
  name: "罗森伯格自尊量表（RSES）",
  publishedAt: "2024-01",
  instruction: "根据当下对自己的总体看法作答。正向条目直接计分；反向条目（已标注「反向」）按 4-选项值 翻转后计入总分。",
  optionsLabel: rsesOptions,
  items: [
    { code: "RSES-1", text: "总体而言，我对自己是一个满意的人", reverse: false, min: 0, max: 3 },
    { code: "RSES-2", text: "有时我觉得自己一点都不好", reverse: true, min: 0, max: 3 },
    { code: "RSES-3", text: "我觉得我有一些好的品质", reverse: false, min: 0, max: 3 },
    { code: "RSES-4", text: "我能像大多数人一样把事情做好", reverse: false, min: 0, max: 3 },
    { code: "RSES-5", text: "我觉得自己没有什么值得自豪的地方", reverse: true, min: 0, max: 3 },
    { code: "RSES-6", text: "有时我确实感到自己很无用", reverse: true, min: 0, max: 3 },
    { code: "RSES-7", text: "我觉得自己是一个有价值的人，至少与他人处在同一层次", reverse: false, min: 0, max: 3 },
    { code: "RSES-8", text: "我希望我能为自己赢得更多尊重", reverse: true, min: 0, max: 3 },
    { code: "RSES-9", text: "总而言之，我倾向于觉得自己是一个失败者", reverse: true, min: 0, max: 3 },
    { code: "RSES-10", text: "我对自己持肯定态度", reverse: false, min: 0, max: 3 },
  ],
  subscales: [
    {
      code: "RSES-POS",
      name: "自我肯定",
      itemCodes: ["RSES-1", "RSES-3", "RSES-4", "RSES-7", "RSES-10"],
    },
    {
      code: "RSES-NEG",
      name: "自我否定（反向）",
      itemCodes: ["RSES-2", "RSES-5", "RSES-6", "RSES-8", "RSES-9"],
    },
  ],
  bands: [
    { min: 0, max: 11, level: LEVEL.high },
    { min: 11, max: 21, level: LEVEL.moderate },
    { min: 21, max: 26, level: LEVEL.watch },
    { min: 26, max: 31, level: LEVEL.stable },
  ],
  // RSES 越低越危险，分段即权威规则；阈值用于规则文案展示
  highRiskThreshold: 10,
};

export const SCALE_VERSIONS: ScaleVersion[] = [PHQ9_2024, GAD7_2024, RSES_2024];
