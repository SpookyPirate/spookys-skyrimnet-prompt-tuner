import type { AiTuningSettings } from "@/types/config";
import type { BenchmarkCategory } from "@/types/benchmark";
import type {
  TunerRound,
  TunerTurnResult,
  TunerProposal,
  TuningTarget,
} from "@/types/autotuner";
import type { ChatMessage } from "@/types/llm";

interface ExportParams {
  category: BenchmarkCategory | null;
  tuningTarget: TuningTarget;
  customInstructions: string;
  profileName: string;
  rounds: TunerRound[];
  originalSettings: AiTuningSettings | null;
  workingSettings: AiTuningSettings | null;
}

/**
 * Collapse whitespace-only lines and runs of blank lines into a single blank line.
 * Handles Inja template noise where conditionals render as lines with only spaces/tabs.
 */
function collapseBlankLines(text: string): string {
  const stripped = text.replace(/[^\S\n]+$/gm, "");
  return stripped.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildTuningReport(params: ExportParams): string {
  const {
    category,
    tuningTarget,
    customInstructions,
    profileName,
    rounds,
    originalSettings,
    workingSettings,
  } = params;

  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  // ── Header ──────────────────────────────────────────────────────
  push(`# Auto-Tuner Report`);
  push("");
  push(`| | |`);
  push(`|---|---|`);
  push(`| **Date** | ${new Date().toISOString().slice(0, 10)} |`);
  push(`| **Category** | ${category ?? "—"} |`);
  push(`| **Profile** | ${profileName} |`);
  push(`| **Tuning target** | ${tuningTarget} |`);
  push(`| **Rounds** | ${rounds.length} |`);
  if (customInstructions) {
    push("");
    push(`**Custom instructions:**`);
    push("");
    push(`> ${customInstructions.replace(/\n/g, "\n> ")}`);
  }
  push("");

  // ── Settings Changed After Tuning ─────────────────────────────
  if (originalSettings && workingSettings) {
    const keys = Object.keys(originalSettings) as (keyof AiTuningSettings)[];
    const changed = keys.filter(
      (k) => JSON.stringify(originalSettings[k]) !== JSON.stringify(workingSettings[k])
    );
    if (changed.length > 0) {
      push(`## Settings Changed After Tuning`);
      push("");
      push(`| Parameter | Before | After |`);
      push(`|-----------|--------|-------|`);
      for (const k of changed) {
        push(
          `| \`${k}\` | ${JSON.stringify(originalSettings[k])} | ${JSON.stringify(workingSettings[k])} |`
        );
      }
      push("");
    }
  }

  // ── Rounds ──────────────────────────────────────────────────────
  // Follows the exact tuning loop order:
  //   Step 1: Benchmark  (render prompt → send to LLM → response, per subtask)
  //   Step 2: Self-Explanation
  //   Step 3: Assessment
  //   Step 4: Proposed Changes
  for (const round of rounds) {
    push(`---`);
    push("");
    push(`## Round ${round.roundNumber}`);
    push("");

    const benchResult = round.benchmarkResult;
    const isMultiTurn = round.turnResults && round.turnResults.length > 0;

    // ── Step 1: Benchmark ──
    push(`### Step 1: Benchmark`);
    push("");

    if (isMultiTurn) {
      for (const turn of round.turnResults!) {
        formatSubtaskSection(turn, lines);
      }
      // Aggregate stats
      if (benchResult) {
        push(
          `**Total:** ${benchResult.latencyMs}ms · ` +
          `Prompt: ${benchResult.promptTokens} · ` +
          `Completion: ${benchResult.completionTokens} · ` +
          `Total: ${benchResult.totalTokens} tokens`
        );
        push("");
      }
    } else if (benchResult) {
      // Single subtask — show messages inline
      formatMessages(benchResult.messages, lines);
      push(`**Response:**`);
      push("");
      push("```");
      push(benchResult.response);
      push("```");
      push("");
      push(
        `*${benchResult.latencyMs}ms · ` +
        `Prompt: ${benchResult.promptTokens} · ` +
        `Completion: ${benchResult.completionTokens} · ` +
        `Total: ${benchResult.totalTokens} tokens*`
      );
      push("");
    }

    // ── Step 2: Self-Explanation ──
    if (benchResult?.explanation) {
      push(`---`);
      push("");
      push(`### Step 2: Self-Explanation`);
      push("");
      if (round.explanationMessages && round.explanationMessages.length > 0) {
        push(`#### Input`);
        push("");
        formatMessages(round.explanationMessages, lines);
      }
      push(`#### Output`);
      push("");
      push("````");
      push(collapseBlankLines(benchResult.explanation));
      push("````");
      push("");
    }

    // ── Step 3: Assessment ──
    if (round.assessmentText) {
      push(`---`);
      push("");
      push(`### Step 3: Assessment`);
      push("");
      if (round.assessmentMessages && round.assessmentMessages.length > 0) {
        push(`#### Input`);
        push("");
        formatMessages(round.assessmentMessages, lines);
      }
      push(`#### Output`);
      push("");
      push("````");
      push(collapseBlankLines(round.assessmentText));
      push("````");
      push("");
    }

    // ── Step 4: Proposed Changes ──
    if (round.proposal) {
      push(`---`);
      push("");
      push(`### Step 4: Proposed Changes`);
      push("");
      if (round.proposalMessages && round.proposalMessages.length > 0) {
        push(`#### Input`);
        push("");
        formatMessages(round.proposalMessages, lines);
      }
      push(`#### Output`);
      push("");
      formatProposalContent(round.proposal, round.proposalRaw, lines);
    }

    // ── Error ──
    if (round.error) {
      push(`---`);
      push("");
      push(`### Error`);
      push("");
      push(`> ${round.error}`);
      push("");
    }
  }

  return lines.join("\n");
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatMessages(messages: ChatMessage[], lines: string[]) {
  for (const msg of messages) {
    lines.push(`**[${msg.role}]**`);
    lines.push("");
    // Wrap in code block to preserve the exact text the LLM received —
    // message content contains markdown-like syntax (##, **, -, etc.)
    // that would be rendered/transformed if left as raw markdown.
    lines.push("````");
    lines.push(collapseBlankLines(msg.content));
    lines.push("````");
    lines.push("");
  }
}

function formatSubtaskSection(turn: TunerTurnResult, lines: string[]) {
  lines.push(`#### ${turn.label}`);
  lines.push("");

  // Input messages shown directly
  formatMessages(turn.messages, lines);

  // Response
  lines.push(`**Response:**`);
  lines.push("");
  lines.push("```");
  lines.push(turn.response);
  lines.push("```");
  lines.push("");

  // Per-subtask stats
  if (turn.latencyMs != null) {
    const parts: string[] = [`${turn.latencyMs}ms`];
    if (turn.totalTokens != null) parts.push(`${turn.totalTokens} tokens`);
    lines.push(`*${parts.join(" · ")}*`);
    lines.push("");
  }
}

function formatProposalContent(proposal: TunerProposal, proposalRaw: string, lines: string[]) {
  // Show the raw LLM response in a code fence first
  if (proposalRaw) {
    lines.push("````");
    lines.push(collapseBlankLines(proposalRaw));
    lines.push("````");
    lines.push("");
  }

  // Then show the parsed summary
  lines.push(`#### Parsed Changes`);
  lines.push("");

  if (proposal.stopTuning) {
    lines.push(
      `**Tuning complete** — ${proposal.stopReason || "performing well"}`
    );
    lines.push("");
  }

  if (proposal.reasoning) {
    lines.push(`**Reasoning:**`);
    lines.push("");
    lines.push(proposal.reasoning);
    lines.push("");
  }

  // Settings changes
  if (proposal.settingsChanges.length > 0) {
    lines.push(`**Settings changes:**`);
    lines.push("");
    lines.push(`| Parameter | Old | New | Reason |`);
    lines.push(`|-----------|-----|-----|--------|`);
    for (const sc of proposal.settingsChanges) {
      lines.push(
        `| \`${sc.parameter}\` | ${JSON.stringify(sc.oldValue)} | ${JSON.stringify(sc.newValue)} | ${sc.reason} |`
      );
    }
    lines.push("");
  }

  // Prompt changes
  if (proposal.promptChanges.length > 0) {
    lines.push(`**Prompt changes:**`);
    lines.push("");
    for (const pc of proposal.promptChanges) {
      lines.push(`*${pc.filePath}* — ${pc.reason}`);
      lines.push("");
      lines.push("```diff");
      for (const line of pc.searchText.split("\n")) {
        lines.push(`- ${line}`);
      }
      for (const line of pc.replaceText.split("\n")) {
        lines.push(`+ ${line}`);
      }
      lines.push("```");
      lines.push("");
    }
  }

  if (!proposal.stopTuning && proposal.settingsChanges.length === 0 && proposal.promptChanges.length === 0) {
    lines.push(`No changes proposed this round.`);
    lines.push("");
  }
}
