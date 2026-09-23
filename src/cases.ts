import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { FormInput, PrimitiveKind } from "./jev.ts";

export const CASE_VERSION = 1 as const;

export interface ExportedCase {
  version: typeof CASE_VERSION;
  exportedAt: string;
  name: string;
  form: FormInput;
}

export function defaultDataDir(): string {
  return join(import.meta.dir, "..", "data");
}

export function isPrimitiveKind(value: unknown): value is PrimitiveKind {
  return value === "noul" || value === "choice" || value === "score";
}

export function slugifyName(text: string, fallback = "case"): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? slug : fallback;
}

export function buildCaseFilename(form: FormInput, now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace(/Z$/, "");
  return `${stamp}_${form.primitive}_${slugifyName(form.question)}.json`;
}

/**
 * Normalize a user-supplied export name into a safe `*.json` filename.
 * Rejects empty names and path separators.
 */
export function normalizeExportFilename(raw: string): string {
  let name = raw.trim();
  if (!name) {
    throw new Error("Filename cannot be empty.");
  }

  name = name.replace(/\\/g, "/");
  if (name.includes("/") || name === "." || name === "..") {
    throw new Error("Filename cannot include path separators.");
  }

  // Strip control chars and characters that are awkward on macOS / Windows.
  name = name.replace(/[\u0000-\u001f<>:"|?*]/g, "-").replace(/\s+/g, "-");
  name = name.replace(/-+/g, "-").replace(/^\.+/, "");

  if (!name || name === ".json") {
    throw new Error("Filename cannot be empty.");
  }

  if (!name.toLowerCase().endsWith(".json")) {
    name = `${name}.json`;
  }

  return basename(name);
}

export function toExportedCase(
  form: FormInput,
  options?: { name?: string; exportedAt?: string },
): ExportedCase {
  return {
    version: CASE_VERSION,
    exportedAt: options?.exportedAt ?? new Date().toISOString(),
    name: options?.name ?? slugifyName(form.question),
    form: {
      primitive: form.primitive,
      question: form.question,
      context: form.context,
      possibleAnswers: form.possibleAnswers,
    },
  };
}

export function parseExportedCase(raw: unknown): ExportedCase {
  if (!raw || typeof raw !== "object") {
    throw new Error("Case file must be a JSON object.");
  }

  const data = raw as Record<string, unknown>;
  if (data.version !== CASE_VERSION) {
    throw new Error(
      `Unsupported case version: ${String(data.version)} (expected ${CASE_VERSION}).`,
    );
  }

  const formRaw = data.form;
  if (!formRaw || typeof formRaw !== "object") {
    throw new Error('Case file is missing a "form" object.');
  }

  const form = formRaw as Record<string, unknown>;
  if (!isPrimitiveKind(form.primitive)) {
    throw new Error(
      `Invalid primitive: ${String(form.primitive)}. Expected noul, choice, or score.`,
    );
  }
  if (typeof form.question !== "string") {
    throw new Error('Case form.question must be a string.');
  }
  if (typeof form.context !== "string") {
    throw new Error('Case form.context must be a string.');
  }
  if (typeof form.possibleAnswers !== "string") {
    throw new Error('Case form.possibleAnswers must be a string.');
  }

  const name =
    typeof data.name === "string" && data.name.trim().length > 0
      ? data.name.trim()
      : slugifyName(form.question);

  const exportedAt =
    typeof data.exportedAt === "string" && data.exportedAt.length > 0
      ? data.exportedAt
      : new Date(0).toISOString();

  return {
    version: CASE_VERSION,
    exportedAt,
    name,
    form: {
      primitive: form.primitive,
      question: form.question,
      context: form.context,
      possibleAnswers: form.possibleAnswers,
    },
  };
}

export async function ensureDataDir(dataDir = defaultDataDir()): Promise<string> {
  await mkdir(dataDir, { recursive: true });
  return dataDir;
}

export async function exportCase(
  form: FormInput,
  options?: { dataDir?: string; filename?: string; name?: string },
): Promise<{ path: string; filename: string; case: ExportedCase }> {
  const dataDir = await ensureDataDir(options?.dataDir ?? defaultDataDir());
  const filename = normalizeExportFilename(
    options?.filename ?? buildCaseFilename(form),
  );
  const exported = toExportedCase(form, {
    name: options?.name ?? slugifyName(filename.replace(/\.json$/i, "")),
  });
  const path = join(dataDir, filename);
  await writeFile(path, `${JSON.stringify(exported, null, 2)}\n`, "utf8");
  return { path, filename, case: exported };
}

export async function listCaseFiles(
  dataDir = defaultDataDir(),
): Promise<string[]> {
  await ensureDataDir(dataDir);
  const entries = await readdir(dataDir);
  return entries
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a));
}

export async function importCase(
  filename: string,
  dataDir = defaultDataDir(),
): Promise<ExportedCase> {
  const path = join(dataDir, basename(filename));
  const text = await readFile(path, "utf8");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON in ${basename(filename)}.`);
  }
  return parseExportedCase(raw);
}
