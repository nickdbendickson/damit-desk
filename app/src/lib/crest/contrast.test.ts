// Field mode (styles.css body.field-mode) passes WCAG AA for the text pairs the desk chrome uses.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { contrastRatio, cssVars } from "./contrast.ts";

const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
const field = { ...cssVars(css, ":root"), ...cssVars(css, "body.field-mode") };

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    assert.equal(contrastRatio("#000000", "#ffffff").toFixed(1), "21.0");
    assert.equal(contrastRatio("#777", "#777"), 1);
  });

  it("field mode: text on the panel, page and sand pass AA (4.5:1)", () => {
    const pairs: [string, string][] = [
      ["ink", "panel"], ["ink", "bg"], ["ink", "sand"],
      ["muted", "panel"], ["muted", "bg"], ["muted", "sand"],
      ["teal", "panel"], ["panel", "teal"],
      ["flag-amber", "panel"], ["flag-amber", "amber-bg"], ["flag-green", "panel"], ["flag-green", "green-bg"], ["flag-red", "red-bg"],
      ["panel", "flag-amber"],
    ];
    for (const [fg, bg] of pairs) {
      assert.ok(field[fg] && field[bg], `${fg}/${bg} defined`);
      const r = contrastRatio(field[fg], field[bg]);
      assert.ok(r >= 4.5, `${fg} on ${bg}: ${r.toFixed(2)}`);
    }
  });

  it("field mode swaps the dark amber text, border and High badge for the light flag amber", () => {
    assert.ok(contrastRatio(field.amber, field.panel) < 4.5, "the reason for the override");
    for (const rule of ["body.field-mode .text-amber", "body.field-mode .bg-amber", "body.field-mode .border-amber", "body.field-mode .dash-root .chip.legacy"])
      assert.ok(css.includes(rule + " {"), rule);
  });
});
