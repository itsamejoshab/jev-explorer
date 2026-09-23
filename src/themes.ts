export interface Theme {
  id: string;
  name: string;
  bg: string;
  panel: string;
  border: string;
  focusBorder: string;
  text: string;
  muted: string;
  accent: string;
  success: string;
  error: string;
  warn: string;
  inputBg: string;
  inputFocus: string;
  selectedBg: string;
  selectedText: string;
  selectedDescription: string;
  footer: string;
  footerBorder: string;
  footerText: string;
  overlay: string;
}

/** Original cool slate / cyan layout. */
export const slateTheme: Theme = {
  id: "slate",
  name: "Slate",
  bg: "#0f172a",
  panel: "#111827",
  border: "#334155",
  focusBorder: "#38bdf8",
  text: "#e2e8f0",
  muted: "#94a3b8",
  accent: "#38bdf8",
  success: "#4ade80",
  error: "#f87171",
  warn: "#fbbf24",
  inputBg: "#1e293b",
  inputFocus: "#334155",
  selectedBg: "#0ea5e9",
  selectedText: "#0f172a",
  selectedDescription: "#e0f2fe",
  footer: "#1e3a5f",
  footerBorder: "#1d4ed8",
  footerText: "#dbeafe",
  overlay: "#020617",
};

/**
 * Moss
 * ["#a1cca5","#8fb996","#709775","#415d43","#111d13"]
 */
export const mossTheme: Theme = {
  id: "moss",
  name: "Moss",
  bg: "#111d13",
  panel: "#415d43",
  border: "#709775",
  focusBorder: "#a1cca5",
  text: "#a1cca5",
  muted: "#8fb996",
  accent: "#a1cca5",
  success: "#a1cca5",
  error: "#e8a0a0",
  warn: "#d4c48a",
  inputBg: "#2a3f2d",
  inputFocus: "#709775",
  selectedBg: "#8fb996",
  selectedText: "#111d13",
  selectedDescription: "#e8f5e9",
  footer: "#415d43",
  footerBorder: "#709775",
  footerText: "#a1cca5",
  overlay: "#0a120c",
};

/**
 * Vineyard
 * ["#386641","#6a994e","#a7c957","#f2e8cf","#bc4749"]
 * Error from palette (#bc4749). Warn: warm gold.
 */
export const vineyardTheme: Theme = {
  id: "vineyard",
  name: "Vineyard",
  bg: "#386641",
  panel: "#6a994e",
  border: "#a7c957",
  focusBorder: "#f2e8cf",
  text: "#f2e8cf",
  muted: "#a7c957",
  accent: "#a7c957",
  success: "#a7c957",
  error: "#bc4749",
  warn: "#e6c97a",
  inputBg: "#2f5536",
  inputFocus: "#6a994e",
  selectedBg: "#a7c957",
  selectedText: "#386641",
  selectedDescription: "#f2e8cf",
  footer: "#2f5536",
  footerBorder: "#a7c957",
  footerText: "#f2e8cf",
  overlay: "#24452b",
};

/**
 * Ember
 * ["#fffcf2","#ccc5b9","#403d39","#252422","#eb5e28"]
 * Accent/warn from orange. Error: deeper red-orange.
 */
export const emberTheme: Theme = {
  id: "ember",
  name: "Ember",
  bg: "#252422",
  panel: "#403d39",
  border: "#ccc5b9",
  focusBorder: "#eb5e28",
  text: "#fffcf2",
  muted: "#ccc5b9",
  accent: "#eb5e28",
  success: "#a7c957",
  error: "#d64545",
  warn: "#eb5e28",
  inputBg: "#2e2c29",
  inputFocus: "#403d39",
  selectedBg: "#eb5e28",
  selectedText: "#fffcf2",
  selectedDescription: "#fffcf2",
  footer: "#403d39",
  footerBorder: "#eb5e28",
  footerText: "#fffcf2",
  overlay: "#1a1917",
};

/**
 * Lavender
 * ["#231942","#5e548e","#9f86c0","#be95c4","#e0b1cb"]
 * Error: soft rose (reads clearly on purple).
 */
export const lavenderTheme: Theme = {
  id: "lavender",
  name: "Lavender",
  bg: "#231942",
  panel: "#5e548e",
  border: "#9f86c0",
  focusBorder: "#e0b1cb",
  text: "#e0b1cb",
  muted: "#be95c4",
  accent: "#be95c4",
  success: "#b8e0d2",
  error: "#e07a8a",
  warn: "#e8c47c",
  inputBg: "#3a2f5c",
  inputFocus: "#5e548e",
  selectedBg: "#9f86c0",
  selectedText: "#231942",
  selectedDescription: "#e0b1cb",
  footer: "#5e548e",
  footerBorder: "#be95c4",
  footerText: "#e0b1cb",
  overlay: "#180f2e",
};

/**
 * Harbor
 * ["#e7ecef","#274c77","#6096ba","#a3cef1","#8b8c89"]
 * Error: coral that contrasts on navy.
 */
export const harborTheme: Theme = {
  id: "harbor",
  name: "Harbor",
  bg: "#274c77",
  panel: "#1f3d5f",
  border: "#6096ba",
  focusBorder: "#a3cef1",
  text: "#e7ecef",
  muted: "#8b8c89",
  accent: "#a3cef1",
  success: "#7dcea0",
  error: "#e57373",
  warn: "#f0c674",
  inputBg: "#1f3d5f",
  inputFocus: "#6096ba",
  selectedBg: "#6096ba",
  selectedText: "#e7ecef",
  selectedDescription: "#e7ecef",
  footer: "#1f3d5f",
  footerBorder: "#a3cef1",
  footerText: "#e7ecef",
  overlay: "#16304c",
};

/**
 * Tide
 * ["#01161e","#124559","#598392","#aec3b0","#eff6e0"]
 * Error: muted coral on deep teal.
 */
export const tideTheme: Theme = {
  id: "tide",
  name: "Tide",
  bg: "#01161e",
  panel: "#124559",
  border: "#598392",
  focusBorder: "#aec3b0",
  text: "#eff6e0",
  muted: "#aec3b0",
  accent: "#aec3b0",
  success: "#aec3b0",
  error: "#e07a6a",
  warn: "#e6c97a",
  inputBg: "#0a2a36",
  inputFocus: "#124559",
  selectedBg: "#598392",
  selectedText: "#eff6e0",
  selectedDescription: "#eff6e0",
  footer: "#124559",
  footerBorder: "#598392",
  footerText: "#eff6e0",
  overlay: "#000d12",
};

/**
 * Clay
 * ["#7a6c5d","#2a3d45","#ddc9b4","#bcac9b","#c17c74"]
 * Error from palette (#c17c74).
 */
export const clayTheme: Theme = {
  id: "clay",
  name: "Clay",
  bg: "#2a3d45",
  panel: "#7a6c5d",
  border: "#bcac9b",
  focusBorder: "#ddc9b4",
  text: "#ddc9b4",
  muted: "#bcac9b",
  accent: "#ddc9b4",
  success: "#a7c4a0",
  error: "#c17c74",
  warn: "#d4b483",
  inputBg: "#3a4f57",
  inputFocus: "#7a6c5d",
  selectedBg: "#bcac9b",
  selectedText: "#2a3d45",
  selectedDescription: "#ddc9b4",
  footer: "#7a6c5d",
  footerBorder: "#bcac9b",
  footerText: "#ddc9b4",
  overlay: "#1c2a30",
};

export const THEMES: Theme[] = [
  slateTheme,
  mossTheme,
  vineyardTheme,
  emberTheme,
  lavenderTheme,
  harborTheme,
  tideTheme,
  clayTheme,
];

export function getTheme(id: string): Theme {
  return THEMES.find((theme) => theme.id === id) ?? slateTheme;
}

export function nextTheme(currentId: string): Theme {
  const index = THEMES.findIndex((theme) => theme.id === currentId);
  const next = index < 0 ? 0 : (index + 1) % THEMES.length;
  return THEMES[next]!;
}
