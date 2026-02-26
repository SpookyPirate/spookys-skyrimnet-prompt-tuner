import { sendLlmRequest } from "@/lib/llm/client";
import type { ChatMessage, LlmCallLog } from "@/types/llm";
import type { ChatEntry } from "@/types/simulation";
import { toast } from "sonner";

/**
 * Target selection through rendered pipeline, with hardcoded fallback.
 */
export async function runTargetSelection(
  playerMessage: string,
  chatHistory: ChatEntry[],
  npcs: { displayName: string; gender: string; race: string; distance: number; uuid: string }[],
  scene: { location: string; weather: string; timeOfDay: string; worldPrompt: string; scenePrompt: string },
  playerConfig: { name: string; gender: string; race: string; level: number },
  activePromptSet: string,
  setPreview: (preview: { renderedPrompt: string; messages: { role: string; content: string }[]; rawResponse: string } | null) => void,
  gameEvents?: unknown[]
) {
  let messages: ChatMessage[];

  let renderedPrompt = "";

  try {
    const renderRes = await fetch("/api/prompts/render-target-selector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerMessage,
        chatHistory,
        npcs,
        scene,
        player: playerConfig,
        gameEvents,
        promptSetBase: activePromptSet || undefined,
      }),
    });
    const renderData = await renderRes.json();

    if (renderData.messages && renderData.messages.length > 0) {
      messages = renderData.messages;
      renderedPrompt = renderData.renderedText || "";
    } else {
      throw new Error(renderData.error || "Empty render");
    }
  } catch (err) {
    // Fallback to hardcoded prompt
    toast.warning("Target selector pipeline failed", {
      description: `Could not render player_dialogue_target_selector.prompt — using simplified fallback. ${err instanceof Error ? err.message : ""}`,
    });
    messages = [
      {
        role: "system",
        content: `Select which NPC the player is addressing. Output only the NPC's name.\n\nCandidates:\n${npcs.map((n) => `- ${n.displayName} (${n.gender} ${n.race}, ${n.distance} units away)`).join("\n")}`,
      },
      {
        role: "user",
        content: `Location: ${scene.location}\n\nRecent dialogue:\n${chatHistory.map((e) => e.type === "player" ? `${e.speaker || "Player"}: ${e.content}` : e.type === "npc" ? `${e.speaker}: ${e.content}` : e.content).join("\n")}\n\nPlayer says: "${playerMessage}"\n\nWho is the player addressing? Output only the name.`,
      },
    ];
  }

  const log = await sendLlmRequest({ messages, agent: "meta_eval" });

  if (renderedPrompt) {
    setPreview({
      renderedPrompt,
      messages,
      rawResponse: log.response || "",
    });
  } else {
    setPreview(null);
  }

  return { response: log.response, log };
}

/**
 * Action selector through rendered pipeline (already wired).
 */
export async function runRealActionSelector(
  targetNpc: { displayName: string; uuid: string },
  playerMessage: string,
  npcResponse: string,
  eventHistory: string,
  eligibleActions: { name: string; description: string; parameterSchema?: string }[],
  scene: { location: string; scenePrompt: string; weather: string; timeOfDay: string },
  activePromptSet: string,
  addLlmCall: (log: LlmCallLog) => void,
  setLastAction: (action: { name: string; params?: Record<string, string> } | null) => void,
  setLastActionSelectorPreview: (preview: {
    renderedPrompt: string;
    messages: { role: string; content: string }[];
    rawResponse: string;
    parsedAction: string;
  } | null) => void,
  addChatEntry: (entry: ChatEntry) => void,
  playerConfig?: import("@/types/simulation").PlayerConfig,
  selectedNpcs?: import("@/types/simulation").NpcConfig[],
  chatHistory?: ChatEntry[],
  gameEvents?: unknown[]
) {
  const renderRes = await fetch("/api/prompts/render-action-selector", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      npcName: targetNpc.displayName,
      npcUUID: targetNpc.uuid,
      playerMessage,
      npcResponse,
      eligibleActions: eligibleActions.map((a) => ({
        name: a.name,
        description: a.description,
        parameterSchema: a.parameterSchema,
      })),
      eventHistory,
      scene,
      promptSetBase: activePromptSet || undefined,
      player: playerConfig,
      selectedNpcs: selectedNpcs || [],
      chatHistory: chatHistory || [],
      gameEvents,
    }),
  });

  const renderData = await renderRes.json();

  if (renderData.error) {
    setLastActionSelectorPreview({
      renderedPrompt: `Error: ${renderData.error}`,
      messages: [],
      rawResponse: "",
      parsedAction: "",
    });
    return;
  }

  const messages = renderData.messages || [];
  if (messages.length === 0) {
    setLastActionSelectorPreview({
      renderedPrompt: renderData.renderedText || "(empty)",
      messages: [],
      rawResponse: "",
      parsedAction: "Template produced no messages",
    });
    return;
  }

  const log = await sendLlmRequest({ messages, agent: "action_eval" });
  addLlmCall(log);

  const rawResponse = log.response || "";
  const actionMatch = rawResponse.match(/ACTION:\s*(\w+)/);
  const parsedAction = actionMatch ? actionMatch[1] : "None";

  setLastActionSelectorPreview({
    renderedPrompt: renderData.renderedText || "",
    messages,
    rawResponse,
    parsedAction,
  });

  if (parsedAction && parsedAction !== "None") {
    setLastAction({ name: parsedAction });
    addChatEntry({
      id: `${Date.now()}-action`,
      type: "system",
      content: `[Action: ${parsedAction}]`,
      timestamp: Date.now(),
      action: { name: parsedAction },
    });
  } else {
    setLastAction(null);
  }
}

/**
 * Speaker prediction through rendered pipeline, with hardcoded fallback.
 */
export async function runSpeakerPrediction(
  lastSpeaker: string,
  chatHistory: ChatEntry[],
  npcs: { displayName: string; gender: string; race: string; distance: number; uuid: string }[],
  scene: { location: string; weather: string; timeOfDay: string; worldPrompt: string; scenePrompt: string },
  playerConfig: { name: string; gender: string; race: string; level: number },
  activePromptSet: string,
  setPreview: (preview: { renderedPrompt: string; messages: { role: string; content: string }[]; rawResponse: string } | null) => void,
  gameEvents?: unknown[]
) {
  let messages: ChatMessage[];
  let renderedPrompt = "";

  try {
    const renderRes = await fetch("/api/prompts/render-speaker-selector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastSpeaker,
        chatHistory,
        npcs,
        scene,
        player: playerConfig,
        gameEvents,
        promptSetBase: activePromptSet || undefined,
      }),
    });
    const renderData = await renderRes.json();

    if (renderData.messages && renderData.messages.length > 0) {
      messages = renderData.messages;
      renderedPrompt = renderData.renderedText || "";
    } else {
      throw new Error(renderData.error || "Empty render");
    }
  } catch (err) {
    // Fallback to hardcoded prompt
    toast.warning("Speaker selector pipeline failed", {
      description: `Could not render dialogue_speaker_selector.prompt — using simplified fallback. ${err instanceof Error ? err.message : ""}`,
    });
    const candidates = npcs.filter((n) => n.displayName !== lastSpeaker);
    messages = [
      {
        role: "system",
        content: `Select who speaks next. Output: 0 (silence) or [speaker]>[target]\nDo NOT select ${lastSpeaker} as speaker.\n\nCandidates:\n${candidates.map((n) => `- ${n.displayName} (${n.gender} ${n.race})`).join("\n")}`,
      },
      {
        role: "user",
        content: `Location: ${scene.location}\n\nRecent dialogue:\n${chatHistory.map((e) => e.type === "player" ? `${e.speaker || "Player"}: ${e.content}` : e.type === "npc" ? `${e.speaker}: ${e.content}` : e.content).join("\n")}\n\nWho speaks next? Output 0 or [Name]>[target]`,
      },
    ];
  }

  const log = await sendLlmRequest({ messages, agent: "meta_eval" });

  if (renderedPrompt) {
    setPreview({
      renderedPrompt,
      messages,
      rawResponse: log.response || "",
    });
  } else {
    setPreview(null);
  }

  return { response: log.response, log };
}
