import {
  TypeSafeClient,
  choice,
  noul,
  score,
  type ChoiceCriteria,
  type Question,
  type ScoreCriteria,
  type SystemOneResult,
} from "@typesafe-ai/sdk";

export type PrimitiveKind = "noul" | "choice" | "score";

export const ANSWER_KEY = "answer" as const;

export interface FormInput {
  primitive: PrimitiveKind;
  question: string;
  context: string;
  possibleAnswers: string;
}

export interface ValidatedRequest {
  state: string;
  questions: { [ANSWER_KEY]: Question };
}

export type RunSuccess = {
  ok: true;
  result: SystemOneResult<{ [ANSWER_KEY]: Question }>;
  latencyMs: number;
  json: string;
  /** Choice option keys in the order the user entered them. */
  answerOrder: string[] | null;
};

export type RunFailure = {
  ok: false;
  error: string;
  latencyMs: number | null;
};

export type RunResult = RunSuccess | RunFailure;

export interface SystemOneCaller {
  systemOne(
    request: {
      state: string;
      questions: { [ANSWER_KEY]: Question };
    },
  ): Promise<SystemOneResult<{ [ANSWER_KEY]: Question }>>;
}

export function parseNoulCriteria(
  text: string,
): { true?: string; false?: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const criteria: { true?: string; false?: string } = {};
  for (const rawLine of trimmed.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(true|false)\s*:\s*(.*)$/i);
    if (!match) {
      throw new Error(
        `Noul criteria must use "true: ..." / "false: ..." lines. Got: ${line}`,
      );
    }
    const key = match[1]!.toLowerCase() as "true" | "false";
    const value = match[2]!.trim();
    if (!value) {
      throw new Error(`Noul criterion "${key}" needs a description.`);
    }
    criteria[key] = value;
  }

  if (!criteria.true && !criteria.false) return null;
  return criteria;
}

export function parseChoiceCriteria(text: string): ChoiceCriteria {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Choice requires at least one option (key: description).");
  }

  const criteria: ChoiceCriteria = Object.create(null);
  for (const rawLine of trimmed.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const sep = line.indexOf(":");
    if (sep <= 0) {
      throw new Error(
        `Choice options must be "key: description" per line. Got: ${line}`,
      );
    }
    const key = line.slice(0, sep).trim();
    const description = line.slice(sep + 1).trim();
    if (!key) {
      throw new Error(`Choice option is missing a key: ${line}`);
    }
    if (Object.hasOwn(criteria, key)) {
      throw new Error(`Duplicate choice key: ${key}`);
    }
    criteria[key] = description.length > 0 ? description : null;
  }

  if (Object.keys(criteria).length === 0) {
    throw new Error("Choice requires at least one option (key: description).");
  }
  return criteria;
}

export function parseScoreCriteria(text: string): ScoreCriteria {
  const levels = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (levels.length < 2) {
    throw new Error("Score requires at least two ordered levels (one per line).");
  }

  return levels as unknown as ScoreCriteria;
}

export function buildQuestion(
  primitive: PrimitiveKind,
  question: string,
  possibleAnswers: string,
): Question {
  const instructions = question.trim();
  if (!instructions) {
    throw new Error("Question is required.");
  }

  switch (primitive) {
    case "noul":
      return noul(instructions, parseNoulCriteria(possibleAnswers));
    case "choice":
      return choice(instructions, parseChoiceCriteria(possibleAnswers));
    case "score":
      return score(instructions, parseScoreCriteria(possibleAnswers));
    default: {
      const _exhaustive: never = primitive;
      throw new Error(`Unknown primitive: ${_exhaustive}`);
    }
  }
}

export function validateForm(input: FormInput): ValidatedRequest {
  const state = input.context.trim();
  if (!state) {
    throw new Error("Context is required.");
  }

  const question = buildQuestion(
    input.primitive,
    input.question,
    input.possibleAnswers,
  );

  return {
    state,
    questions: { [ANSWER_KEY]: question },
  };
}

export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api";
const OPENROUTER_JEV_MODEL = "~typesafe/jev-latest";

export function createClient(
  apiKey = process.env.TYPESAFE_API_KEY,
): TypeSafeClient {
  const key = apiKey?.trim();
  if (key && key !== "your_api_key_here") {
    return new TypeSafeClient({ apiKey: key });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    return new TypeSafeClient({
      apiKey: openrouterKey,
      baseURL: OPENROUTER_BASE_URL,
      defaultModel: OPENROUTER_JEV_MODEL,
    });
  }

  throw new Error(
    "TYPESAFE_API_KEY is missing. Set it in your environment or a .env file, or set OPENROUTER_API_KEY to route Jev through OpenRouter.",
  );
}

/**
 * Call Jev with a validated request and measure end-to-end API round-trip time
 * (request start → response resolve). Does not include UI/system startup time.
 */
export async function runSystemOne(
  input: FormInput,
  caller?: SystemOneCaller,
): Promise<RunResult> {
  let request: ValidatedRequest;
  try {
    request = validateForm(input);
  } catch (error) {
    return { ok: false, error: formatError(error), latencyMs: null };
  }

  let client: SystemOneCaller;
  try {
    client = caller ?? createClient();
  } catch (error) {
    return { ok: false, error: formatError(error), latencyMs: null };
  }

  const started = performance.now();
  try {
    const result = await client.systemOne(request);
    const latencyMs = Math.round(performance.now() - started);
    const question = request.questions[ANSWER_KEY];
    const answerOrder =
      question.type === "choice" ? Object.keys(question.criteria) : null;
    return {
      ok: true,
      result,
      latencyMs,
      json: JSON.stringify(result, null, 2),
      answerOrder,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);
    return { ok: false, error: formatError(error), latencyMs };
  }
}

export function answersHint(primitive: PrimitiveKind): string {
  switch (primitive) {
    case "noul":
      return "Optional. One per line:\ntrue: yes means...\nfalse: no means...";
    case "choice":
      return "Required. One per line:\nbilling: Payment issues\ntechnical: Bugs\nother: Anything else";
    case "score":
      return "Required. Ordered levels, one per line:\nCan wait\nNeeds attention soon\nNeeds attention today";
  }
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function compareKeys(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Deterministic key order: the caller's order first (e.g. the form's choice
 * options), then any leftovers sorted numerically or alphabetically.
 */
function orderedKeys(
  probabilities: Readonly<Record<string, number>>,
  order?: readonly string[] | null,
): string[] {
  if (order) {
    const inOrder = new Set(order);
    const ranked = order.filter((key) => key in probabilities);
    const extras = Object.keys(probabilities)
      .filter((key) => !inOrder.has(key))
      .sort(compareKeys);
    return [...ranked, ...extras];
  }
  return Object.keys(probabilities).sort(compareKeys);
}

function formatProbabilities(
  probabilities: Record<string, number> | Readonly<Record<string, number>>,
  order?: readonly string[] | null,
): string {
  return orderedKeys(probabilities, order)
    .map((key) => `${key}=${formatPct(Number(probabilities[key]))}`)
    .join("  ");
}

/**
 * Human-readable decision summary for the right pane (under latency).
 * Probabilities follow the form's option order, so the same case always
 * reads the same way regardless of response key order.
 */
export function summarizeAnswer(
  result: SystemOneResult<{ [ANSWER_KEY]: Question }>,
  answerOrder?: readonly string[] | null,
): string {
  const answer = result.answers[ANSWER_KEY] as
    | {
        type: "noul";
        noul: number;
      }
    | {
        type: "choice";
        choice: string;
        confidence: number;
        probabilities: Record<string, number>;
      }
    | {
        type: "score";
        score: number;
        confidence: number;
        legend: Record<string, unknown>;
        probabilities: Record<string, number>;
      };

  const lines: string[] = [];

  switch (answer.type) {
    case "noul":
      lines.push(`Decision: noul  ·  P(yes)=${formatPct(answer.noul)}`);
      break;
    case "choice":
      lines.push(
        `Decision: ${answer.choice}  ·  confidence=${formatPct(answer.confidence)}`,
      );
      lines.push(
        `Probabilities: ${formatProbabilities(answer.probabilities, answerOrder)}`,
      );
      break;
    case "score": {
      const legend = answer.legend as Record<string, unknown>;
      const rounded = Math.round(answer.score);
      const label = legend[String(rounded)];
      const labelText =
        typeof label === "string" && label.length > 0 ? ` (${label})` : "";
      lines.push(
        `Decision: score=${answer.score}${labelText}  ·  confidence=${formatPct(answer.confidence)}`,
      );
      lines.push(`Probabilities: ${formatProbabilities(answer.probabilities)}`);
      break;
    }
    default:
      lines.push("Decision: (unknown answer type)");
  }

  lines.push(
    `Tokens: in=${result.usage.input_tokens}  out=${result.usage.output_tokens}`,
  );
  return lines.join("\n");
}
