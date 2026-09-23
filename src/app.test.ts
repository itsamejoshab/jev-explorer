import { describe, expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { toExportedCase } from "./cases.ts";
import { mountApp } from "./index.ts";

describe("OpenTUI app smoke", () => {
  test("mounts, tabs focus, validates on run, and destroys cleanly", async () => {
    const { renderer, mockInput, renderOnce } = await createTestRenderer({
      width: 120,
      height: 40,
      backgroundColor: "#0f172a",
    });

    const app = mountApp(renderer);
    await renderOnce();

    expect(app.getFocusIndex()).toBe(0);
    expect(app.getStatus()).toContain("Idle");
    expect(app.getLatency()).toContain("—");

    mockInput.pressTab();
    await renderOnce();
    expect(app.getFocusIndex()).toBe(1);

    mockInput.pressTab();
    await renderOnce();
    expect(app.getFocusIndex()).toBe(2);

    app.setQuestion("Is this urgent?");
    await app.run();
    await renderOnce();

    expect(app.getStatus()).toMatch(/Error: Context is required/);
    expect(app.getJson()).toContain("Context is required");
    expect(app.getLatency()).toContain("—");

    app.destroy();
  });

  test("exports and applies form state", async () => {
    const form = {
      primitive: "score" as const,
      question: "How urgent?",
      context: "Ship is sinking",
      possibleAnswers: "low\nhigh",
    };

    const { renderer, renderOnce } = await createTestRenderer({
      width: 120,
      height: 40,
      backgroundColor: "#0f172a",
    });
    const app = mountApp(renderer);
    await renderOnce();

    app.applyForm(form);
    expect(app.getForm()).toEqual(form);

    const filename = await app.exportCurrent("how-urgent-score.json");
    expect(filename).toBe("how-urgent-score.json");
    expect(app.getStatus()).toMatch(/Exported data\//);

    app.applyForm({
      primitive: "noul",
      question: "",
      context: "",
      possibleAnswers: "",
    });
    app.applyForm(toExportedCase(form).form);
    expect(app.getForm().primitive).toBe("score");
    expect(app.getForm().context).toBe("Ship is sinking");

    app.destroy();

    if (filename) {
      await rm(join(import.meta.dir, "..", "data", filename), { force: true });
    }
  });

  test("opens import picker when cases exist", async () => {
    const seeded = toExportedCase({
      primitive: "noul",
      question: "Seeded case?",
      context: "seed",
      possibleAnswers: "",
    });
    const filename = `_test_seeded_case.json`;
    const path = join(import.meta.dir, "..", "data", filename);
    await writeFile(path, `${JSON.stringify(seeded, null, 2)}\n`);

    try {
      const { renderer, renderOnce } = await createTestRenderer({
        width: 120,
        height: 40,
        backgroundColor: "#0f172a",
      });
      const app = mountApp(renderer);
      await renderOnce();

      await app.openImport();
      await renderOnce();
      expect(app.isImportOpen()).toBe(true);
      expect(app.getStatus()).toMatch(/Import:/);

      app.closeImport();
      expect(app.isImportOpen()).toBe(false);

      app.destroy();
    } finally {
      await rm(path, { force: true });
    }
  });

  test("opens export rename dialog with a suggested filename", async () => {
    const { renderer, renderOnce } = await createTestRenderer({
      width: 120,
      height: 40,
      backgroundColor: "#0f172a",
    });
    const app = mountApp(renderer);
    await renderOnce();

    app.applyForm({
      primitive: "noul",
      question: "Is this urgent?",
      context: "ASAP please",
      possibleAnswers: "",
    });
    app.openExport();
    await renderOnce();

    expect(app.isExportOpen()).toBe(true);
    expect(app.getExportFilename()).toMatch(/\.json$/);
    expect(app.getExportFilename()).toContain("noul");

    const selection = app.getExportSelection();
    expect(selection).not.toBeNull();
    if (selection) {
      expect(selection.start).toBe(0);
      expect(selection.end).toBe(app.getExportFilename().length - ".json".length);
    }

    app.setExportFilename("my-favorite-case");
    const filename = await app.confirmExport();
    expect(filename).toBe("my-favorite-case.json");
    expect(app.isExportOpen()).toBe(false);
    expect(app.getStatus()).toMatch(/Exported data\/my-favorite-case\.json/);

    app.destroy();
    if (filename) {
      await rm(join(import.meta.dir, "..", "data", filename), { force: true });
    }
  });

  test("clears form and outputs", async () => {
    const { renderer, renderOnce } = await createTestRenderer({
      width: 120,
      height: 40,
      backgroundColor: "#0f172a",
    });
    const app = mountApp(renderer);
    await renderOnce();

    app.applyForm({
      primitive: "choice",
      question: "Which team?",
      context: "charged twice",
      possibleAnswers: "billing: Pay",
    });
    await app.exportCurrent("temp-clear-test.json");
    expect(app.getForm().question).toBe("Which team?");
    expect(app.getJson()).toContain("temp-clear-test.json");

    app.clearAll();
    await renderOnce();

    expect(app.getForm()).toEqual({
      primitive: "noul",
      question: "",
      context: "",
      possibleAnswers: "",
    });
    expect(app.getStatus()).toMatch(/Idle/);
    expect(app.getLatency()).toContain("—");
    expect(app.getDecision()).toMatch(/Run a request/);
    expect(app.getJson()).toContain("response appears here");
    expect(app.getFocusIndex()).toBe(0);

    app.destroy();
    await rm(join(import.meta.dir, "..", "data", "temp-clear-test.json"), {
      force: true,
    });
  });

  test("toggles between slate and moss themes", async () => {
    const { renderer, renderOnce } = await createTestRenderer({
      width: 120,
      height: 40,
      backgroundColor: "#0f172a",
    });
    const app = mountApp(renderer);
    await renderOnce();

    expect(app.getThemeId()).toBe("slate");
    expect(app.toggleTheme().id).toBe("moss");
    expect(app.getThemeId()).toBe("moss");
    expect(app.getStatus()).not.toMatch(/Theme:/);
    expect(app.toggleTheme().id).toBe("vineyard");

    app.destroy();
  });
});
