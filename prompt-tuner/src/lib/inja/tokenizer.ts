export type TokenType =
  | "text"
  | "expression_open"   // {{
  | "expression_close"  // }}
  | "control_open"      // {%
  | "control_close"     // %}
  | "comment";          // {# ... #}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

/**
 * Tokenize an Inja template into a stream of tokens.
 * Splits the template into text segments and template tags.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;
  let textStart = 0;

  function addTextToken() {
    if (pos > textStart) {
      tokens.push({
        type: "text",
        value: source.slice(textStart, pos),
        line,
        col,
      });
    }
  }

  function advanceTo(newPos: number) {
    for (let i = pos; i < newPos; i++) {
      if (source[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
    pos = newPos;
  }

  while (pos < source.length) {
    // Check for comment {# ... #}
    if (source[pos] === "{" && source[pos + 1] === "#") {
      addTextToken();
      const startLine = line;
      const startCol = col;
      const end = source.indexOf("#}", pos + 2);
      if (end === -1) {
        // Unterminated comment — treat rest as comment
        tokens.push({
          type: "comment",
          value: source.slice(pos + 2),
          line: startLine,
          col: startCol,
        });
        pos = source.length;
      } else {
        tokens.push({
          type: "comment",
          value: source.slice(pos + 2, end).trim(),
          line: startLine,
          col: startCol,
        });
        advanceTo(end + 2);
      }
      textStart = pos;
      continue;
    }

    // Check for expression {{ ... }}
    if (source[pos] === "{" && source[pos + 1] === "{") {
      addTextToken();
      const startLine = line;
      const startCol = col;
      advanceTo(pos + 2);
      tokens.push({
        type: "expression_open",
        value: "{{",
        line: startLine,
        col: startCol,
      });

      // Find closing }}
      const end = source.indexOf("}}", pos);
      if (end === -1) {
        tokens.push({
          type: "text",
          value: source.slice(pos),
          line,
          col,
        });
        pos = source.length;
      } else {
        const expr = source.slice(pos, end).trim();
        if (expr) {
          tokens.push({
            type: "text",
            value: expr,
            line,
            col,
          });
        }
        advanceTo(end);
        tokens.push({
          type: "expression_close",
          value: "}}",
          line,
          col,
        });
        advanceTo(end + 2);
      }
      textStart = pos;
      continue;
    }

    // Check for control {% ... %}
    if (source[pos] === "{" && source[pos + 1] === "%") {
      addTextToken();
      const startLine = line;
      const startCol = col;
      advanceTo(pos + 2);
      tokens.push({
        type: "control_open",
        value: "{%",
        line: startLine,
        col: startCol,
      });

      // Find closing %}
      const end = source.indexOf("%}", pos);
      if (end === -1) {
        tokens.push({
          type: "text",
          value: source.slice(pos),
          line,
          col,
        });
        pos = source.length;
      } else {
        const ctrl = source.slice(pos, end).trim();
        if (ctrl) {
          tokens.push({
            type: "text",
            value: ctrl,
            line,
            col,
          });
        }
        advanceTo(end);
        tokens.push({
          type: "control_close",
          value: "%}",
          line,
          col,
        });
        advanceTo(end + 2);
      }
      textStart = pos;
      continue;
    }

    // Regular character
    if (source[pos] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    pos++;
  }

  // Remaining text
  addTextToken();

  return tokens;
}
