import { useAppStore } from "@/stores/appStore";
import { parseCharacterName } from "@/lib/files/paths";

interface NpcLike {
  uuid: string;
  name: string;
  displayName?: string;
  filePath?: string;
  isVirtual?: boolean;
}

interface ResolvedNpc {
  uuid: string;
  filePath: string;
}

/**
 * Resolve an NPC to a real character file by searching the active prompt set.
 * Returns the real uuid (filename without .prompt) and filePath if found,
 * or null if no matching character file exists.
 */
export async function resolveNpcByName(name: string): Promise<ResolvedNpc | null> {
  try {
    const activeSet = useAppStore.getState().activePromptSet;
    const res = await fetch(
      `/api/files/search?q=${encodeURIComponent(name)}&type=characters&activeSet=${encodeURIComponent(activeSet)}`
    );
    const data = await res.json();
    const results = data.results || [];
    const nameLower = name.toLowerCase();
    const match = results.find((r: { displayName?: string; name: string; path: string }) => {
      const display = (r.displayName || parseCharacterName(r.name).displayName).toLowerCase();
      return display === nameLower;
    });
    if (match) {
      return {
        uuid: match.name.replace(".prompt", ""),
        filePath: match.path,
      };
    }
  } catch {}
  return null;
}

/**
 * If the NPC has a fake/virtual UUID (no real character file),
 * resolve it to the actual character file. Returns a copy with
 * real uuid and filePath, or the original if already resolved or no match found.
 */
export async function resolveNpcIfNeeded<T extends NpcLike>(npc: T): Promise<T> {
  // Already has a real file path — no resolution needed
  if (npc.filePath) return npc;

  const resolved = await resolveNpcByName(npc.displayName || npc.name);
  if (resolved) {
    return {
      ...npc,
      uuid: resolved.uuid,
      filePath: resolved.filePath,
      isVirtual: false,
    };
  }
  return npc;
}

/**
 * Resolve all NPCs in an array, in parallel.
 */
export async function resolveNpcsIfNeeded<T extends NpcLike>(npcs: T[]): Promise<T[]> {
  return Promise.all(npcs.map(resolveNpcIfNeeded));
}
