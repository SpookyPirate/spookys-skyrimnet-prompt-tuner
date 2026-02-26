"use client";

import { useState, useCallback, useEffect } from "react";
import { useTriggerStore } from "@/stores/triggerStore";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Zap, Trash2 } from "lucide-react";
import {
  TriggerEventType,
  EVENT_FIELD_SCHEMAS,
  type SimulatedEvent,
} from "@/types/yaml-configs";

export function EventSimulator() {
  const fireEvent = useTriggerStore((s) => s.fireEvent);
  const loadTriggers = useTriggerStore((s) => s.loadTriggers);
  const eventHistory = useTriggerStore((s) => s.eventHistory);
  const clearEventHistory = useTriggerStore((s) => s.clearEventHistory);
  const triggers = useTriggerStore((s) => s.triggers);
  const activePromptSet = useAppStore((s) => s.activePromptSet);

  const [eventType, setEventType] = useState<TriggerEventType>(
    TriggerEventType.spell_cast
  );
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTriggers(activePromptSet);
  }, [activePromptSet, loadTriggers]);

  // Reset fields when event type changes
  useEffect(() => {
    const schema = EVENT_FIELD_SCHEMAS[eventType];
    const defaults: Record<string, string> = {};
    schema.forEach((f) => {
      defaults[f.name] = "";
    });
    setFields(defaults);
  }, [eventType]);

  const handleFire = useCallback(() => {
    const parsedFields: Record<string, string | number> = {};
    const schema = EVENT_FIELD_SCHEMAS[eventType];
    for (const [key, val] of Object.entries(fields)) {
      const fieldSchema = schema.find((s) => s.name === key);
      if (fieldSchema?.type === "number" && val) {
        parsedFields[key] = Number(val);
      } else {
        parsedFields[key] = val;
      }
    }

    const event: SimulatedEvent = {
      id: `evt-${Date.now()}`,
      eventType,
      fields: parsedFields,
      timestamp: Date.now(),
    };
    fireEvent(event);
  }, [eventType, fields, fireEvent]);

  const schema = EVENT_FIELD_SCHEMAS[eventType];

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="h-3.5 w-3.5" />
        <h3 className="text-xs font-semibold text-foreground">
          Event Simulator
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0 cursor-help">
                {triggers.length} Custom Triggers
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-56 text-center">
              Add trigger YAML files to your active prompt set&apos;s config/triggers/ folder, or use Tools &gt; Create Custom Trigger in the toolbar.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="space-y-1.5">
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as TriggerEventType)}
          className="w-full h-6 rounded border bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {Object.values(TriggerEventType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {schema.map((field) => (
          <div key={field.name}>
            <label className="text-[9px] text-muted-foreground">
              {field.name}{" "}
              <span className="opacity-60">({field.description})</span>
            </label>
            <Input
              placeholder={field.example}
              value={fields[field.name] || ""}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, [field.name]: e.target.value }))
              }
              className="h-6 text-[10px]"
            />
          </div>
        ))}

        <div className="flex gap-1">
          <Button size="sm" className="h-6 text-[10px] gap-1" onClick={handleFire}>
            <Zap className="h-3 w-3" />
            Fire Event
          </Button>
          {eventHistory.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px]"
              onClick={clearEventHistory}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {eventHistory.length > 0 && (
          <div className="mt-1">
            <span className="text-[9px] text-muted-foreground font-semibold">
              Event History ({eventHistory.length})
            </span>
            <div className="mt-0.5 max-h-24 overflow-auto space-y-0.5">
              {eventHistory
                .slice()
                .reverse()
                .slice(0, 10)
                .map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-1 text-[9px] text-muted-foreground"
                  >
                    <Badge
                      variant="outline"
                      className="text-[8px] px-1 py-0 shrink-0"
                    >
                      {e.eventType}
                    </Badge>
                    <span className="truncate font-mono">
                      {Object.entries(e.fields)
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
