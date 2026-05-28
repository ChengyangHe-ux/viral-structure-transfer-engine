export function extractJsonCandidate(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("AI returned empty text");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fencedMatch?.[1]?.trim() || trimmed;

  try {
    JSON.parse(source);
    return source;
  } catch {
    // Continue with balanced-brace extraction below.
  }

  const objectStart = source.indexOf("{");
  const arrayStart = source.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  const start = starts.length ? Math.min(...starts) : -1;

  if (start < 0) {
    throw new Error("AI response did not contain JSON");
  }

  const opening = source[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === opening) depth += 1;
    if (char === closing) depth -= 1;

    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  throw new Error("AI response contained incomplete JSON");
}

export function parseJsonFromText(text: string): unknown {
  return JSON.parse(extractJsonCandidate(text));
}
