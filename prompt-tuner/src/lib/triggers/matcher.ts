import type {
  TriggerYaml,
  TriggerCondition,
  SimulatedEvent,
  TriggerMatchResult,
} from "@/types/yaml-configs";

/**
 * Match a simulated event against a list of triggers.
 * Returns results for each trigger showing match/miss status.
 */
export function matchTriggers(
  event: SimulatedEvent,
  triggers: TriggerYaml[],
  recentEvents: SimulatedEvent[] = []
): TriggerMatchResult[] {
  return triggers.map((trigger) => matchSingleTrigger(event, trigger, recentEvents));
}

function matchSingleTrigger(
  event: SimulatedEvent,
  trigger: TriggerYaml,
  recentEvents: SimulatedEvent[]
): TriggerMatchResult {
  const matchedConditions: string[] = [];
  const failedConditions: string[] = [];

  // Check event type
  if (event.eventType !== trigger.eventType) {
    return {
      trigger,
      matched: false,
      matchedConditions: [],
      failedConditions: [`eventType: expected "${trigger.eventType}", got "${event.eventType}"`],
      blockedReason: "Event type mismatch",
    };
  }
  matchedConditions.push(`eventType: ${event.eventType}`);

  // Check conditions
  for (const condition of trigger.conditions) {
    const result = evaluateCondition(condition, event.fields);
    if (result.passed) {
      matchedConditions.push(result.description);
    } else {
      failedConditions.push(result.description);
    }
  }

  if (failedConditions.length > 0) {
    return {
      trigger,
      matched: false,
      matchedConditions,
      failedConditions,
    };
  }

  // Check cooldown
  if (trigger.cooldownSeconds && trigger.cooldownSeconds > 0) {
    const cooldownMs = trigger.cooldownSeconds * 1000;
    const lastFired = recentEvents
      .filter((e) => e.eventType === trigger.eventType)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (lastFired && event.timestamp - lastFired.timestamp < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (event.timestamp - lastFired.timestamp)) / 1000);
      return {
        trigger,
        matched: false,
        matchedConditions,
        failedConditions: [],
        blockedReason: `Cooldown: ${remaining}s remaining`,
      };
    }
  }

  // Check probability
  if (trigger.probability !== undefined && trigger.probability < 1) {
    const roll = Math.random();
    if (roll > trigger.probability) {
      return {
        trigger,
        matched: false,
        matchedConditions,
        failedConditions: [],
        blockedReason: `Probability check failed (${(trigger.probability * 100).toFixed(0)}% chance, rolled ${(roll * 100).toFixed(0)}%)`,
      };
    }
  }

  // All checks passed - render response
  const renderedResponse = renderResponse(trigger.response, event.fields);

  return {
    trigger,
    matched: true,
    matchedConditions,
    failedConditions: [],
    renderedResponse,
  };
}

function evaluateCondition(
  condition: TriggerCondition,
  fields: Record<string, string | number>
): { passed: boolean; description: string } {
  const fieldValue = fields[condition.field];
  const desc = `${condition.field} ${condition.operator} "${condition.value}"`;

  if (fieldValue === undefined) {
    return { passed: false, description: `${desc} (field missing)` };
  }

  const strValue = String(fieldValue).toLowerCase();
  const strExpected = String(condition.value).toLowerCase();

  switch (condition.operator) {
    case "equals":
      return { passed: strValue === strExpected, description: desc };
    case "contains":
      return { passed: strValue.includes(strExpected), description: desc };
    case "starts_with":
      return { passed: strValue.startsWith(strExpected), description: desc };
    case "regex": {
      try {
        const re = new RegExp(String(condition.value), "i");
        return { passed: re.test(String(fieldValue)), description: desc };
      } catch {
        return { passed: false, description: `${desc} (invalid regex)` };
      }
    }
    case "gt":
      return { passed: Number(fieldValue) > Number(condition.value), description: desc };
    case "lt":
      return { passed: Number(fieldValue) < Number(condition.value), description: desc };
    default:
      return { passed: false, description: `${desc} (unknown operator)` };
  }
}

function renderResponse(
  template: string,
  fields: Record<string, string | number>
): string {
  return template.replace(/\{\{\s*event_json\.(\w+)\s*\}\}/g, (_, key) => {
    return fields[key] !== undefined ? String(fields[key]) : `{{event_json.${key}}}`;
  });
}
