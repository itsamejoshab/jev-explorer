import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  TextareaRenderable,
  createCliRenderer,
  type CliRenderer,
  type KeyEvent,
  type SelectOption,
} from "@opentui/core";
import {
  buildCaseFilename,
  exportCase,
  importCase,
  listCaseFiles,
  normalizeExportFilename,
} from "./cases.ts";
import {
  answersHint,
  runSystemOne,
  summarizeAnswer,
  type FormInput,
  type PrimitiveKind,
} from "./jev.ts";
import { nextTheme, slateTheme, type Theme } from "./themes.ts";

const PRIMITIVE_OPTIONS: SelectOption[] = [
  {
    name: "Noul",
    description: "Yes/no probability (0–1)",
    value: "noul" as PrimitiveKind,
  },
  {
    name: "Choice",
    description: "Pick one labelled option",
    value: "choice" as PrimitiveKind,
  },
  {
    name: "Score",
    description: "Ordered levels / rubric",
    value: "score" as PrimitiveKind,
  },
];

type FocusTarget = "primitive" | "question" | "context" | "answers";
const FOCUS_ORDER: FocusTarget[] = [
  "primitive",
  "question",
  "context",
  "answers",
];

const APP_VERSION = "v0.1";
const FOOTER_IDLE =
  "Tab focus  ·  Ctrl+Enter run  ·  Ctrl+E export  ·  Ctrl+I import  ·  Ctrl+T theme  ·  Ctrl+C clear  ·  Esc quit";

export interface AppHandles {
  run: () => Promise<void>;
  openExport: () => void;
  closeExport: () => void;
  confirmExport: () => Promise<string | null>;
  /** Write immediately with an optional filename (tests / scripting). */
  exportCurrent: (filename?: string) => Promise<string | null>;
  openImport: () => Promise<void>;
  closeImport: () => void;
  applyForm: (form: FormInput) => void;
  getForm: () => FormInput;
  isImportOpen: () => boolean;
  isExportOpen: () => boolean;
  getExportFilename: () => string;
  getExportSelection: () => { start: number; end: number } | null;
  setExportFilename: (value: string) => void;
  toggleTheme: () => Theme;
  getThemeId: () => string;
  setFocus: (index: number) => void;
  getFocusIndex: () => number;
  getStatus: () => string;
  getLatency: () => string;
  getDecision: () => string;
  getJson: () => string;
  setQuestion: (value: string) => void;
  setContext: (value: string) => void;
  setAnswers: (value: string) => void;
  setPrimitive: (value: PrimitiveKind) => void;
  clearAll: () => void;
  destroy: () => void;
}

function styleSelect(select: SelectRenderable, theme: Theme) {
  select.backgroundColor = theme.inputBg;
  select.focusedBackgroundColor = theme.inputFocus;
  select.textColor = theme.text;
  select.selectedBackgroundColor = theme.selectedBg;
  select.selectedTextColor = theme.selectedText;
  select.descriptionColor = theme.muted;
  select.selectedDescriptionColor = theme.selectedDescription;
}

function styleTextarea(input: TextareaRenderable, theme: Theme, options?: {
  showCursor?: boolean;
  cursor?: string;
}) {
  input.backgroundColor = theme.inputBg;
  input.focusedBackgroundColor = theme.inputFocus;
  input.textColor = theme.text;
  input.placeholderColor = theme.muted;
  input.cursorColor = options?.cursor ?? theme.accent;
  if (options?.showCursor !== undefined) {
    input.showCursor = options.showCursor;
  }
}

function styleFieldBox(box: BoxRenderable, theme: Theme, focused: boolean) {
  box.borderColor = focused ? theme.focusBorder : theme.border;
  box.focusedBorderColor = theme.focusBorder;
  box.backgroundColor = theme.inputBg;
}

export function mountApp(renderer: CliRenderer): AppHandles {
  let theme: Theme = slateTheme;
  let focusIndex = 0;
  let running = false;
  /** Bumped by clearAll so in-flight runs discard stale UI updates. */
  let runEpoch = 0;
  let selectedPrimitive: PrimitiveKind = "noul";
  let importOpen = false;
  let exportOpen = false;
  let importFiles: string[] = [];
  let statusTone: "muted" | "accent" | "success" | "error" | "warn" | "text" =
    "muted";
  let latencyTone: "muted" | "success" | "text" = "muted";

  const root = new BoxRenderable(renderer, {
    id: "root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    backgroundColor: theme.bg,
  });

  const header = new BoxRenderable(renderer, {
    id: "header",
    width: "100%",
    height: 3,
    border: true,
    borderStyle: "single",
    borderColor: theme.border,
    backgroundColor: theme.panel,
    padding: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexGrow: 0,
    flexShrink: 0,
  });
  const headerText = new TextRenderable(renderer, {
    id: "header-text",
    content: "Jev Explorer",
    fg: theme.accent,
    flexGrow: 1,
    flexShrink: 1,
  });
  const versionText = new TextRenderable(renderer, {
    id: "header-version",
    content: APP_VERSION,
    fg: theme.muted,
    flexGrow: 0,
    flexShrink: 0,
  });
  header.add(headerText);
  header.add(versionText);

  const body = new BoxRenderable(renderer, {
    id: "body",
    width: "100%",
    height: "auto",
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    gap: 1,
    padding: 1,
  });

  const left = new BoxRenderable(renderer, {
    id: "left",
    width: "55%",
    height: "100%",
    flexDirection: "column",
    flexGrow: 1,
    flexShrink: 1,
    border: true,
    borderStyle: "single",
    borderColor: theme.border,
    backgroundColor: theme.panel,
    padding: 1,
    gap: 1,
    title: " Request ",
    titleAlignment: "left",
  });

  const primitiveBox = new BoxRenderable(renderer, {
    id: "primitive-box",
    width: "100%",
    height: 5,
    border: true,
    borderStyle: "single",
    borderColor: theme.border,
    focusedBorderColor: theme.focusBorder,
    backgroundColor: theme.inputBg,
    flexGrow: 0,
    flexShrink: 0,
    title: " Primitive ",
  });

  const primitiveSelect = new SelectRenderable(renderer, {
    id: "primitive-select",
    width: "100%",
    height: 3,
    options: PRIMITIVE_OPTIONS,
    selectedIndex: 0,
    showDescription: true,
    showScrollIndicator: false,
    backgroundColor: theme.inputBg,
    focusedBackgroundColor: theme.inputFocus,
    textColor: theme.text,
    selectedBackgroundColor: theme.selectedBg,
    selectedTextColor: theme.selectedText,
    descriptionColor: theme.muted,
    selectedDescriptionColor: theme.selectedDescription,
  });
  primitiveBox.add(primitiveSelect);

  const questionBox = new BoxRenderable(renderer, {
    id: "question-box",
    width: "100%",
    height: 6,
    border: true,
    borderStyle: "single",
    borderColor: theme.border,
    focusedBorderColor: theme.focusBorder,
    backgroundColor: theme.inputBg,
    flexGrow: 0,
    flexShrink: 0,
    title: " Question ",
  });

  const questionInput = new TextareaRenderable(renderer, {
    id: "question-input",
    width: "100%",
    height: 4,
    placeholder: "e.g. Does this message ask for a refund?",
    backgroundColor: theme.inputBg,
    focusedBackgroundColor: theme.inputFocus,
    textColor: theme.text,
    placeholderColor: theme.muted,
    cursorColor: theme.accent,
    wrapMode: "word",
  });
  questionBox.add(questionInput);

  const contextBox = new BoxRenderable(renderer, {
    id: "context-box",
    width: "100%",
    height: "auto",
    border: true,
    borderStyle: "single",
    borderColor: theme.border,
    focusedBorderColor: theme.focusBorder,
    backgroundColor: theme.inputBg,
    flexGrow: 1,
    flexShrink: 1,
    title: " Context (state) ",
  });

  const contextInput = new TextareaRenderable(renderer, {
    id: "context-input",
    width: "100%",
    height: "100%",
    placeholder: "Paste the document / ticket / message Jev should judge…",
    backgroundColor: theme.inputBg,
    focusedBackgroundColor: theme.inputFocus,
    textColor: theme.text,
    placeholderColor: theme.muted,
    cursorColor: theme.accent,
    wrapMode: "word",
  });
  contextBox.add(contextInput);

  const answersBox = new BoxRenderable(renderer, {
    id: "answers-box",
    width: "100%",
    height: 8,
    border: true,
    borderStyle: "single",
    borderColor: theme.border,
    focusedBorderColor: theme.focusBorder,
    backgroundColor: theme.inputBg,
    flexGrow: 0,
    flexShrink: 0,
    title: " Possible answers ",
  });

  const answersInput = new TextareaRenderable(renderer, {
    id: "answers-input",
    width: "100%",
    height: 6,
    placeholder: answersHint("noul"),
    backgroundColor: theme.inputBg,
    focusedBackgroundColor: theme.inputFocus,
    textColor: theme.text,
    placeholderColor: theme.muted,
    cursorColor: theme.accent,
    wrapMode: "word",
  });
  answersBox.add(answersInput);

  left.add(primitiveBox);
  left.add(questionBox);
  left.add(contextBox);
  left.add(answersBox);

  const right = new BoxRenderable(renderer, {
    id: "right",
    width: "45%",
    height: "100%",
    flexDirection: "column",
    flexGrow: 1,
    flexShrink: 1,
    border: true,
    borderStyle: "single",
    borderColor: theme.border,
    backgroundColor: theme.panel,
    padding: 1,
    gap: 1,
    title: " Response ",
    titleAlignment: "left",
  });

  const statusText = new TextRenderable(renderer, {
    id: "status-text",
    content: "Idle  ·  press Ctrl+Enter to run",
    fg: theme.muted,
    flexGrow: 0,
    flexShrink: 0,
  });

  const latencyText = new TextRenderable(renderer, {
    id: "latency-text",
    content: "Latency: —",
    fg: theme.text,
    flexGrow: 0,
    flexShrink: 0,
  });

  const decisionBox = new BoxRenderable(renderer, {
    id: "decision-box",
    width: "100%",
    height: 5,
    border: true,
    borderStyle: "single",
    borderColor: theme.border,
    backgroundColor: theme.inputBg,
    flexGrow: 0,
    flexShrink: 0,
    padding: 1,
    title: " Decision ",
  });

  const decisionOutput = new TextareaRenderable(renderer, {
    id: "decision-output",
    width: "100%",
    height: 3,
    initialValue: "Run a request to see the parsed decision here.",
    backgroundColor: theme.inputBg,
    textColor: theme.text,
    cursorColor: theme.muted,
    wrapMode: "word",
    showCursor: false,
  });
  decisionBox.add(decisionOutput);

  const jsonBox = new BoxRenderable(renderer, {
    id: "json-box",
    width: "100%",
    height: "auto",
    border: true,
    borderStyle: "single",
    borderColor: theme.border,
    backgroundColor: theme.inputBg,
    flexGrow: 1,
    flexShrink: 1,
    padding: 1,
    title: " JSON ",
  });

  const jsonOutput = new TextareaRenderable(renderer, {
    id: "json-output",
    width: "100%",
    height: "100%",
    initialValue: "{\n  // response appears here after a run\n}",
    backgroundColor: theme.inputBg,
    textColor: theme.text,
    cursorColor: theme.muted,
    wrapMode: "char",
    showCursor: false,
  });
  jsonBox.add(jsonOutput);

  right.add(statusText);
  right.add(latencyText);
  right.add(decisionBox);
  right.add(jsonBox);

  body.add(left);
  body.add(right);

  const footer = new BoxRenderable(renderer, {
    id: "footer",
    width: "100%",
    height: 3,
    backgroundColor: theme.footer,
    border: true,
    borderStyle: "single",
    borderColor: theme.footerBorder,
    padding: 1,
    flexGrow: 0,
    flexShrink: 0,
  });
  const footerText = new TextRenderable(renderer, {
    id: "footer-text",
    content: FOOTER_IDLE,
    fg: theme.footerText,
  });
  footer.add(footerText);

  const importOverlay = new BoxRenderable(renderer, {
    id: "import-overlay",
    position: "absolute",
    left: "15%",
    top: "15%",
    width: "70%",
    height: "70%",
    zIndex: 100,
    visible: false,
    flexDirection: "column",
    border: true,
    borderStyle: "double",
    borderColor: theme.accent,
    backgroundColor: theme.overlay,
    padding: 1,
    gap: 1,
    title: " Import case from data/ ",
  });

  const importHint = new TextRenderable(renderer, {
    id: "import-hint",
    content: "↑↓ select  ·  Enter load  ·  Esc cancel",
    fg: theme.muted,
    flexGrow: 0,
    flexShrink: 0,
  });

  const importSelect = new SelectRenderable(renderer, {
    id: "import-select",
    width: "100%",
    height: "100%",
    options: [],
    showDescription: true,
    showScrollIndicator: true,
    backgroundColor: theme.overlay,
    focusedBackgroundColor: theme.inputFocus,
    textColor: theme.text,
    selectedBackgroundColor: theme.selectedBg,
    selectedTextColor: theme.selectedText,
    descriptionColor: theme.muted,
    selectedDescriptionColor: theme.selectedDescription,
  });

  importOverlay.add(importHint);
  importOverlay.add(importSelect);

  const exportOverlay = new BoxRenderable(renderer, {
    id: "export-overlay",
    position: "absolute",
    left: "15%",
    top: "30%",
    width: "70%",
    height: 10,
    zIndex: 100,
    visible: false,
    flexDirection: "column",
    border: true,
    borderStyle: "double",
    borderColor: theme.accent,
    backgroundColor: theme.overlay,
    padding: 1,
    gap: 1,
    title: " Export case to data/ ",
  });

  const exportHint = new TextRenderable(renderer, {
    id: "export-hint",
    content: "Edit the filename  ·  Enter save  ·  Esc cancel",
    fg: theme.muted,
    flexGrow: 0,
    flexShrink: 0,
  });

  const exportNameBox = new BoxRenderable(renderer, {
    id: "export-name-box",
    width: "100%",
    height: 3,
    border: true,
    borderStyle: "single",
    borderColor: theme.focusBorder,
    backgroundColor: theme.inputBg,
    flexGrow: 0,
    flexShrink: 0,
    title: " Filename ",
  });

  const exportNameInput = new InputRenderable(renderer, {
    id: "export-name-input",
    width: "100%",
    placeholder: "my-case.json",
    backgroundColor: theme.inputBg,
    focusedBackgroundColor: theme.inputFocus,
    textColor: theme.text,
    placeholderColor: theme.muted,
    cursorColor: theme.accent,
    selectionBg: theme.selectedBg,
    selectionFg: theme.selectedText,
    maxLength: 120,
  });
  exportNameBox.add(exportNameInput);
  exportOverlay.add(exportHint);
  exportOverlay.add(exportNameBox);

  root.add(header);
  root.add(body);
  root.add(footer);
  root.add(importOverlay);
  root.add(exportOverlay);
  renderer.root.add(root);

  const focusBoxes: Record<FocusTarget, BoxRenderable> = {
    primitive: primitiveBox,
    question: questionBox,
    context: contextBox,
    answers: answersBox,
  };

  const focusables: Record<
    FocusTarget,
    SelectRenderable | TextareaRenderable
  > = {
    primitive: primitiveSelect,
    question: questionInput,
    context: contextInput,
    answers: answersInput,
  };

  function toneColor(
    tone: "muted" | "accent" | "success" | "error" | "warn" | "text",
  ): string {
    return theme[tone];
  }

  function setFocus(index: number) {
    focusIndex =
      ((index % FOCUS_ORDER.length) + FOCUS_ORDER.length) % FOCUS_ORDER.length;
    const target = FOCUS_ORDER[focusIndex]!;

    for (const key of FOCUS_ORDER) {
      styleFieldBox(focusBoxes[key], theme, key === target);
    }

    for (const key of FOCUS_ORDER) {
      focusables[key].blur();
    }
    focusables[target].focus();
  }

  function updateAnswersPlaceholder() {
    answersInput.placeholder = answersHint(selectedPrimitive);
  }

  let statusMessage = "Idle  ·  press Ctrl+Enter to run";
  let latencyMessage = "Latency: —";

  function setStatus(
    message: string,
    tone: "muted" | "accent" | "success" | "error" | "warn" | "text" = "muted",
  ) {
    statusMessage = message;
    statusTone = tone;
    statusText.content = message;
    statusText.fg = toneColor(tone);
  }

  function setLatency(ms: number | null) {
    if (ms === null) {
      latencyMessage = "Latency: —";
      latencyTone = "muted";
      latencyText.content = latencyMessage;
      latencyText.fg = theme.muted;
      return;
    }
    latencyMessage = `Latency: ${ms} ms  (API round-trip)`;
    latencyTone = "success";
    latencyText.content = latencyMessage;
    latencyText.fg = theme.success;
  }

  function setJson(text: string) {
    jsonOutput.setText(text);
  }

  function setDecision(text: string) {
    decisionOutput.setText(text);
  }

  function applyTheme(next: Theme) {
    theme = next;
    renderer.setBackgroundColor(theme.bg);
    root.backgroundColor = theme.bg;

    header.borderColor = theme.border;
    header.backgroundColor = theme.panel;
    headerText.fg = theme.accent;
    versionText.fg = theme.muted;

    left.borderColor = theme.border;
    left.backgroundColor = theme.panel;
    right.borderColor = theme.border;
    right.backgroundColor = theme.panel;

    styleSelect(primitiveSelect, theme);
    styleTextarea(questionInput, theme);
    styleTextarea(contextInput, theme);
    styleTextarea(answersInput, theme);
    styleTextarea(decisionOutput, theme, {
      showCursor: false,
      cursor: theme.muted,
    });
    styleTextarea(jsonOutput, theme, {
      showCursor: false,
      cursor: theme.muted,
    });

    decisionBox.borderColor = theme.border;
    decisionBox.backgroundColor = theme.inputBg;
    jsonBox.borderColor = theme.border;
    jsonBox.backgroundColor = theme.inputBg;

    footer.backgroundColor = theme.footer;
    footer.borderColor = theme.footerBorder;
    footerText.fg = theme.footerText;

    importOverlay.borderColor = theme.accent;
    importOverlay.backgroundColor = theme.overlay;
    importHint.fg = theme.muted;
    importSelect.backgroundColor = theme.overlay;
    importSelect.focusedBackgroundColor = theme.inputFocus;
    importSelect.textColor = theme.text;
    importSelect.selectedBackgroundColor = theme.selectedBg;
    importSelect.selectedTextColor = theme.selectedText;
    importSelect.descriptionColor = theme.muted;
    importSelect.selectedDescriptionColor = theme.selectedDescription;

    exportOverlay.borderColor = theme.accent;
    exportOverlay.backgroundColor = theme.overlay;
    exportHint.fg = theme.muted;
    exportNameBox.borderColor = theme.focusBorder;
    exportNameBox.backgroundColor = theme.inputBg;
    exportNameInput.backgroundColor = theme.inputBg;
    exportNameInput.focusedBackgroundColor = theme.inputFocus;
    exportNameInput.textColor = theme.text;
    exportNameInput.placeholderColor = theme.muted;
    exportNameInput.cursorColor = theme.accent;
    exportNameInput.selectionBg = theme.selectedBg;
    exportNameInput.selectionFg = theme.selectedText;

    statusText.fg = toneColor(statusTone);
    latencyText.fg =
      latencyTone === "success"
        ? theme.success
        : latencyTone === "text"
          ? theme.text
          : theme.muted;

    if (!importOpen && !exportOpen) {
      setFocus(focusIndex);
    }
  }

  function toggleTheme(): Theme {
    const next = nextTheme(theme.id);
    applyTheme(next);
    return next;
  }

  function getForm(): FormInput {
    const selected = primitiveSelect.getSelectedOption();
    const primitive =
      (selected?.value as PrimitiveKind | undefined) ?? selectedPrimitive;
    return {
      primitive,
      question: questionInput.plainText,
      context: contextInput.plainText,
      possibleAnswers: answersInput.plainText,
    };
  }

  function setPrimitive(value: PrimitiveKind) {
    selectedPrimitive = value;
    const index = PRIMITIVE_OPTIONS.findIndex((opt) => opt.value === value);
    if (index >= 0) {
      primitiveSelect.setSelectedIndex(index);
    }
    updateAnswersPlaceholder();
  }

  function applyForm(form: FormInput) {
    setPrimitive(form.primitive);
    questionInput.setText(form.question);
    contextInput.setText(form.context);
    answersInput.setText(form.possibleAnswers);
  }

  function clearAll() {
    // Invalidate any in-flight run so its response cannot repaint the UI.
    runEpoch += 1;
    running = false;

    if (exportOpen) closeExport();
    if (importOpen) closeImport();

    applyForm({
      primitive: "noul",
      question: "",
      context: "",
      possibleAnswers: "",
    });
    setStatus("Idle  ·  press Ctrl+Enter to run", "muted");
    setLatency(null);
    setDecision("Run a request to see the parsed decision here.");
    setJson("{\n  // response appears here after a run\n}");
    setFocus(0);
  }

  function closeImport() {
    if (!importOpen) return;
    importOpen = false;
    importOverlay.visible = false;
    importSelect.blur();
    footerText.content = FOOTER_IDLE;
    setFocus(focusIndex);
  }

  function closeExport() {
    if (!exportOpen) return;
    exportOpen = false;
    exportOverlay.visible = false;
    exportNameInput.blur();
    footerText.content = FOOTER_IDLE;
    setFocus(focusIndex);
  }

  function openExport() {
    if (importOpen) closeImport();
    const suggested = buildCaseFilename(getForm());
    exportNameInput.value = suggested;
    exportOpen = true;
    exportOverlay.visible = true;

    for (const key of FOCUS_ORDER) {
      focusables[key].blur();
    }
    exportNameInput.focus();

    // Select the stem so typing replaces the name and keeps ".json".
    const stemEnd = suggested.toLowerCase().endsWith(".json")
      ? suggested.length - ".json".length
      : suggested.length;
    if (stemEnd > 0) {
      exportNameInput.setSelection(0, stemEnd);
    }

    footerText.content =
      "Export  ·  edit filename  ·  Enter save  ·  Esc cancel";
    setStatus("Name the export file, then press Enter", "accent");
  }

  async function openImport() {
    if (exportOpen) closeExport();
    try {
      importFiles = await listCaseFiles();
    } catch (error) {
      setStatus(
        `Error listing data/: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      return;
    }

    if (importFiles.length === 0) {
      setStatus("No cases in data/ yet. Export one with Ctrl+E.", "warn");
      return;
    }

    importSelect.options = importFiles.map((filename) => ({
      name: filename,
      description: "Enter to load into the left pane",
      value: filename,
    }));
    importSelect.setSelectedIndex(0);
    importOpen = true;
    importOverlay.visible = true;

    for (const key of FOCUS_ORDER) {
      focusables[key].blur();
    }
    importSelect.focus();
    footerText.content = "Import mode  ·  ↑↓ select  ·  Enter load  ·  Esc cancel";
    setStatus(`Import: ${importFiles.length} case(s) in data/`, "accent");
  }

  async function confirmImport() {
    const selected = importSelect.getSelectedOption();
    const filename = (selected?.value as string | undefined) ?? importFiles[0];
    if (!filename) {
      setStatus("No case selected.", "warn");
      closeImport();
      return;
    }

    try {
      const loaded = await importCase(filename);
      applyForm(loaded.form);
      closeImport();
      setStatus(`Imported ${filename}`, "success");
      setJson(
        JSON.stringify(
          {
            imported: filename,
            name: loaded.name,
            exportedAt: loaded.exportedAt,
            form: loaded.form,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      closeImport();
      setStatus(
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  async function exportCurrent(filename?: string): Promise<string | null> {
    if (filename === undefined) {
      openExport();
      return null;
    }

    const form = getForm();
    try {
      const normalized = normalizeExportFilename(filename);
      const result = await exportCase(form, { filename: normalized });
      setStatus(`Exported data/${result.filename}`, "success");
      setJson(
        JSON.stringify(
          {
            exported: result.filename,
            path: result.path,
            case: result.case,
          },
          null,
          2,
        ),
      );
      return result.filename;
    } catch (error) {
      setStatus(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      return null;
    }
  }

  async function confirmExport(): Promise<string | null> {
    const rawName = exportNameInput.value;
    closeExport();
    return exportCurrent(rawName);
  }

  primitiveSelect.on(
    SelectRenderableEvents.SELECTION_CHANGED,
    (_index, option) => {
      selectedPrimitive = (option?.value as PrimitiveKind) ?? "noul";
      updateAnswersPlaceholder();
    },
  );
  primitiveSelect.on(
    SelectRenderableEvents.ITEM_SELECTED,
    (_index, option) => {
      selectedPrimitive = (option?.value as PrimitiveKind) ?? "noul";
      updateAnswersPlaceholder();
    },
  );

  importSelect.on(SelectRenderableEvents.ITEM_SELECTED, () => {
    if (importOpen) void confirmImport();
  });

  exportNameInput.on(InputRenderableEvents.ENTER, () => {
    if (exportOpen) void confirmExport();
  });

  async function run() {
    if (running || importOpen || exportOpen) return;
    const epoch = runEpoch;
    running = true;
    setStatus("Running…", "warn");
    setLatency(null);

    try {
      const result = await runSystemOne(getForm());
      if (epoch !== runEpoch) return;

      if (result.ok) {
        setStatus("OK", "success");
        setLatency(result.latencyMs);
        setDecision(summarizeAnswer(result.result));
        setJson(result.json);
      } else {
        setStatus(`Error: ${result.error}`, "error");
        setLatency(result.latencyMs);
        setDecision(
          result.latencyMs === null
            ? "No decision — fix the form or API key, then run again."
            : "No decision — the API call failed. See JSON for details.",
        );
        setJson(
          JSON.stringify(
            {
              error: result.error,
              latencyMs: result.latencyMs,
            },
            null,
            2,
          ),
        );
      }
    } finally {
      if (epoch === runEpoch) running = false;
    }
  }

  const onKey = (key: KeyEvent) => {
    if (key.ctrl && (key.name === "c" || key.name === "C")) {
      key.stopPropagation?.();
      clearAll();
      return;
    }

    if (exportOpen) {
      if (key.name === "escape") {
        key.stopPropagation?.();
        closeExport();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        key.stopPropagation?.();
        void confirmExport();
        return;
      }
      if (key.ctrl || key.name === "tab") {
        key.stopPropagation?.();
      }
      return;
    }

    if (importOpen) {
      if (key.name === "escape") {
        key.stopPropagation?.();
        closeImport();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        key.stopPropagation?.();
        void confirmImport();
        return;
      }
      if (key.ctrl || key.name === "tab") {
        key.stopPropagation?.();
      }
      return;
    }

    if (key.name === "escape") {
      key.stopPropagation?.();
      renderer.destroy();
      return;
    }

    if (key.name === "tab") {
      key.stopPropagation?.();
      setFocus(focusIndex + (key.shift ? -1 : 1));
      return;
    }

    if (key.ctrl && key.name === "e") {
      key.stopPropagation?.();
      openExport();
      return;
    }

    if (key.ctrl && key.name === "i") {
      key.stopPropagation?.();
      void openImport();
      return;
    }

    if (key.ctrl && key.name === "t") {
      key.stopPropagation?.();
      toggleTheme();
      return;
    }

    if (
      key.ctrl &&
      (key.name === "return" ||
        key.name === "enter" ||
        key.name === "j" ||
        key.name === "m")
    ) {
      key.stopPropagation?.();
      void run();
    }
  };

  renderer.keyInput.on("keypress", onKey);

  setFocus(0);
  updateAnswersPlaceholder();

  return {
    run,
    openExport,
    closeExport,
    confirmExport,
    exportCurrent,
    openImport,
    closeImport,
    applyForm,
    getForm,
    isImportOpen: () => importOpen,
    isExportOpen: () => exportOpen,
    getExportFilename: () => exportNameInput.value,
    getExportSelection: () => exportNameInput.getSelection(),
    setExportFilename: (value) => {
      exportNameInput.value = value;
    },
    toggleTheme,
    getThemeId: () => theme.id,
    setFocus,
    getFocusIndex: () => focusIndex,
    getStatus: () => statusMessage,
    getLatency: () => latencyMessage,
    getDecision: () => decisionOutput.plainText,
    getJson: () => jsonOutput.plainText,
    setQuestion: (value) => questionInput.setText(value),
    setContext: (value) => contextInput.setText(value),
    setAnswers: (value) => answersInput.setText(value),
    setPrimitive,
    clearAll,
    destroy: () => {
      renderer.keyInput.off("keypress", onKey);
      renderer.destroy();
    },
  };
}

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    backgroundColor: slateTheme.bg,
    targetFps: 30,
  });
  mountApp(renderer);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
