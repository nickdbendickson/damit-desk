/**
 * The command palette's matching (Ctrl+K / Cmd+K, DamIT Desk UI 2026-11-21). Pure: the palette component owns the
 * commands and runs them; this only filters and orders them for what was typed, and recognises the shortcut.
 */
export type PaletteCommand = {
  id: string;
  label: string;
  /** Shown after the label in a muted tone (e.g. what the command does, or a dam's NID). */
  hint?: string;
  group: string;
  /** Extra words that match (e.g. "dark" for Field mode). */
  keywords?: string[];
  disabled?: boolean;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[…]/g, "")
    .trim();

/**
 * Commands matching every word typed (in the label, hint, group or keywords), best first: a label that starts with
 * the text, then a word in the label that starts with it, then any other match. An empty query keeps the given order.
 */
export function filterCommands<T extends PaletteCommand>(commands: readonly T[], query: string): T[] {
  const q = norm(query);
  if (!q) return [...commands];
  const words = q.split(/\s+/).filter(Boolean);
  const scored: { c: T; score: number; i: number }[] = [];
  commands.forEach((c, i) => {
    const label = norm(c.label);
    const hay = [label, norm(c.hint ?? ""), norm(c.group), ...(c.keywords ?? []).map(norm)].join(" ");
    if (!words.every((w) => hay.includes(w))) return;
    const score = label.startsWith(q) ? 0 : label.split(/[\s:/(]+/).some((w) => w.startsWith(words[0])) ? 1 : 2;
    scored.push({ c, score, i });
  });
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((s) => s.c);
}

/** Ctrl+K, or Cmd+K on a Mac: the palette's shortcut (no Shift or Alt, so other shortcuts are left alone). */
export function isPaletteShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k";
}

/** The next enabled index when moving by `delta` (wraps), or -1 when nothing is enabled. */
export function moveActive(items: readonly { disabled?: boolean }[], from: number, delta: number): number {
  const n = items.length;
  if (!n) return -1;
  for (let k = 1; k <= n; k++) {
    const i = (((from + delta * k) % n) + n) % n;
    if (!items[i].disabled) return i;
  }
  return -1;
}

/** "Ctrl K" on Windows and Linux, "⌘K" on a Mac. */
export function shortcutLabel(platform: string): string {
  return /mac|iphone|ipad/i.test(platform) ? "⌘K" : "Ctrl K";
}
