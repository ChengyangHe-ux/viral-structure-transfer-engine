import type {
  MigratedVideoPlan,
  RetrievedEditingTechnique,
  VideoStructureAnalysis,
} from "@/lib/schemas";

type EditingTechniqueSeed = Omit<
  RetrievedEditingTechnique,
  "whyMatched" | "score"
> & {
  triggerTerms: string[];
  defaultPriority: number;
};

export const editingTechniqueLibrary: EditingTechniqueSeed[] = [
  {
    id: "result-first-cold-open",
    title: "结果前置冷开场",
    category: "Hook",
    tags: ["前3秒", "结果前置", "反差", "停留"],
    triggerTerms: ["hook", "开头", "前3秒", "0-3", "结果", "反差", "停留", "别划走", "痛点"],
    useCase: "信息流里用户没有耐心听背景铺垫，适合把最终效果或最大反差先抛出。",
    application: "0-2 秒直接展示最强结果/对比，字幕只留一句结论，再用后续镜头证明它为什么成立。",
    expectedImpact: "提升首屏停留，让后续卖点推进拥有观看前提。",
    source: "本地剪辑技巧库 · Hook",
    defaultPriority: 8,
  },
  {
    id: "sensory-macro-product",
    title: "感官微距产品锚点",
    category: "画面质感",
    tags: ["产品特写", "微距", "质感", "真实素材"],
    triggerTerms: ["商品", "产品", "矿泉水", "水", "饮料", "瓶", "瓶身", "口感", "清爽", "质感", "高级", "特写", "真实素材"],
    useCase: "商品介绍不能一直停留在卡片或字幕，需要用可感知的真实细节建立高级感。",
    application: "在每个卖点前后插入 0.4-0.8 秒微距：开盖、水滴、瓶身反光、手持饮用或桌面冷凝水。",
    expectedImpact: "让画面从 PPT 感转为广告片质感，同时给转场提供可剪辑素材。",
    source: "本地剪辑技巧库 · Product Shot",
    defaultPriority: 7,
  },
  {
    id: "scene-ladder-broll",
    title: "场景阶梯 B-roll",
    category: "场景切换",
    tags: ["B-roll", "多场景", "生活方式", "情绪曲线"],
    triggerTerms: ["场景", "切换", "不要一样", "b-roll", "生活", "通勤", "运动", "办公", "户外", "真实视频", "图片多", "变换"],
    useCase: "当用户觉得画面单一时，用不同生活场景承接同一卖点，形成视觉推进。",
    application: "按“痛点场景 → 解决场景 → 享受场景 → CTA 场景”排镜，每个场景只承担一个情绪任务。",
    expectedImpact: "减少单页卡片感，建立更像短视频广告的情绪曲线。",
    source: "本地剪辑技巧库 · B-roll",
    defaultPriority: 7,
  },
  {
    id: "match-cut-transition",
    title: "动作/形状匹配转场",
    category: "转场",
    tags: ["Match cut", "卡点", "镜头衔接", "高级感"],
    triggerTerms: ["转场", "卡点", "节奏", "机械", "高级", "切换", "镜头", "动画"],
    useCase: "不同场景之间如果硬切会像模板，适合用相似动作或形状做自然连接。",
    application: "用瓶身竖线、手部拿起、圆形水波、开盖动作做形状/动作匹配，在重拍点完成切换。",
    expectedImpact: "让场景切换更顺滑，降低机械翻页感。",
    source: "本地剪辑技巧库 · Transition",
    defaultPriority: 6,
  },
  {
    id: "beat-synced-caption-bursts",
    title: "卡点短字幕爆破",
    category: "字幕节奏",
    tags: ["字幕密度", "卡点", "关键词", "节奏"],
    triggerTerms: ["字幕", "文案", "节奏", "卡点", "音乐", "口播", "短句", "关键词"],
    useCase: "短视频字幕要像剪辑节拍的一部分，而不是完整段落说明。",
    application: "每屏控制 8-14 个汉字，重拍只放关键词；解释句拆成 2-3 次弹出，结论词用更强对比。",
    expectedImpact: "降低阅读压力，让卖点跟音乐和镜头动作同步。",
    source: "本地剪辑技巧库 · Caption",
    defaultPriority: 6,
  },
  {
    id: "proof-card-insert",
    title: "证据卡片插入",
    category: "信任建立",
    tags: ["证据", "参数", "背书", "可信"],
    triggerTerms: ["证据", "数据", "参数", "评价", "背书", "可信", "来源", "证明", "矿物质", "水源"],
    useCase: "卖点容易显得空时，用短证据卡片把利益表达落到可验证线索上。",
    application: "在中段加入 0.8-1.2 秒证据卡：参数/来源/用户反馈，只呈现一个可信点并标注待补素材。",
    expectedImpact: "增强转化说服力，同时保留合规边界。",
    source: "本地剪辑技巧库 · Proof",
    defaultPriority: 5,
  },
  {
    id: "benefit-ladder-copy",
    title: "功能到利益阶梯",
    category: "卖点推进",
    tags: ["卖点", "利益翻译", "结构推进", "消费品"],
    triggerTerms: ["卖点", "功能", "介绍", "推进", "结构", "消费", "商品", "适合", "人群"],
    useCase: "商品介绍如果只报参数会无聊，需要把功能转换成用户当下能感受到的收益。",
    application: "按“是什么 → 为什么可信 → 用起来怎样 → 适合谁”推进，每段只说一个利益点。",
    expectedImpact: "让文案从说明书变成种草逻辑。",
    source: "本地剪辑技巧库 · Copy",
    defaultPriority: 6,
  },
  {
    id: "clean-final-shelf-cta",
    title: "干净货架式 CTA",
    category: "CTA",
    tags: ["结尾", "转化", "行动指令", "品牌收束"],
    triggerTerms: ["结尾", "cta", "购买", "收藏", "领取", "入口", "行动", "品牌", "转化"],
    useCase: "15 秒广告结尾不适合继续堆卖点，需要把产品、主张和下一步动作放在同一屏。",
    application: "最后 1.5-2 秒固定产品主视觉 + 一句主张 + 一个低门槛行动，音乐收束不再切新信息。",
    expectedImpact: "提高记忆点和交付完整度，避免结尾散掉。",
    source: "本地剪辑技巧库 · CTA",
    defaultPriority: 5,
  },
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function compact(items: Array<string | undefined>) {
  return items.filter(Boolean).join("\n");
}

function buildRetrievalText({
  targetBrief,
  userMaterials,
  direction,
  analysis,
}: {
  targetBrief: string;
  userMaterials?: string;
  direction?: string;
  analysis: VideoStructureAnalysis;
}) {
  return normalize(
    compact([
      targetBrief,
      userMaterials,
      direction,
      analysis.summary,
      analysis.contentPromise,
      analysis.pacing.rhythmNotes,
      analysis.visualPackaging.editingNotes,
      analysis.reusableTemplate.join(" "),
      analysis.hookPatterns.map((hook) => `${hook.type} ${hook.expression} ${hook.transferableRule}`).join(" "),
      analysis.beatMap
        .map(
          (beat) =>
            `${beat.timeRange} ${beat.shotPurpose} ${beat.visualObservation} ${beat.captionObservation} ${beat.transferableRule}`,
        )
        .join(" "),
    ]),
  );
}

function scoreTechnique(technique: EditingTechniqueSeed, retrievalText: string) {
  const whyMatched: string[] = [];
  const matchedTerms = new Set<string>();
  let score = technique.defaultPriority;

  for (const term of technique.triggerTerms) {
    const normalizedTerm = normalize(term);
    if (normalizedTerm && retrievalText.includes(normalizedTerm)) {
      score += 8;
      matchedTerms.add(term);
    }
  }

  for (const tag of technique.tags) {
    const normalizedTag = normalize(tag);
    if (normalizedTag && retrievalText.includes(normalizedTag)) {
      score += 4;
      matchedTerms.add(tag);
    }
  }

  if (matchedTerms.size) {
    whyMatched.push(`命中关键词：${Array.from(matchedTerms).slice(0, 5).join(" / ")}`);
  } else {
    whyMatched.push("作为短视频生成的基础剪辑约束补入。");
  }

  return { score, whyMatched };
}

export function retrieveEditingTechniques({
  targetBrief,
  userMaterials,
  direction,
  analysis,
  limit = 5,
}: {
  targetBrief: string;
  userMaterials?: string;
  direction?: string;
  analysis: VideoStructureAnalysis;
  limit?: number;
}): RetrievedEditingTechnique[] {
  const retrievalText = buildRetrievalText({
    targetBrief,
    userMaterials,
    direction,
    analysis,
  });

  return editingTechniqueLibrary
    .map((technique) => {
      const { score, whyMatched } = scoreTechnique(technique, retrievalText);
      return {
        id: technique.id,
        title: technique.title,
        category: technique.category,
        tags: technique.tags,
        useCase: technique.useCase,
        application: technique.application,
        expectedImpact: technique.expectedImpact,
        source: technique.source,
        score,
        whyMatched,
      };
    })
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "zh-Hans-CN"))
    .slice(0, limit);
}

export function formatEditingTechniquesForPrompt(techniques: RetrievedEditingTechnique[]) {
  return techniques
    .map(
      (technique, index) => `${index + 1}. [${technique.category}] ${technique.title}
- 命中原因：${technique.whyMatched.join("；")}
- 使用场景：${technique.useCase}
- 应用方式：${technique.application}
- 预期效果：${technique.expectedImpact}`,
    )
    .join("\n\n");
}

function appendOnce(value: string, hint: string) {
  if (value.includes(hint.slice(0, 12))) return value;
  return `${value}；${hint}`;
}

function findTechnique(techniques: RetrievedEditingTechnique[], id: string) {
  return techniques.find((technique) => technique.id === id);
}

export function attachEditingTechniquesToPlan({
  plan,
  techniques,
}: {
  plan: MigratedVideoPlan;
  techniques: RetrievedEditingTechnique[];
}): MigratedVideoPlan {
  const resultFirst = findTechnique(techniques, "result-first-cold-open");
  const macroShot = findTechnique(techniques, "sensory-macro-product");
  const sceneLadder = findTechnique(techniques, "scene-ladder-broll");
  const matchCut = findTechnique(techniques, "match-cut-transition");
  const captionBurst = findTechnique(techniques, "beat-synced-caption-bursts");
  const cleanCta = findTechnique(techniques, "clean-final-shelf-cta");

  const versions = plan.versions.map((version) => ({
    ...version,
    scriptBeats: version.scriptBeats.map((beat, index, beats) => {
      const isFirst = index === 0;
      const isLast = index === beats.length - 1;
      const nextBeat = { ...beat };

      if (isFirst && resultFirst) {
        nextBeat.transitionAndRhythm = appendOnce(
          nextBeat.transitionAndRhythm,
          "RAG：0-2秒先给最强结果/反差，再解释原因",
        );
      }
      if ((isFirst || index === 1) && macroShot) {
        nextBeat.visualSuggestion = appendOnce(
          nextBeat.visualSuggestion,
          "RAG：补0.4-0.8秒真实微距/手部/产品质感镜头",
        );
      }
      if (!isFirst && !isLast && sceneLadder) {
        nextBeat.visualSuggestion = appendOnce(
          nextBeat.visualSuggestion,
          "RAG：按痛点/解决/享受场景轮换B-roll，避免同一场景停留",
        );
      }
      if (matchCut) {
        nextBeat.transitionAndRhythm = appendOnce(
          nextBeat.transitionAndRhythm,
          "RAG：用动作或形状匹配做自然转场",
        );
      }
      if (captionBurst) {
        nextBeat.packagingStyle = appendOnce(
          nextBeat.packagingStyle,
          "RAG：每屏8-14字，关键词跟重拍弹出",
        );
      }
      if (isLast && cleanCta) {
        nextBeat.visualSuggestion = appendOnce(
          nextBeat.visualSuggestion,
          "RAG：固定产品主视觉+一句主张+一个行动入口收束",
        );
      }

      return nextBeat;
    }),
  }));

  const ragNotes = techniques.map(
    (technique) => `RAG剪辑技巧「${technique.title}」：${technique.application}`,
  );

  return {
    ...plan,
    versions,
    retrievedTechniques: techniques,
    productionNotes: [
      ...ragNotes,
      ...plan.productionNotes.filter((note) => !note.startsWith("RAG剪辑技巧")),
    ],
  };
}
