import type { InjaValue } from "@/lib/inja/renderer";

export interface NpcConfig {
  uuid: string;
  name: string;
  displayName: string;
  gender: string;
  race: string;
  distance: number;
  filePath: string;
  isVirtual?: boolean;
  isVirtualPrivate?: boolean;
}

export interface SceneConfig {
  location: string;
  weather: string;
  timeOfDay: string;
  worldPrompt: string;
  scenePrompt: string;
}

export interface ChatEntry {
  id: string;
  type: "player" | "npc" | "system" | "narration";
  speaker?: string;
  target?: string;
  content: string;
  timestamp: number;
  action?: { name: string; params?: Record<string, string> };
  gmBeatIndex?: number;
  gmAction?: string;
}

export interface DemoAction {
  name: string;
  description: string;
  parameterSchema?: string;
}
