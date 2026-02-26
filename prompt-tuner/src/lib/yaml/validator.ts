import yaml from "js-yaml";
import { TriggerEventType } from "@/types/yaml-configs";
import type { CustomActionYaml, TriggerYaml, TriggerCondition } from "@/types/yaml-configs";

interface ValidationResult<T = unknown> {
  valid: boolean;
  errors: string[];
  parsed?: T;
}

const VALID_OPERATORS = ["equals", "contains", "starts_with", "regex", "gt", "lt"];

export function validateActionYaml(content: string): ValidationResult<CustomActionYaml> {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (e) {
    return { valid: false, errors: [`YAML syntax error: ${(e as Error).message}`] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { valid: false, errors: ["YAML must be a mapping/object"] };
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj.name || typeof obj.name !== "string") {
    errors.push("Missing required field: name (string)");
  }
  if (!obj.description || typeof obj.description !== "string") {
    errors.push("Missing required field: description (string)");
  }
  if (obj.parameterSchema !== undefined && typeof obj.parameterSchema !== "object") {
    errors.push("parameterSchema must be an object/mapping");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    parsed: {
      name: obj.name as string,
      description: obj.description as string,
      parameterSchema: obj.parameterSchema as Record<string, string> | undefined,
      category: (obj.category as string) || "custom",
    },
  };
}

export function validateTriggerYaml(content: string): ValidationResult<TriggerYaml> {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (e) {
    return { valid: false, errors: [`YAML syntax error: ${(e as Error).message}`] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { valid: false, errors: ["YAML must be a mapping/object"] };
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj.name || typeof obj.name !== "string") {
    errors.push("Missing required field: name (string)");
  }
  if (!obj.description || typeof obj.description !== "string") {
    errors.push("Missing required field: description (string)");
  }
  if (!obj.eventType || typeof obj.eventType !== "string") {
    errors.push("Missing required field: eventType (string)");
  } else if (!Object.values(TriggerEventType).includes(obj.eventType as TriggerEventType)) {
    errors.push(`Invalid eventType: "${obj.eventType}". Valid types: ${Object.values(TriggerEventType).join(", ")}`);
  }
  if (!obj.response || typeof obj.response !== "string") {
    errors.push("Missing required field: response (string)");
  }

  // Validate conditions
  if (obj.conditions !== undefined) {
    if (!Array.isArray(obj.conditions)) {
      errors.push("conditions must be an array");
    } else {
      (obj.conditions as unknown[]).forEach((cond, i) => {
        if (!cond || typeof cond !== "object") {
          errors.push(`conditions[${i}]: must be an object`);
          return;
        }
        const c = cond as Record<string, unknown>;
        if (!c.field || typeof c.field !== "string") {
          errors.push(`conditions[${i}]: missing field`);
        }
        if (!c.operator || typeof c.operator !== "string" || !VALID_OPERATORS.includes(c.operator)) {
          errors.push(`conditions[${i}]: invalid operator. Valid: ${VALID_OPERATORS.join(", ")}`);
        }
        if (c.value === undefined) {
          errors.push(`conditions[${i}]: missing value`);
        }
      });
    }
  }

  // Validate optional numeric fields
  if (obj.probability !== undefined) {
    const p = Number(obj.probability);
    if (isNaN(p) || p < 0 || p > 1) {
      errors.push("probability must be a number between 0 and 1");
    }
  }
  if (obj.cooldownSeconds !== undefined) {
    const c = Number(obj.cooldownSeconds);
    if (isNaN(c) || c < 0) {
      errors.push("cooldownSeconds must be a non-negative number");
    }
  }
  if (obj.priority !== undefined) {
    const p = Number(obj.priority);
    if (isNaN(p)) {
      errors.push("priority must be a number");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const conditions: TriggerCondition[] = Array.isArray(obj.conditions)
    ? (obj.conditions as Record<string, unknown>[]).map((c) => ({
        field: c.field as string,
        operator: c.operator as TriggerCondition["operator"],
        value: c.value as string | number,
      }))
    : [];

  return {
    valid: true,
    errors: [],
    parsed: {
      name: obj.name as string,
      description: obj.description as string,
      eventType: obj.eventType as TriggerEventType,
      conditions,
      response: obj.response as string,
      cooldownSeconds: obj.cooldownSeconds as number | undefined,
      probability: obj.probability as number | undefined,
      priority: obj.priority as number | undefined,
    },
  };
}
