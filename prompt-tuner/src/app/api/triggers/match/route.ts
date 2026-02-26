import { NextRequest, NextResponse } from "next/server";
import { matchTriggers } from "@/lib/triggers/matcher";
import type { SimulatedEvent, TriggerYaml } from "@/types/yaml-configs";

/**
 * Match simulated events against triggers.
 * POST body: { event: SimulatedEvent, triggers: TriggerYaml[], recentEvents?: SimulatedEvent[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, triggers, recentEvents } = body;

    if (!event || !triggers) {
      return NextResponse.json(
        { error: "Missing event or triggers" },
        { status: 400 }
      );
    }

    const results = matchTriggers(
      event as SimulatedEvent,
      triggers as TriggerYaml[],
      (recentEvents || []) as SimulatedEvent[]
    );

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: `Match failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
