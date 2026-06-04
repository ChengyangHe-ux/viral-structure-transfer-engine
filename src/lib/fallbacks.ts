import type {
  MediaMeta,
  MigratedVideoPlan,
  VideoStructureAnalysis,
} from "@/lib/schemas";

type AnalysisFallbackInput = {
  sampleTitle: string;
  sampleNotes: string;
  mediaMeta?: MediaMeta;
};

type PlanFallbackInput = {
  projectTitle: string;
  targetBrief: string;
  userMaterials?: string;
  analysis: VideoStructureAnalysis;
};

function compactBrief(brief: string, maxLength = 18) {
  const sentence = brief.split(/[，。,.；;]/)[0]?.trim() || brief.trim();
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength)}...` : sentence;
}

export function createFallbackAnalysis({
  sampleTitle,
  sampleNotes,
  mediaMeta,
}: AnalysisFallbackInput): VideoStructureAnalysis {
  const duration = mediaMeta?.durationSeconds;
  const shortDuration = duration && duration < 20;

  return {
    sampleTitle,
    summary: `基于样例描述提炼出一套可迁移的短视频结构：先用强钩子制造停留，再用连续证据推进信任，最后用清晰行动指令完成转化。样例线索：${sampleNotes.slice(0, 160)}`,
    targetAudience: "对结果敏感、浏览速度快、需要在前 3 秒被说服的短视频用户",
    contentPromise: "用一个明确痛点或反差结果承诺，让用户相信继续看能得到具体收益",
    durationSeconds: duration,
    hookPatterns: [
      {
        type: "反差钩子",
        expression: "开头直接给出和常识相反的结论或前后对比画面",
        transferableRule: "把新主题中最容易被误解、最能制造反差的信息放到 0-3 秒",
      },
      {
        type: "结果前置",
        expression: "先展示最终效果，再解释过程",
        transferableRule: "优先呈现用户最想获得的结果，让后续内容承担证明职责",
      },
    ],
    pacing: {
      opening: shortDuration ? "0-2 秒完成问题和结果展示" : "0-3 秒完成问题、结果和身份确认",
      middle: "每 4-6 秒推进一个新证据，避免同一卖点停留过久",
      ending: "用一句低门槛行动指令收束，比如收藏、试用、领取方案或查看详情",
      rhythmNotes: "短句字幕配合快速切镜，关键卖点处用 0.3-0.5 秒停顿强化记忆点",
    },
    subtitleLayout: {
      placement: "底部安全区为主，关键数字或结论可在画面中部短暂放大",
      density: "每屏 8-16 个汉字，避免完整长句压住主体",
      emphasisStyle: "数字、痛点词、结果词用高对比色或描边加重",
    },
    visualPackaging: {
      colorMood: "高对比、干净、偏商业转化的明亮色调",
      framing: "主体居中，关键对比画面使用左右分屏或前后对照",
      motionGraphics: "用箭头、圈选、进度条和标签贴纸标记信息层级",
      editingNotes: "开头和卖点切换处加速，解释段落保持稳定镜头降低理解成本",
    },
    musicAndBeats: [
      {
        moment: "Hook 出现瞬间",
        audioCue: "重拍或音效点",
        editingResponse: "切入结果画面或强字幕",
      },
      {
        moment: "卖点递进",
        audioCue: "节奏稳定的鼓点",
        editingResponse: "每个证据点一次切镜或贴纸弹出",
      },
      {
        moment: "结尾行动",
        audioCue: "音乐降一档或收束音效",
        editingResponse: "画面定格在收益或行动入口",
      },
    ],
    sellingPointProgression: [
      {
        order: 1,
        intent: "制造停留",
        message: "先说用户最在意的问题或反差结论",
      },
      {
        order: 2,
        intent: "建立可信",
        message: "展示过程、证据、数据或真实使用场景",
      },
      {
        order: 3,
        intent: "降低决策成本",
        message: "强调适用人群、使用门槛和立即行动理由",
      },
    ],
    beatMap: [
      {
        timeRange: "0-3s",
        shotPurpose: "抓住注意力",
        visualObservation: "结果画面或强反差画面先出现",
        captionObservation: "一句话结论字幕，突出痛点词",
        transferableRule: "新内容必须在开头承诺具体结果，不从背景铺垫开始",
      },
      {
        timeRange: "3-12s",
        shotPurpose: "解释为什么成立",
        visualObservation: "连续展示 2-3 个证据镜头",
        captionObservation: "短句拆分，关键词高亮",
        transferableRule: "每个镜头只服务一个证明点",
      },
      {
        timeRange: "12-24s",
        shotPurpose: "放大收益和适用场景",
        visualObservation: "使用场景、对比、细节特写交替",
        captionObservation: "字幕从事实转向利益表达",
        transferableRule: "把功能语言翻译成用户收益",
      },
      {
        timeRange: "24-30s",
        shotPurpose: "完成转化",
        visualObservation: "产品/结果/行动入口稳定呈现",
        captionObservation: "明确行动指令",
        transferableRule: "结尾不要引入新卖点，只收束最强理由",
      },
    ],
    reusableTemplate: [
      "反差结论开场",
      "结果画面前置",
      "证据三连击",
      "利益翻译",
      "低门槛行动指令",
    ],
    riskNotes: ["避免直接复刻样例台词、人物设定和具体画面，只迁移结构和方法"],
  };
}

export function createFallbackPlan({
  projectTitle,
  targetBrief,
  userMaterials,
  analysis,
}: PlanFallbackInput): MigratedVideoPlan {
  const briefTopic = compactBrief(targetBrief);
  const materialHint = userMaterials?.trim()
    ? "结合用户已提供素材进行镜头编排"
    : "素材不足时优先使用字幕卡、卖点卡片和结构重排补足表达";
  const baseBeats = [
    {
      timeRange: "0-3s",
      shotPurpose: "用反差或结果抢停留",
      visualSuggestion: "展示目标用户最想看到的结果画面，配合前后对比或近景细节",
      voiceoverOrSubtitle: `别再用老方法做${briefTopic}了，关键其实是这一点。`,
      packagingStyle: "大字标题压底部，核心词高亮，开头 0.5 秒加音效点",
      sellingPointIntent: "先建立继续观看的理由",
      transitionAndRhythm: "第一镜头直接切结果，第二镜头切痛点，不做背景铺垫",
      replaceableAssets: `结果截图、商品特写、用户痛点场景、对比画面；${materialHint}`,
      riskNotes: "避免夸大无法证明的结果",
    },
    {
      timeRange: "3-10s",
      shotPurpose: "拆出第一个证据点",
      visualSuggestion: "用手势、圈选或屏幕录制标出最直观的功能/优势",
      voiceoverOrSubtitle: "第一，它把最麻烦的一步提前处理掉，用户不需要重新学习流程。",
      packagingStyle: "左侧贴纸标注“省一步”，右侧保留主体画面",
      sellingPointIntent: "降低理解成本",
      transitionAndRhythm: "每 2 秒切一个细节，字幕跟随镜头同步出现",
      replaceableAssets: "操作过程、使用前后对比、用户评价片段",
      riskNotes: "不要堆功能列表，每个镜头只讲一个点",
    },
    {
      timeRange: "10-18s",
      shotPurpose: "推进第二个证据点",
      visualSuggestion: "展示真实使用场景，最好有人物或手部动作参与",
      voiceoverOrSubtitle: "第二，它不是看起来高级，而是真的能在日常场景里少踩坑。",
      packagingStyle: "场景标签加小箭头，突出用户具体收益",
      sellingPointIntent: "把功能转成用户收益",
      transitionAndRhythm: "音乐节奏稳定，卖点出现时轻微停顿",
      replaceableAssets: "生活/工作场景、商品细节、结果页、数据卡片",
      riskNotes: "场景要贴近目标人群，不要泛泛而谈",
    },
    {
      timeRange: "18-26s",
      shotPurpose: "制造可信背书",
      visualSuggestion: "放出用户反馈、参数、流程截图或专家/达人视角",
      voiceoverOrSubtitle: "真正值得注意的是，它把效果、成本和上手门槛放在了一起解决。",
      packagingStyle: "三点并列卡片：效果、成本、门槛",
      sellingPointIntent: "补足信任与决策理由",
      transitionAndRhythm: "三连卡点，每个卡片 0.8 秒出现",
      replaceableAssets: "评价截图、参数图、对比图、流程节点",
      riskNotes: "背书素材必须可追溯，避免虚假评价",
    },
    {
      timeRange: "26-35s",
      shotPurpose: "收束行动",
      visualSuggestion: "回到最强结果画面，画面稳定，行动入口清晰",
      voiceoverOrSubtitle: "如果你也遇到这个问题，先收藏这条，再按这个结构试一次。",
      packagingStyle: "底部行动字幕，右上角保留品牌或主题标签",
      sellingPointIntent: "把观看转成下一步动作",
      transitionAndRhythm: "音乐收束，最后一屏停留 1 秒",
      replaceableAssets: "封面图、商品图、二维码/入口、标题卡",
      riskNotes: "结尾只保留一个行动指令",
    },
  ];

  return {
    projectTitle,
    targetBrief,
    strategySummary: `迁移样例的「${analysis.reusableTemplate.join(" + ")}」结构，围绕目标 Brief 生成可编辑短视频脚本。`,
    inheritedStructure: analysis.reusableTemplate,
    versions: [
      {
        versionName: "稳妥转化版",
        positioning: "强调可信证据和低门槛行动，适合商品介绍、服务转化和主推展示版本",
        bestFor: "需要清楚解释卖点、降低用户决策成本的场景",
        scriptBeats: baseBeats,
        coverTitle: "别急着下判断，关键差在这一步",
        captionTitle: "把爆款结构迁移到新内容的 35 秒脚本",
        hashtags: ["结构迁移", "短视频脚本", "AIGC创作"],
      },
      {
        versionName: "强 Hook 版",
        positioning: "把冲突和反差提前，适合争夺前 3 秒停留",
        bestFor: "信息流竞争激烈、用户注意力很短的投放或种草场景",
        scriptBeats: baseBeats.map((beat, index) =>
          index === 0
            ? {
                ...beat,
                voiceoverOrSubtitle: `90% 的人做${briefTopic}，第一步就错了。`,
                visualSuggestion: "先放失败/错误做法，再 0.8 秒切到正确结果",
              }
            : beat,
        ),
        coverTitle: "第一步错了，后面全白费",
        captionTitle: "强 Hook 版：用反差开场重组内容",
        hashtags: ["爆款开头", "反差钩子", "内容种草"],
      },
      {
        versionName: "内容种草版",
        positioning: "语气更自然，强化场景代入和用户体验",
        bestFor: "生活方式、学习工具、消费品和个人 IP 内容",
        scriptBeats: baseBeats.map((beat, index) =>
          index === 0
            ? {
                ...beat,
                voiceoverOrSubtitle: `我试了${briefTopic}之后，最明显的变化是这个。`,
                packagingStyle: "字幕更轻，保留人物/手部动作的真实感",
              }
            : beat,
        ),
        coverTitle: "真实体验后，我会看这 3 点",
        captionTitle: "内容种草版：少一点推销，多一点证据",
        hashtags: ["真实体验", "种草脚本", "短视频结构"],
      },
    ],
    evaluationChecklist: [
      "0-3 秒是否明确给出结果或反差",
      "每个镜头是否只承担一个信息任务",
      "字幕是否突出数字、痛点和行动指令",
      "卖点是否从功能翻译成用户收益",
      "结尾是否只有一个清晰下一步",
    ],
    retrievedTechniques: [],
    awardReadiness: undefined,
    productionNotes: [
      userMaterials?.trim()
        ? `用户素材线索：${userMaterials.trim().slice(0, 120)}`
        : "当前用户素材不足，拍摄前建议补齐结果画面、痛点画面、证据素材和行动入口四类素材",
      "如果后续进入二期视频合成，可直接把 scriptBeats 转成 Remotion/FFmpeg 时间线",
    ],
  };
}

export function createRefinedFallbackPlan(
  plan: MigratedVideoPlan,
  instruction: string,
): MigratedVideoPlan {
  const refined = JSON.parse(JSON.stringify(plan)) as MigratedVideoPlan;
  const directive = instruction.trim();
  const wantsStrongerHook = /hook|开头|前\s*3|停留|反差|冲突/i.test(directive);
  const wantsSofterTone = /口语|自然|种草|年轻|轻松|真实/i.test(directive);
  const wantsMoreProof = /证据|数据|背书|可信|案例|评价/i.test(directive);

  refined.strategySummary = `${refined.strategySummary} 已按自然语言指令修订：${directive}`;
  refined.productionNotes = [
    `修订记录：${directive}`,
    ...refined.productionNotes.filter((note) => !note.startsWith("修订记录：")),
  ];

  refined.versions = refined.versions.map((version) => ({
    ...version,
    captionTitle: `${version.captionTitle}（修订版）`,
    scriptBeats: version.scriptBeats.map((beat, index) => {
      if (index === 0 && wantsStrongerHook) {
        return {
          ...beat,
          visualSuggestion: `先用更强对比画面承接修订要求“${directive}”，再进入原有结果展示。`,
          voiceoverOrSubtitle: `先别急着划走，${directive}。`,
          transitionAndRhythm: "0.5 秒内给出反差画面，随后快速切到结果证明。",
        };
      }

      if (wantsSofterTone) {
        return {
          ...beat,
          voiceoverOrSubtitle: beat.voiceoverOrSubtitle.replace("第一，", "先看第一点：").replace("第二，", "再看第二点："),
          packagingStyle: `${beat.packagingStyle}；字幕语气更口语，减少硬广感。`,
        };
      }

      if (index === 2 && wantsMoreProof) {
        return {
          ...beat,
          visualSuggestion: `${beat.visualSuggestion}，额外补一帧真实数据、评价截图或过程记录。`,
          sellingPointIntent: `${beat.sellingPointIntent}，同时补足可信证据。`,
          riskNotes: "新增证据必须真实可追溯，避免虚构评价。",
        };
      }

      return beat;
    }),
  }));

  return refined;
}
