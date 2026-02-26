import type { InjaValue } from "@/lib/inja/renderer";

export interface PlayerConfig {
  name: string;
  gender: string;
  race: string;
  level: number;
  isInCombat: boolean;
  bio: string;
}

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

export interface ScenePreset {
  id: string;
  name: string;
  createdAt: string;
  scene: SceneConfig;
  npcs: NpcConfig[];
  /** Map of action ID → enabled state */
  actionStates?: Record<string, boolean>;
  player?: PlayerConfig;
}
