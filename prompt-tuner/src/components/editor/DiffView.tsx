"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiffViewProps {
  original: string;
  modified: string;
  originalLabel?: string;
  modifiedLabel?: string;
}

interface DiffLine {
  type: "same" | "added" | "removed" | "changed";
  originalLineNo?: number;
  modifiedLineNo?: number;
  originalText?: string;
  modifiedText?: string;
}

export function DiffView({
  original,
  modified,
  originalLabel = "Original",
  modifiedLabel = "Modified",
}: DiffViewProps) {
  const diffLines = useMemo(
    () => computeDiff(original, modified),
    [original, modified]
  );

  if (original === modified) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Files are identical
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 border-b text-xs">
        <div className="border-r px-3 py-1.5 font-medium text-muted-foreground bg-red-500/5">
          {originalLabel}
        </div>
        <div className="px-3 py-1.5 font-medium text-muted-foreground bg-green-500/5">
          {modifiedLabel}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="font-mono text-xs">
          {diffLines.map((line, i) => (
            <div key={i} className="grid grid-cols-2">
              <div
                className={`border-r px-1 py-px flex ${
                  line.type === "removed" || line.type === "changed"
                    ? "bg-red-500/10"
                    : ""
                }`}
              >
                <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground/50 select-none">
                  {line.originalLineNo ?? ""}
                </span>
                <span className="whitespace-pre-wrap break-all">
                  {line.type === "removed" || line.type === "changed" ? (
                    <span className="text-red-400">{line.originalText}</span>
                  ) : line.type === "same" ? (
                    line.originalText
                  ) : null}
                </span>
              </div>
              <div
                className={`px-1 py-px flex ${
                  line.type === "added" || line.type === "changed"
                    ? "bg-green-500/10"
                    : ""
                }`}
              >
                <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground/50 select-none">
                  {line.modifiedLineNo ?? ""}
                </span>
                <span className="whitespace-pre-wrap break-all">
                  {line.type === "added" || line.type === "changed" ? (
                    <span className="text-green-400">{line.modifiedText}</span>
                  ) : line.type === "same" ? (
                    line.modifiedText
                  ) : null}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Simple line-by-line diff using LCS (longest common subsequence).
 * Not optimal for huge files, but fine for prompt files (typically < 500 lines).
 */
function computeDiff(original: string, modified: string): DiffLine[] {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");

  // Build LCS table
  const m = origLines.length;
  const n = modLines.length;

  // Use space-efficient approach for large files
  if (m > 5000 || n > 5000) {
    return simpleFallbackDiff(origLines, modLines);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      stack.push({
        type: "same",
        originalLineNo: i,
        modifiedLineNo: j,
        originalText: origLines[i - 1],
        modifiedText: modLines[j - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({
        type: "added",
        modifiedLineNo: j,
        modifiedText: modLines[j - 1],
      });
      j--;
    } else {
      stack.push({
        type: "removed",
        originalLineNo: i,
        originalText: origLines[i - 1],
      });
      i--;
    }
  }

  // Reverse since we built it backwards
  stack.reverse();

  // Merge adjacent removed+added into "changed" pairs
  for (let k = 0; k < stack.length; k++) {
    const curr = stack[k];
    const next = stack[k + 1];
    if (
      curr.type === "removed" &&
      next?.type === "added"
    ) {
      result.push({
        type: "changed",
        originalLineNo: curr.originalLineNo,
        modifiedLineNo: next.modifiedLineNo,
        originalText: curr.originalText,
        modifiedText: next.modifiedText,
      });
      k++; // Skip next
    } else {
      result.push(curr);
    }
  }

  return result;
}

function simpleFallbackDiff(
  origLines: string[],
  modLines: string[]
): DiffLine[] {
  const result: DiffLine[] = [];
  const maxLen = Math.max(origLines.length, modLines.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i];
    const mod = modLines[i];

    if (orig === undefined) {
      result.push({
        type: "added",
        modifiedLineNo: i + 1,
        modifiedText: mod,
      });
    } else if (mod === undefined) {
      result.push({
        type: "removed",
        originalLineNo: i + 1,
        originalText: orig,
      });
    } else if (orig === mod) {
      result.push({
        type: "same",
        originalLineNo: i + 1,
        modifiedLineNo: i + 1,
        originalText: orig,
        modifiedText: mod,
      });
    } else {
      result.push({
        type: "changed",
        originalLineNo: i + 1,
        modifiedLineNo: i + 1,
        originalText: orig,
        modifiedText: mod,
      });
    }
  }

  return result;
}
