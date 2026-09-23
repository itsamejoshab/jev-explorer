import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCaseFilename,
  exportCase,
  importCase,
  listCaseFiles,
  normalizeExportFilename,
  parseExportedCase,
  slugifyName,
  toExportedCase,
} from "./cases.ts";
import type { FormInput } from "./jev.ts";

const sample: FormInput = {
  primitive: "choice",
  question: "Which team should handle this?",
  context: "I was charged twice.",
  possibleAnswers: "billing: Pay\ntechnical: Bugs",
};

describe("slugifyName / buildCaseFilename", () => {
  test("slugifies questions", () => {
    expect(slugifyName("Which team?")).toBe("which-team");
    expect(slugifyName("!!!")).toBe("case");
  });

  test("builds a stable filename prefix", () => {
    const name = buildCaseFilename(sample, new Date("2026-09-23T12:34:56.789Z"));
    expect(name).toBe(
      "2026-09-23_12-34-56-789_choice_which-team-should-handle-this.json",
    );
  });
});

describe("normalizeExportFilename", () => {
  test("appends .json and strips path parts", () => {
    expect(normalizeExportFilename("my refund case")).toBe("my-refund-case.json");
    expect(normalizeExportFilename("demo.json")).toBe("demo.json");
  });

  test("rejects empty or path-like names", () => {
    expect(() => normalizeExportFilename("  ")).toThrow(/empty/);
    expect(() => normalizeExportFilename("../secret")).toThrow(/path/);
    expect(() => normalizeExportFilename("a/b.json")).toThrow(/path/);
  });
});

describe("parseExportedCase", () => {
  test("parses a valid export", () => {
    const exported = toExportedCase(sample, {
      name: "refund-routing",
      exportedAt: "2026-09-23T00:00:00.000Z",
    });
    expect(parseExportedCase(exported)).toEqual(exported);
  });

  test("rejects bad versions and missing form fields", () => {
    expect(() => parseExportedCase({ version: 99, form: sample })).toThrow(
      /Unsupported case version/,
    );
    expect(() =>
      parseExportedCase({ version: 1, form: { ...sample, primitive: "nope" } }),
    ).toThrow(/Invalid primitive/);
  });
});

describe("exportCase / importCase / listCaseFiles", () => {
  test("round-trips through the data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "jev-cases-"));
    try {
      const { filename, path } = await exportCase(sample, {
        dataDir,
        filename: "demo-case.json",
        name: "demo",
      });
      expect(filename).toBe("demo-case.json");
      expect(path.endsWith("demo-case.json")).toBe(true);

      const listed = await listCaseFiles(dataDir);
      expect(listed).toEqual(["demo-case.json"]);

      const loaded = await importCase("demo-case.json", dataDir);
      expect(loaded.name).toBe("demo");
      expect(loaded.form).toEqual(sample);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
