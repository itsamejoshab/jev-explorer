import { describe, expect, mock, test } from "bun:test";
import {
  ANSWER_KEY,
  buildQuestion,
  createClient,
  parseChoiceCriteria,
  parseNoulCriteria,
  parseScoreCriteria,
  runSystemOne,
  summarizeAnswer,
  validateForm,
  type SystemOneCaller,
} from "./jev.ts";

describe("parseNoulCriteria", () => {
  test("returns null for empty input", () => {
    expect(parseNoulCriteria("")).toBeNull();
    expect(parseNoulCriteria("   \n  ")).toBeNull();
  });

  test("parses true/false lines", () => {
    expect(
      parseNoulCriteria("true: asks for money back\nfalse: no refund talk"),
    ).toEqual({
      true: "asks for money back",
      false: "no refund talk",
    });
  });

  test("rejects malformed lines", () => {
    expect(() => parseNoulCriteria("maybe: something")).toThrow(/true:|false:/);
  });
});

describe("parseChoiceCriteria", () => {
  test("parses key: description lines", () => {
    expect(
      parseChoiceCriteria("billing: Payment\ntechnical: Bugs\nother:"),
    ).toEqual({
      billing: "Payment",
      technical: "Bugs",
      other: null,
    });
  });

  test("requires at least one option", () => {
    expect(() => parseChoiceCriteria("")).toThrow(/at least one option/);
  });

  test("rejects duplicates", () => {
    expect(() => parseChoiceCriteria("a: one\na: two")).toThrow(/Duplicate/);
  });

  test("allows Object.prototype names and __proto__ as own keys", () => {
    const criteria = parseChoiceCriteria(
      "constructor: Built-in name\ntoString: Also fine\n__proto__: Explicit option",
    );
    expect(Object.getPrototypeOf(criteria)).toBeNull();
    expect(Object.hasOwn(criteria, "constructor")).toBe(true);
    expect(Object.hasOwn(criteria, "toString")).toBe(true);
    expect(Object.hasOwn(criteria, "__proto__")).toBe(true);
    expect(criteria["constructor"]).toBe("Built-in name");
    expect(criteria["toString"]).toBe("Also fine");
    expect(criteria["__proto__"]).toBe("Explicit option");
  });
});

describe("parseScoreCriteria", () => {
  test("parses ordered levels", () => {
    expect(parseScoreCriteria("low\nmedium\nhigh")).toEqual([
      "low",
      "medium",
      "high",
    ]);
  });

  test("requires at least two levels", () => {
    expect(() => parseScoreCriteria("only-one")).toThrow(/at least two/);
  });
});

describe("buildQuestion / validateForm", () => {
  test("builds a noul question", () => {
    const q = buildQuestion("noul", "Is this urgent?", "");
    expect(q.type).toBe("noul");
    if (q.type === "noul") {
      expect(q.instructions).toBe("Is this urgent?");
    }
  });

  test("builds a choice question", () => {
    const q = buildQuestion("choice", "Which team?", "billing: Pay\ntech: Bugs");
    expect(q.type).toBe("choice");
    if (q.type === "choice") {
      expect(q.criteria).toEqual({ billing: "Pay", tech: "Bugs" });
    }
  });

  test("builds a score question", () => {
    const q = buildQuestion("score", "How urgent?", "low\nhigh");
    expect(q.type).toBe("score");
    if (q.type === "score") {
      expect(q.criteria).toEqual(["low", "high"]);
    }
  });

  test("validateForm requires context and question", () => {
    expect(() =>
      validateForm({
        primitive: "noul",
        question: "",
        context: "hello",
        possibleAnswers: "",
      }),
    ).toThrow(/Question is required/);

    expect(() =>
      validateForm({
        primitive: "noul",
        question: "Is it urgent?",
        context: "  ",
        possibleAnswers: "",
      }),
    ).toThrow(/Context is required/);
  });

  test("validateForm wraps a single answer key", () => {
    const req = validateForm({
      primitive: "noul",
      question: "Refund?",
      context: "I was charged twice.",
      possibleAnswers: "",
    });
    expect(Object.keys(req.questions)).toEqual([ANSWER_KEY]);
    expect(req.state).toBe("I was charged twice.");
  });
});

describe("runSystemOne", () => {
  test("returns validation errors without calling the client", async () => {
    const caller: SystemOneCaller = {
      systemOne: mock(() => Promise.reject(new Error("should not be called"))),
    };

    const result = await runSystemOne(
      {
        primitive: "choice",
        question: "Which?",
        context: "state",
        possibleAnswers: "",
      },
      caller,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/at least one option/);
      expect(result.latencyMs).toBeNull();
    }
    expect(caller.systemOne).not.toHaveBeenCalled();
  });

  test("measures round-trip latency on success", async () => {
    const payload = {
      model: "jev-latest",
      answers: {
        [ANSWER_KEY]: { type: "noul" as const, noul: 0.82 },
      },
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    const caller: SystemOneCaller = {
      systemOne: mock(async () => {
        await Bun.sleep(25);
        return payload as never;
      }),
    };

    const result = await runSystemOne(
      {
        primitive: "noul",
        question: "Urgent?",
        context: "Please help ASAP",
        possibleAnswers: "",
      },
      caller,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.latencyMs).toBeGreaterThanOrEqual(20);
      expect(result.json).toContain('"noul": 0.82');
      expect(result.result.answers[ANSWER_KEY]).toEqual({
        type: "noul",
        noul: 0.82,
      });
    }
  });

  test("captures latency when the client throws", async () => {
    const caller: SystemOneCaller = {
      systemOne: mock(async () => {
        await Bun.sleep(15);
        throw new Error("API exploded");
      }),
    };

    const result = await runSystemOne(
      {
        primitive: "noul",
        question: "Urgent?",
        context: "state",
        possibleAnswers: "",
      },
      caller,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("API exploded");
      expect(result.latencyMs).toBeGreaterThanOrEqual(10);
    }
  });

  test("reports missing API key when no caller is provided", async () => {
    const previous = process.env.TYPESAFE_API_KEY;
    const previousOpenrouter = process.env.OPENROUTER_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const result = await runSystemOne({
      primitive: "noul",
      question: "Urgent?",
      context: "state",
      possibleAnswers: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/TYPESAFE_API_KEY/);
      expect(result.latencyMs).toBeNull();
    }

    if (previous !== undefined) process.env.TYPESAFE_API_KEY = previous;
    if (previousOpenrouter !== undefined) {
      process.env.OPENROUTER_API_KEY = previousOpenrouter;
    }
  });
});

describe("createClient", () => {
  const PLACEHOLDER = "your_api_key_here";

  test("uses the typesafe endpoint when TYPESAFE_API_KEY is set", () => {
    const previous = process.env.TYPESAFE_API_KEY;
    const previousOpenrouter = process.env.OPENROUTER_API_KEY;
    process.env.TYPESAFE_API_KEY = "ts_key";
    process.env.OPENROUTER_API_KEY = "or_key";

    const client = createClient();
    expect(client.baseURL).toBe("https://api.typesafe.ai");
    expect(client.defaultModel).toBe("jev-latest");

    if (previous !== undefined) process.env.TYPESAFE_API_KEY = previous;
    else delete process.env.TYPESAFE_API_KEY;
    if (previousOpenrouter !== undefined) {
      process.env.OPENROUTER_API_KEY = previousOpenrouter;
    } else delete process.env.OPENROUTER_API_KEY;
  });

  test("falls back to OpenRouter when TYPESAFE_API_KEY is blank or placeholder", () => {
    const previous = process.env.TYPESAFE_API_KEY;
    const previousOpenrouter = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "or_key";

    for (const blank of ["", "   ", PLACEHOLDER]) {
      process.env.TYPESAFE_API_KEY = blank;
      const client = createClient();
      expect(client.baseURL).toBe("https://openrouter.ai/api");
      expect(client.defaultModel).toBe("~typesafe/jev-latest");
    }

    if (previous !== undefined) process.env.TYPESAFE_API_KEY = previous;
    else delete process.env.TYPESAFE_API_KEY;
    if (previousOpenrouter !== undefined) {
      process.env.OPENROUTER_API_KEY = previousOpenrouter;
    } else delete process.env.OPENROUTER_API_KEY;
  });

  test("throws when both keys are missing", () => {
    const previous = process.env.TYPESAFE_API_KEY;
    const previousOpenrouter = process.env.OPENROUTER_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    expect(() => createClient()).toThrow(/TYPESAFE_API_KEY/);

    if (previous !== undefined) process.env.TYPESAFE_API_KEY = previous;
    if (previousOpenrouter !== undefined) {
      process.env.OPENROUTER_API_KEY = previousOpenrouter;
    }
  });
});

describe("summarizeAnswer", () => {
  test("formats noul answers", () => {
    const text = summarizeAnswer({
      model: "jev-latest",
      answers: {
        [ANSWER_KEY]: { type: "noul", noul: 0.82 },
      },
      usage: { input_tokens: 10, output_tokens: 4 },
    } as never);
    expect(text).toContain("Model: jev-latest");
    expect(text).toContain("P(yes)=82.0%");
    expect(text).toContain("Tokens: in=10  out=4");
  });

  test("formats choice answers with confidence and probabilities", () => {
    const text = summarizeAnswer({
      model: "jev-1",
      answers: {
        [ANSWER_KEY]: {
          type: "choice",
          choice: "billing",
          confidence: 0.91,
          probabilities: { billing: 0.91, technical: 0.09 },
        },
      },
      usage: { input_tokens: 20, output_tokens: 8 },
    } as never);
    expect(text).toContain("Decision: billing");
    expect(text).toContain("confidence=91.0%");
    expect(text).toContain("billing=91.0%");
    expect(text).toContain("technical=9.0%");
  });

  test("formats score answers with legend label", () => {
    const text = summarizeAnswer({
      model: "jev-1",
      answers: {
        [ANSWER_KEY]: {
          type: "score",
          score: 2,
          confidence: 0.7,
          legend: { "0": "low", "1": "mid", "2": "high" },
          probabilities: { "0": 0.1, "1": 0.2, "2": 0.7 },
        },
      },
      usage: { input_tokens: 5, output_tokens: 3 },
    } as never);
    expect(text).toContain("score=2 (high)");
    expect(text).toContain("confidence=70.0%");
  });
});
