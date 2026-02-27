import type { BenchmarkCategoryDef } from "@/types/benchmark";

export const BENCHMARK_CATEGORIES: BenchmarkCategoryDef[] = [
  {
    id: "dialogue",
    label: "Dialogue",
    description: "NPC dialogue response generation",
    agent: "default",
    subtasks: [
      { id: "dialogue", label: "Dialogue Response", renderEndpoint: "/api/prompts/render-dialogue" },
    ],
  },
  {
    id: "meta_eval",
    label: "Meta Evaluation",
    description: "Target selection, speaker prediction, and conversational flow",
    agent: "meta_eval",
    subtasks: [
      { id: "target_selection", label: "Target Selection", renderEndpoint: "/api/prompts/render-target-selector" },
      { id: "speaker_prediction", label: "Speaker Prediction", renderEndpoint: "/api/prompts/render-speaker-selector" },
    ],
  },
  {
    id: "action_eval",
    label: "Action Evaluation",
    description: "Game action evaluation from dialogue",
    agent: "action_eval",
    subtasks: [
      { id: "action_selection", label: "Action Selection", renderEndpoint: "/api/prompts/render-action-selector" },
    ],
  },
  {
    id: "game_master",
    label: "Game Master",
    description: "Scene planning and autonomous NPC direction",
    agent: "game_master",
    subtasks: [
      { id: "scene_planning", label: "Scene Planning", renderEndpoint: "/api/prompts/render-scene-planner" },
      { id: "gm_action_selection", label: "Action Selection", renderEndpoint: "/api/prompts/render-gm-action-selector" },
    ],
  },
  {
    id: "memory_gen",
    label: "Memory Generation",
    description: "Generate memories from conversation",
    agent: "memory_gen",
    subtasks: [
      { id: "memory_generation", label: "Memory Generation", renderEndpoint: "/api/prompts/render-memory-gen" },
    ],
  },
  {
    id: "diary",
    label: "Diary",
    description: "Generate diary entries for NPCs",
    agent: "diary",
    subtasks: [
      { id: "diary_generation", label: "Diary Generation", renderEndpoint: "/api/prompts/render-diary" },
    ],
  },
  {
    id: "bio_update",
    label: "Bio Update",
    description: "Update character bios from conversation",
    agent: "profile_gen",
    subtasks: [
      { id: "bio_update", label: "Bio Update", renderEndpoint: "/api/prompts/render-bio-update" },
    ],
  },
];

export function getCategoryDef(id: string): BenchmarkCategoryDef | undefined {
  return BENCHMARK_CATEGORIES.find((c) => c.id === id);
}
