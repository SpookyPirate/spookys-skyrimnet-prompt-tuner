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
  centralTension: string;
  tension: "low" | "medium" | "high";
  beats: SceneBeat[];
  currentBeatIndex: number;
  upcomingBeats: string[];
  potentialEscalations: string[];
  naturalEndings: string[];
}

/** Convert store ScenePlan to snake_case object for Inja templates */
export function scenePlanToTemplateFormat(plan: ScenePlan): Record<string, unknown> {
  const currentBeat = plan.beats[plan.currentBeatIndex];
  return {
    scene_summary: plan.summary,
    tone: plan.tone,
    central_tension: plan.centralTension,
    current_beat_index: plan.currentBeatIndex,
    total_beats: plan.beats.length,
    current_beat: currentBeat ? {
      type: currentBeat.type,
      description: currentBeat.description,
      primary_characters: currentBeat.primaryCharacters,
      purpose: currentBeat.purpose,
    } : null,
    upcoming_beats: plan.beats.slice(plan.currentBeatIndex + 1).map(b => ({
      order: b.order,
      type: b.type,
      description: b.description,
    })),
    potential_escalations: plan.potentialEscalations,
  };
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
