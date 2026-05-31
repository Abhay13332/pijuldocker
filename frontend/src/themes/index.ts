/**
 * Theme registry — auto-discovers every *.css file in src/themes/.
 *
 * To add a new theme:
 *   1. Drop a new .css file in src/themes/
 *   2. It's automatically picked up — no other code changes needed.
 *
 * Each CSS file is expected to follow the pattern:
 *   :root { CSS custom properties for light mode }
 *   .dark  { CSS custom properties for dark mode  }
 *
 * The @import, @theme, @layer blocks are ignored during parsing.
 */

export interface ThemeDefinition {
  id: string;
  name: string;
  lightVars: Record<string, string>;
  darkVars: Record<string, string>;
  /** Preview swatches shown in the Settings picker (light-mode values) */
  preview: { background: string; primary: string; accent: string; border: string };
}

// ── Auto-import every *.css in this folder as a raw string ────────────────────
const _rawFiles = import.meta.glob('./*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// ── CSS parser: extract custom-property declarations from a selector block ────
function parseCSSBlock(css: string, selector: string): Record<string, string> {
  // Escape selector for use in regex  (.dark → \.dark, :root → :root)
  const esc = selector.replace(/[.[\]*+?^${}()|\\]/g, '\\$&');
  const pattern = new RegExp(`${esc}\\s*\\{([\\s\\S]*?)\\}`, 'g');

  const vars: Record<string, string> = {};
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = pattern.exec(css)) !== null) {
    const block = blockMatch[1];
    const propRe = /--([\w-]+)\s*:\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = propRe.exec(block)) !== null) {
      vars[`--${m[1]}`] = m[2].trim();
    }
  }
  return vars;
}

function toDisplayName(path: string): string {
  // './caffeine.css' → 'Caffeine'
  const base = path.replace(/^\.\//, '').replace(/\.css$/, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ── Build the registry ────────────────────────────────────────────────────────
export const themes: Record<string, ThemeDefinition> = {
  // Built-in "Default" entry — no CSS overrides, index.css values apply
  default: {
    id: 'default',
    name: 'Default',
    lightVars: {},
    darkVars: {},
    preview: {
      background: 'oklch(0.9818 0.0054 95.0986)',
      primary:    'oklch(0.6152 0.1298 39.1430)',
      accent:     'oklch(0.9245 0.0138 92.9892)',
      border:     'oklch(0.9401 0 0)',
    },
  },
};

for (const [path, css] of Object.entries(_rawFiles)) {
  const id         = path.replace(/^\.\//, '').replace(/\.css$/, '');
  const lightVars  = parseCSSBlock(css, ':root');
  const darkVars   = parseCSSBlock(css, '.dark');

  themes[id] = {
    id,
    name:     toDisplayName(path),
    lightVars,
    darkVars,
    preview: {
      background: lightVars['--background'] ?? 'oklch(0.98 0 0)',
      primary:    lightVars['--primary']    ?? 'oklch(0.5 0.1 250)',
      accent:     lightVars['--accent']     ?? 'oklch(0.9 0.05 250)',
      border:     lightVars['--border']     ?? 'oklch(0.88 0 0)',
    },
  };
}

// ── Apply / remove a theme override <style> tag ───────────────────────────────
const STYLE_ID = 'pijulserv-theme-override';

export function applyTheme(themeId: string): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const theme = themes[themeId];
  if (!theme || themeId === 'default') return;   // default: let index.css win

  const toBlock = (vars: Record<string, string>) =>
    Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n');

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    `:root {\n${toBlock(theme.lightVars)}\n}\n` +
    `.dark {\n${toBlock(theme.darkVars)}\n}`;
  document.head.appendChild(style);
}
