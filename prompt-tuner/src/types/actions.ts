export type ActionCategory = "builtin" | "custom";

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  parameterSchema?: string;
  category: ActionCategory;
  enabled: boolean;
}
