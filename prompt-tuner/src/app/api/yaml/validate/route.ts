import { NextRequest, NextResponse } from "next/server";
import { validateActionYaml, validateTriggerYaml } from "@/lib/yaml/validator";

/**
 * Validate YAML content.
 * POST body: { content: string, type: "action" | "trigger" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, type } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    if (type !== "action" && type !== "trigger") {
      return NextResponse.json({ error: "type must be 'action' or 'trigger'" }, { status: 400 });
    }

    const result = type === "action"
      ? validateActionYaml(content)
      : validateTriggerYaml(content);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `Validation failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
