import { sendLlmRequest } from "@/lib/llm/client";
import { buildEnabledSavesPayload } from "@/lib/pipeline/save-bio-payload";
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
      enabledSaves: buildEnabledSavesPayload(),
    }),
  });
  const renderData = await renderRes.json();

  if (!renderData.messages || renderData.messages.length === 0) {
    const errMsg = renderData.error || "Empty render";
    toast.error("Target selector pipeline failed", {
      description: `Could not render player_dialogue_target_selector.prompt: ${errMsg}`,
    });
    throw new Error(errMsg);
  }
  messages = renderData.messages;
  renderedPrompt = renderData.renderedText || "";

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
      enabledSaves: buildEnabledSavesPayload(),
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
 * Speaker prediction through rendered pipeline.
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
      enabledSaves: buildEnabledSavesPayload(),
    }),
  });
  const renderData = await renderRes.json();

  if (!renderData.messages || renderData.messages.length === 0) {
    const errMsg = renderData.error || "Empty render";
    toast.error("Speaker selector pipeline failed", {
      description: `Could not render dialogue_speaker_selector.prompt: ${errMsg}`,
    });
    throw new Error(errMsg);
  }
  messages = renderData.messages;
  renderedPrompt = renderData.renderedText || "";

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
