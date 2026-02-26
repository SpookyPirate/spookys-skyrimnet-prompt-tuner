import { parse, parseExpr, type AstNode, type Expr } from "./parser";

export type InjaValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | InjaValue[]
  | { [key: string]: InjaValue };

export interface RenderContext {
  variables: Record<string, InjaValue>;
  blocks: Record<string, string>;
  functions: Record<string, (...args: InjaValue[]) => InjaValue | Promise<InjaValue>>;
}

/**
 * Render an Inja template with the given context.
 */
export async function render(
  source: string,
  ctx: RenderContext
): Promise<string> {
  const ast = parse(source);
  return renderNodes(ast, ctx);
}

async function renderNodes(
  nodes: AstNode[],
  ctx: RenderContext
): Promise<string> {
  const parts: string[] = [];
  for (const node of nodes) {
    parts.push(await renderNode(node, ctx));
  }
  return parts.join("");
}

async function renderNode(
  node: AstNode,
  ctx: RenderContext
): Promise<string> {
  switch (node.type) {
    case "text":
      return node.value;

    case "comment":
      return "";

    case "expression": {
      const val = await evalExpr(node.expr, ctx);
      return stringify(val);
    }

    case "if": {
      for (const branch of node.branches) {
        const cond = await evalExpr(branch.condition, ctx);
        if (isTruthy(cond)) {
          return renderNodes(branch.body, ctx);
        }
      }
      if (node.elseBody) {
        return renderNodes(node.elseBody, ctx);
      }
      return "";
    }

    case "for": {
      const iterable = await evalExpr(node.iterable, ctx);
      if (!Array.isArray(iterable)) return "";

      const parts: string[] = [];
      for (let i = 0; i < iterable.length; i++) {
        const loopCtx: RenderContext = {
          ...ctx,
          variables: {
            ...ctx.variables,
            [node.variable]: iterable[i],
            loop: {
              index: i,
              index1: i + 1,
              is_first: i === 0,
              is_last: i === iterable.length - 1,
              length: iterable.length,
            } as unknown as InjaValue,
          },
        };
        parts.push(await renderNodes(node.body, loopCtx));
      }
      return parts.join("");
    }

    case "set": {
      const val = await evalExpr(node.value, ctx);
      ctx.variables[node.variable] = val;
      return "";
    }

    case "block": {
      // Check if there's a character block override
      if (ctx.blocks[node.name]) {
        return ctx.blocks[node.name];
      }
      // Otherwise render default body
      return renderNodes(node.body, ctx);
    }
  }
}

/**
 * Evaluate an expression in the given context.
 */
export async function evalExpr(
  expr: Expr,
  ctx: RenderContext
): Promise<InjaValue> {
  switch (expr.kind) {
    case "string":
      return expr.value;

    case "number":
      return expr.value;

    case "bool":
      return expr.value;

    case "variable":
      return resolveVariable(expr.name, ctx);

    case "dot": {
      const obj = await evalExpr(expr.object, ctx);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return (obj as Record<string, InjaValue>)[expr.property];
      }
      return undefined;
    }

    case "bracket": {
      const obj = await evalExpr(expr.object, ctx);
      const idx = await evalExpr(expr.index, ctx);
      if (Array.isArray(obj) && typeof idx === "number") {
        return obj[idx];
      }
      if (obj && typeof obj === "object" && typeof idx === "string") {
        return (obj as Record<string, InjaValue>)[idx];
      }
      return undefined;
    }

    case "call":
      return evalCall(expr, ctx);

    case "binary":
      return evalBinary(expr, ctx);

    case "unary": {
      const operand = await evalExpr(expr.operand, ctx);
      if (expr.op === "not") return !isTruthy(operand);
      if (expr.op === "-") return -(operand as number);
      return operand;
    }

    case "filter": {
      const val = await evalExpr(expr.value, ctx);
      return applyFilter(expr.filterName, val, expr.args, ctx);
    }
  }
}

function resolveVariable(name: string, ctx: RenderContext): InjaValue {
  if (name in ctx.variables) {
    return ctx.variables[name];
  }
  // Try as a dot-separated path
  const parts = name.split(".");
  let current: InjaValue = ctx.variables;
  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, InjaValue>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

async function evalCall(
  expr: Expr & { kind: "call" },
  ctx: RenderContext
): Promise<InjaValue> {
  const args: InjaValue[] = [];
  for (const arg of expr.args) {
    args.push(await evalExpr(arg, ctx));
  }

  // Method call on an object?
  if (expr.callee) {
    const obj = await evalExpr(expr.callee, ctx);
    return applyBuiltinMethod(expr.name, obj, args);
  }

  // Built-in functions
  const builtin = getBuiltinFunction(expr.name);
  if (builtin) {
    return builtin(args, ctx);
  }

  // User-registered functions
  if (ctx.functions[expr.name]) {
    return ctx.functions[expr.name](...args);
  }

  return `[unknown function: ${expr.name}]`;
}

async function evalBinary(
  expr: Expr & { kind: "binary" },
  ctx: RenderContext
): Promise<InjaValue> {
  const left = await evalExpr(expr.left, ctx);
  const right = await evalExpr(expr.right, ctx);

  switch (expr.op) {
    case "==":
      return left == right;
    case "!=":
      return left != right;
    case ">":
      return (left as number) > (right as number);
    case "<":
      return (left as number) < (right as number);
    case ">=":
      return (left as number) >= (right as number);
    case "<=":
      return (left as number) <= (right as number);
    case "+":
      if (typeof left === "string" || typeof right === "string") {
        return stringify(left) + stringify(right);
      }
      return (left as number) + (right as number);
    case "-":
      return (left as number) - (right as number);
    case "*":
      return (left as number) * (right as number);
    case "/":
      return (left as number) / (right as number);
    case "%":
      return (left as number) % (right as number);
    case "and":
      return isTruthy(left) && isTruthy(right);
    case "or":
      return isTruthy(left) || isTruthy(right);
    case "in": {
      if (typeof right === "string") {
        return right.includes(stringify(left));
      }
      if (Array.isArray(right)) {
        return right.includes(left);
      }
      return false;
    }
  }
  return undefined;
}

// Built-in Inja functions
function getBuiltinFunction(
  name: string
): ((args: InjaValue[], ctx: RenderContext) => InjaValue) | null {
  switch (name) {
    case "length":
      return (args) => {
        const val = args[0];
        if (typeof val === "string") return val.length;
        if (Array.isArray(val)) return val.length;
        if (val && typeof val === "object") return Object.keys(val).length;
        return 0;
      };

    case "contains":
      return (args) => {
        const haystack = args[0];
        const needle = args[1];
        if (typeof haystack === "string" && typeof needle === "string") {
          return haystack.includes(needle);
        }
        if (Array.isArray(haystack)) {
          return haystack.includes(needle);
        }
        return false;
      };

    case "join":
      return (args) => {
        const arr = args[0];
        const sep = typeof args[1] === "string" ? args[1] : ",";
        if (Array.isArray(arr)) {
          return arr.map(stringify).join(sep);
        }
        return stringify(arr);
      };

    case "lower":
      return (args) => stringify(args[0]).toLowerCase();

    case "upper":
      return (args) => stringify(args[0]).toUpperCase();

    case "replace":
      return (args) => {
        const str = stringify(args[0]);
        const from = stringify(args[1]);
        const to = stringify(args[2]);
        return str.split(from).join(to);
      };

    case "to_string":
      return (args) => stringify(args[0]);

    case "exists":
      return (args, ctx) => {
        // exists("varname") should look up the variable name in context
        if (typeof args[0] === "string") {
          return resolveVariable(args[0], ctx) !== undefined;
        }
        // exists(value) checks if the value itself is defined
        return args[0] !== undefined && args[0] !== null;
      };

    case "existsIn":
      return (args) => {
        const obj = args[0];
        const key = stringify(args[1]);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          return key in (obj as Record<string, InjaValue>);
        }
        return false;
      };

    case "default":
      return (args) => {
        return args[0] !== undefined && args[0] !== null && args[0] !== ""
          ? args[0]
          : args[1];
      };

    case "first":
      return (args) => {
        const arr = args[0];
        if (Array.isArray(arr) && arr.length > 0) return arr[0];
        if (typeof arr === "string" && arr.length > 0) return arr[0];
        return undefined;
      };

    case "last":
      return (args) => {
        const arr = args[0];
        if (Array.isArray(arr) && arr.length > 0) return arr[arr.length - 1];
        if (typeof arr === "string" && arr.length > 0)
          return arr[arr.length - 1];
        return undefined;
      };

    case "append":
      return (args) => {
        const arr = args[0];
        const val = args[1];
        if (Array.isArray(arr)) {
          return [...arr, val];
        }
        return [val];
      };

    case "short_time":
      return (args) => {
        // Extracts time from game time string like "Sundas, 3:00 PM, 17th of Last Seed, 4E 201"
        const str = stringify(args[0]);
        const match = str.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        return match ? match[1] : str;
      };

    case "capitalize":
      return (args) => {
        const s = stringify(args[0]);
        return s.charAt(0).toUpperCase() + s.slice(1);
      };

    case "has_key":
      return (args) => {
        const obj = args[0];
        const key = stringify(args[1]);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          return key in (obj as Record<string, InjaValue>);
        }
        return false;
      };

    case "range":
      return (args) => {
        const start = typeof args[0] === "number" ? args[0] : 0;
        const end = typeof args[1] === "number" ? args[1] : start;
        const arr: number[] = [];
        const actualStart = args.length === 1 ? 0 : start;
        const actualEnd = args.length === 1 ? start : end;
        for (let i = actualStart; i < actualEnd; i++) {
          arr.push(i);
        }
        return arr as InjaValue;
      };

    default:
      return null;
  }
}

function applyBuiltinMethod(
  name: string,
  obj: InjaValue,
  args: InjaValue[]
): InjaValue {
  // Could add string/array methods here if needed
  return undefined;
}

async function applyFilter(
  name: string,
  value: InjaValue,
  args: Expr[],
  ctx: RenderContext
): Promise<InjaValue> {
  const fn = getBuiltinFunction(name);
  if (fn) {
    const evaledArgs: InjaValue[] = [value];
    for (const arg of args) {
      evaledArgs.push(await evalExpr(arg, ctx));
    }
    return fn(evaledArgs, ctx);
  }
  return value;
}

export function isTruthy(val: InjaValue): boolean {
  if (val === null || val === undefined || val === false || val === 0 || val === "") {
    return false;
  }
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}

export function stringify(val: InjaValue): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return val.toString();
  if (typeof val === "boolean") return val ? "true" : "false";
  if (Array.isArray(val)) return JSON.stringify(val);
  return JSON.stringify(val);
}

/**
 * Extract block definitions from a character file.
 * Returns a map of block name → block content (as raw text).
 */
export function extractBlocks(source: string): Record<string, string> {
  const blocks: Record<string, string> = {};
  const regex = /\{%\s*block\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endblock\s*%\}/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    blocks[match[1]] = match[2].trim();
  }
  return blocks;
}
