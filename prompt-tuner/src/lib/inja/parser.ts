import { tokenize, type Token } from "./tokenizer";

// AST Node Types
export type AstNode =
  | TextNode
  | ExpressionNode
  | IfNode
  | ForNode
  | SetNode
  | BlockNode
  | CommentNode;

export interface TextNode {
  type: "text";
  value: string;
}

export interface ExpressionNode {
  type: "expression";
  expr: Expr;
}

export interface IfNode {
  type: "if";
  branches: { condition: Expr; body: AstNode[] }[];
  elseBody: AstNode[] | null;
}

export interface ForNode {
  type: "for";
  variable: string;
  iterable: Expr;
  body: AstNode[];
}

export interface SetNode {
  type: "set";
  variable: string;
  value: Expr;
}

export interface BlockNode {
  type: "block";
  name: string;
  body: AstNode[];
}

export interface CommentNode {
  type: "comment";
  value: string;
}

// Expression types
export type Expr =
  | StringLiteral
  | NumberLiteral
  | BoolLiteral
  | Variable
  | DotAccess
  | BracketAccess
  | FunctionCall
  | BinaryOp
  | UnaryOp
  | FilterExpr;

export interface StringLiteral {
  kind: "string";
  value: string;
}

export interface NumberLiteral {
  kind: "number";
  value: number;
}

export interface BoolLiteral {
  kind: "bool";
  value: boolean;
}

export interface Variable {
  kind: "variable";
  name: string;
}

export interface DotAccess {
  kind: "dot";
  object: Expr;
  property: string;
}

export interface BracketAccess {
  kind: "bracket";
  object: Expr;
  index: Expr;
}

export interface FunctionCall {
  kind: "call";
  name: string;
  callee?: Expr;
  args: Expr[];
}

export interface BinaryOp {
  kind: "binary";
  op: string;
  left: Expr;
  right: Expr;
}

export interface UnaryOp {
  kind: "unary";
  op: string;
  operand: Expr;
}

export interface FilterExpr {
  kind: "filter";
  value: Expr;
  filterName: string;
  args: Expr[];
}

/**
 * Parse an Inja template source into an AST.
 */
export function parse(source: string): AstNode[] {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parseNodes();
}

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: string): Token {
    const tok = this.advance();
    if (!tok || tok.type !== type) {
      throw new Error(
        `Expected ${type} but got ${tok?.type || "EOF"} at line ${tok?.line || "?"}`
      );
    }
    return tok;
  }

  parseNodes(stopKeywords?: string[]): AstNode[] {
    const nodes: AstNode[] = [];

    while (this.pos < this.tokens.length) {
      const tok = this.peek()!;

      if (tok.type === "text") {
        nodes.push({ type: "text", value: tok.value });
        this.advance();
      } else if (tok.type === "comment") {
        nodes.push({ type: "comment", value: tok.value });
        this.advance();
      } else if (tok.type === "expression_open") {
        nodes.push(this.parseExpression());
      } else if (tok.type === "control_open") {
        // Peek at the control content to see if we should stop
        const controlContent = this.tokens[this.pos + 1]?.value?.trim() || "";

        if (stopKeywords) {
          for (const kw of stopKeywords) {
            if (controlContent === kw || controlContent.startsWith(kw + " ") || controlContent.startsWith(kw + "\t")) {
              return nodes;
            }
          }
        }

        const controlNode = this.parseControl();
        if (controlNode) nodes.push(controlNode);
      } else {
        // Skip unexpected tokens
        this.advance();
      }
    }

    return nodes;
  }

  private parseExpression(): ExpressionNode {
    this.expect("expression_open");
    const exprText = this.advance().value;
    this.expect("expression_close");
    const expr = parseExpr(exprText);
    return { type: "expression", expr };
  }

  private parseControl(): AstNode | null {
    this.expect("control_open");
    const controlText = this.advance().value.trim();
    this.expect("control_close");

    if (controlText.startsWith("if ")) {
      return this.parseIf(controlText.slice(3).trim());
    }
    if (controlText.startsWith("for ")) {
      return this.parseFor(controlText.slice(4).trim());
    }
    if (controlText.startsWith("set ")) {
      return this.parseSet(controlText.slice(4).trim());
    }
    if (controlText.startsWith("block ")) {
      return this.parseBlock(controlText.slice(6).trim());
    }

    // Unknown control — return as text
    return { type: "text", value: `{% ${controlText} %}` };
  }

  private parseIf(conditionText: string): IfNode {
    const condition = parseExpr(conditionText);
    const body = this.parseNodes(["else if", "else", "endif"]);

    const branches: { condition: Expr; body: AstNode[] }[] = [
      { condition, body },
    ];
    let elseBody: AstNode[] | null = null;

    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos + 1];
      if (!tok) break;
      const ctrlText = tok.value?.trim() || "";

      if (ctrlText === "endif") {
        this.consumeControl();
        break;
      } else if (ctrlText.startsWith("else if ")) {
        this.consumeControl();
        const nextCondition = parseExpr(ctrlText.slice(8).trim());
        const nextBody = this.parseNodes(["else if", "else", "endif"]);
        branches.push({ condition: nextCondition, body: nextBody });
      } else if (ctrlText === "else") {
        this.consumeControl();
        elseBody = this.parseNodes(["endif"]);
        // Consume endif
        if (this.tokens[this.pos + 1]?.value?.trim() === "endif") {
          this.consumeControl();
        }
        break;
      } else {
        break;
      }
    }

    return { type: "if", branches, elseBody };
  }

  private parseFor(forText: string): ForNode {
    // "variable in iterable"
    const inIdx = forText.indexOf(" in ");
    if (inIdx === -1) {
      throw new Error(`Invalid for syntax: ${forText}`);
    }
    const variable = forText.slice(0, inIdx).trim();
    const iterableExpr = parseExpr(forText.slice(inIdx + 4).trim());
    const body = this.parseNodes(["endfor"]);

    // Consume endfor
    if (this.tokens[this.pos + 1]?.value?.trim() === "endfor") {
      this.consumeControl();
    }

    return { type: "for", variable, iterable: iterableExpr, body };
  }

  private parseSet(setText: string): SetNode {
    const eqIdx = setText.indexOf("=");
    if (eqIdx === -1) {
      throw new Error(`Invalid set syntax: ${setText}`);
    }
    const variable = setText.slice(0, eqIdx).trim();
    const valueExpr = parseExpr(setText.slice(eqIdx + 1).trim());
    return { type: "set", variable, value: valueExpr };
  }

  private parseBlock(blockName: string): BlockNode {
    const body = this.parseNodes(["endblock"]);

    // Consume endblock
    if (this.tokens[this.pos + 1]?.value?.trim() === "endblock") {
      this.consumeControl();
    }

    return { type: "block", name: blockName, body };
  }

  private consumeControl() {
    this.expect("control_open");
    this.advance(); // control content
    this.expect("control_close");
  }
}

/**
 * Parse a single expression string into an Expr AST.
 * Handles: variables, dot access, function calls, operators, strings, numbers.
 */
export function parseExpr(text: string): Expr {
  const parser = new ExprParser(text.trim());
  return parser.parseOr();
}

class ExprParser {
  private text: string;
  private pos: number;

  constructor(text: string) {
    this.text = text;
    this.pos = 0;
  }

  private skipWhitespace() {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) {
      this.pos++;
    }
  }

  private peek(): string {
    return this.text[this.pos] || "";
  }

  private peekWord(): string {
    this.skipWhitespace();
    const match = this.text.slice(this.pos).match(/^[a-zA-Z_]\w*/);
    return match ? match[0] : "";
  }

  private consume(expected?: string): string {
    if (expected) {
      this.skipWhitespace();
      if (this.text.slice(this.pos, this.pos + expected.length) === expected) {
        this.pos += expected.length;
        return expected;
      }
      throw new Error(
        `Expected '${expected}' at pos ${this.pos} in '${this.text}'`
      );
    }
    return this.text[this.pos++];
  }

  parseOr(): Expr {
    let left = this.parseAnd();
    this.skipWhitespace();
    while (this.peekWord() === "or") {
      this.pos += 2;
      const right = this.parseAnd();
      left = { kind: "binary", op: "or", left, right };
      this.skipWhitespace();
    }
    return left;
  }

  parseAnd(): Expr {
    let left = this.parseNot();
    this.skipWhitespace();
    while (this.peekWord() === "and") {
      this.pos += 3;
      const right = this.parseNot();
      left = { kind: "binary", op: "and", left, right };
      this.skipWhitespace();
    }
    return left;
  }

  parseNot(): Expr {
    this.skipWhitespace();
    if (this.peekWord() === "not") {
      this.pos += 3;
      const operand = this.parseNot();
      return { kind: "unary", op: "not", operand };
    }
    return this.parseComparison();
  }

  parseComparison(): Expr {
    let left = this.parseAddition();
    this.skipWhitespace();

    const ops = ["==", "!=", ">=", "<=", ">", "<"];
    for (const op of ops) {
      if (this.text.slice(this.pos, this.pos + op.length) === op) {
        this.pos += op.length;
        const right = this.parseAddition();
        left = { kind: "binary", op, left, right };
        this.skipWhitespace();
      }
    }

    // "in" operator
    if (this.peekWord() === "in") {
      this.pos += 2;
      const right = this.parseAddition();
      left = { kind: "binary", op: "in", left, right };
    }

    return left;
  }

  parseAddition(): Expr {
    let left = this.parseMultiplication();
    this.skipWhitespace();
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.consume();
      const right = this.parseMultiplication();
      left = { kind: "binary", op, left, right };
      this.skipWhitespace();
    }
    return left;
  }

  parseMultiplication(): Expr {
    let left = this.parsePrimary();
    this.skipWhitespace();
    while (this.peek() === "*" || this.peek() === "/" || this.peek() === "%") {
      const op = this.consume();
      const right = this.parsePrimary();
      left = { kind: "binary", op, left, right };
      this.skipWhitespace();
    }
    return left;
  }

  parsePrimary(): Expr {
    this.skipWhitespace();

    // String literal
    if (this.peek() === '"' || this.peek() === "'") {
      return this.parseString();
    }

    // Number literal
    if (/\d/.test(this.peek()) || (this.peek() === "-" && /\d/.test(this.text[this.pos + 1] || ""))) {
      return this.parseNumber();
    }

    // Parenthesized expression
    if (this.peek() === "(") {
      this.consume("(");
      const expr = this.parseOr();
      this.skipWhitespace();
      this.consume(")");
      return this.parsePostfix(expr);
    }

    // Boolean or keyword
    const word = this.peekWord();
    if (word === "true") {
      this.pos += 4;
      return this.parsePostfix({ kind: "bool", value: true });
    }
    if (word === "false") {
      this.pos += 5;
      return this.parsePostfix({ kind: "bool", value: false });
    }

    // Identifier (variable or function call)
    if (/[a-zA-Z_]/.test(this.peek())) {
      return this.parseIdentifier();
    }

    // Fallback: return remaining text as a variable
    const remaining = this.text.slice(this.pos).trim();
    this.pos = this.text.length;
    return { kind: "variable", name: remaining };
  }

  private parseString(): Expr {
    const quote = this.consume();
    let value = "";
    while (this.pos < this.text.length && this.text[this.pos] !== quote) {
      if (this.text[this.pos] === "\\") {
        this.pos++;
        const escaped = this.text[this.pos];
        if (escaped === "n") value += "\n";
        else if (escaped === "t") value += "\t";
        else if (escaped === "\\") value += "\\";
        else if (escaped === quote) value += quote;
        else value += "\\" + escaped;
      } else {
        value += this.text[this.pos];
      }
      this.pos++;
    }
    if (this.pos < this.text.length) this.pos++; // consume closing quote
    return this.parsePostfix({ kind: "string", value });
  }

  private parseNumber(): Expr {
    let numStr = "";
    if (this.peek() === "-") numStr += this.consume();
    while (this.pos < this.text.length && /[\d.]/.test(this.text[this.pos])) {
      numStr += this.text[this.pos++];
    }
    return this.parsePostfix({ kind: "number", value: parseFloat(numStr) });
  }

  private parseIdentifier(): Expr {
    let name = "";
    while (
      this.pos < this.text.length &&
      /[a-zA-Z_0-9]/.test(this.text[this.pos])
    ) {
      name += this.text[this.pos++];
    }

    this.skipWhitespace();

    // Function call?
    if (this.peek() === "(") {
      const args = this.parseArgList();
      const callExpr: FunctionCall = { kind: "call", name, args };
      return this.parsePostfix(callExpr);
    }

    // Variable with postfix access
    return this.parsePostfix({ kind: "variable", name });
  }

  private parseArgList(): Expr[] {
    this.consume("(");
    const args: Expr[] = [];
    this.skipWhitespace();
    if (this.peek() !== ")") {
      args.push(this.parseOr());
      this.skipWhitespace();
      while (this.peek() === ",") {
        this.consume(",");
        args.push(this.parseOr());
        this.skipWhitespace();
      }
    }
    this.skipWhitespace();
    this.consume(")");
    return args;
  }

  private parsePostfix(expr: Expr): Expr {
    this.skipWhitespace();

    // Dot access
    if (this.peek() === ".") {
      this.consume(".");
      let prop = "";
      while (
        this.pos < this.text.length &&
        /[a-zA-Z_0-9]/.test(this.text[this.pos])
      ) {
        prop += this.text[this.pos++];
      }
      this.skipWhitespace();

      // Method call?
      if (this.peek() === "(") {
        const args = this.parseArgList();
        const callExpr: FunctionCall = {
          kind: "call",
          name: prop,
          callee: expr,
          args,
        };
        return this.parsePostfix(callExpr);
      }

      return this.parsePostfix({ kind: "dot", object: expr, property: prop });
    }

    // Bracket access
    if (this.peek() === "[") {
      this.consume("[");
      const index = this.parseOr();
      this.skipWhitespace();
      this.consume("]");
      return this.parsePostfix({
        kind: "bracket",
        object: expr,
        index,
      });
    }

    return expr;
  }
}
