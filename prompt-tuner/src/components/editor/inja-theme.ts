import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";

/**
 * Custom dark theme for the Inja editor.
 * Matches the plan: expressions cyan, control magenta, comments gray,
 * section markers bold gold with background, block delimiters green,
 * decorator names bold.
 */
export const injaHighlightStyle = HighlightStyle.define([
  // {{ }} and {% %} delimiters + control keywords - magenta
  { tag: t.keyword, color: "#c678dd", fontWeight: "bold" },
  // Variable names in expressions - cyan
  { tag: t.variableName, color: "#56b6c2" },
  // Function names (decorators) - bold cyan
  { tag: t.function(t.variableName), color: "#61afef", fontWeight: "bold" },
  // Strings
  { tag: t.string, color: "#98c379" },
  // Numbers
  { tag: t.number, color: "#d19a66" },
  // Operators
  { tag: t.operator, color: "#c678dd" },
  // Comments - gray
  { tag: t.comment, color: "#5c6370", fontStyle: "italic" },
  // Section markers - bold gold
  { tag: t.heading, color: "#e5c07b", fontWeight: "bold" },
  // Meta (control flow content)
  { tag: t.meta, color: "#c678dd" },
]);

export const injaEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
      height: "100%",
    },
    ".cm-content": {
      fontFamily: "var(--font-geist-mono), monospace",
      fontSize: "13px",
      lineHeight: "1.6",
      padding: "8px 0",
    },
    ".cm-gutters": {
      backgroundColor: "hsl(var(--card))",
      color: "hsl(var(--muted-foreground))",
      borderRight: "1px solid hsl(var(--border))",
      fontSize: "12px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "hsl(var(--accent))",
    },
    ".cm-activeLine": {
      backgroundColor: "hsl(var(--accent) / 0.3)",
    },
    ".cm-cursor": {
      borderLeftColor: "hsl(var(--foreground))",
    },
    ".cm-selectionBackground": {
      backgroundColor: "hsl(var(--accent) / 0.5) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "hsl(var(--accent) / 0.5) !important",
    },
    ".cm-line": {
      padding: "0 8px",
    },
    // Highlight section markers with background
    ".cm-line:has(.tok-heading)": {
      backgroundColor: "rgba(229, 192, 123, 0.1)",
    },
  },
  { dark: true }
);

export const injaThemeExtension = [
  injaEditorTheme,
  syntaxHighlighting(injaHighlightStyle),
];
