export interface SceneBeat {
  order: number;
  type: "dialogue" | "narration" | "action" | "transition";
  description: string;
  primaryCharacters: string[];
  purpose: string;
}

export interface ScenePlan {
  summary: string;
  tone: string;
  tension: "low" | "medium" | "high";
  beats: SceneBeat[];
  currentBeatIndex: number;
  upcomingBeats: string[];
}

export type GmActionType =
  | "StartConversation"
  | "ContinueConversation"
  | "Narrate"
  | "None";

export interface GmActionEntry {
  action: GmActionType;
  params: {
    speaker?: string;
    target?: string;
    topic?: string;
    text?: string;
  };
  beatIndex: number;
}
