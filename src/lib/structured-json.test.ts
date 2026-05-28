import { describe, expect, it } from "vitest";

import { extractJsonCandidate, parseJsonFromText } from "@/lib/structured-json";

describe("structured JSON extraction", () => {
  it("parses plain JSON output", () => {
    expect(parseJsonFromText('{"ok":true,"items":[1,2]}')).toEqual({
      ok: true,
      items: [1, 2],
    });
  });

  it("extracts JSON from markdown fenced output", () => {
    const text = "当然可以：\n```json\n{\"title\":\"结构迁移\",\"score\":95}\n```";

    expect(parseJsonFromText(text)).toEqual({
      title: "结构迁移",
      score: 95,
    });
  });

  it("keeps braces inside strings while finding the balanced JSON object", () => {
    const candidate = extractJsonCandidate(
      '前言 {"copy":"开头说 {不是甜，是干净的香}","ok":true} 结束',
    );

    expect(JSON.parse(candidate)).toEqual({
      copy: "开头说 {不是甜，是干净的香}",
      ok: true,
    });
  });
});
