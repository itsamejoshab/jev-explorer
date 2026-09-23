import { describe, expect, test } from "bun:test";
import { getTheme, nextTheme, THEMES } from "./themes.ts";

describe("themes", () => {
  test("includes all built-in themes", () => {
    expect(THEMES.map((t) => t.id)).toEqual([
      "slate",
      "moss",
      "vineyard",
      "ember",
      "lavender",
      "harbor",
      "tide",
      "clay",
    ]);
  });

  test("cycles through every theme and wraps", () => {
    let id = "slate";
    const seen: string[] = [];
    for (let i = 0; i < THEMES.length; i++) {
      const next = nextTheme(id);
      seen.push(next.id);
      id = next.id;
    }
    expect(seen).toEqual([
      "moss",
      "vineyard",
      "ember",
      "lavender",
      "harbor",
      "tide",
      "clay",
      "slate",
    ]);
    expect(getTheme("missing").id).toBe("slate");
  });

  test("uses palette error when present", () => {
    expect(getTheme("vineyard").error).toBe("#bc4749");
    expect(getTheme("clay").error).toBe("#c17c74");
    expect(getTheme("ember").accent).toBe("#eb5e28");
  });
});
