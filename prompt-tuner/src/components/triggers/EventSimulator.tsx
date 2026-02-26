"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTriggerStore } from "@/stores/triggerStore";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, Trash2 } from "lucide-react";
import {
  TriggerEventType,
  EVENT_FIELD_SCHEMAS,
  type EventFieldSchema,
  type SimulatedEvent,
} from "@/types/yaml-configs";

export function EventSimulator() {
  const fireEvent = useTriggerStore((s) => s.fireEvent);
  const loadTriggers = useTriggerStore((s) => s.loadTriggers);
  const eventHistory = useTriggerStore((s) => s.eventHistory);
  const clearEventHistory = useTriggerStore((s) => s.clearEventHistory);
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
            <SuggestInput
              field={field}
              value={fields[field.name] || ""}
              onChange={(val) =>
                setFields((prev) => ({ ...prev, [field.name]: val }))
              }
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
  );
}

function SuggestInput({
  field,
  value,
  onChange,
}: {
  field: EventFieldSchema;
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const suggestions = field.suggestions || [];
  const filtered = value
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIdx >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[focusIdx]) {
        (items[focusIdx] as HTMLElement).scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
    } else if (e.key === "Enter" && focusIdx >= 0 && focusIdx < filtered.length) {
      e.preventDefault();
      onChange(filtered[focusIdx]);
      setOpen(false);
      setFocusIdx(-1);
    } else if (e.key === "Escape") {
      setOpen(false);
      setFocusIdx(-1);
    }
  };

  if (suggestions.length === 0) {
    return (
      <Input
        placeholder={field.example}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 text-[10px]"
      />
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        placeholder={field.example}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setFocusIdx(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="h-6 text-[10px]"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-0.5 max-h-36 w-full overflow-auto rounded border bg-popover shadow-md"
        >
          {filtered.map((suggestion, idx) => (
            <button
              key={suggestion}
              type="button"
              className={`w-full px-2 py-1 text-left text-[10px] hover:bg-accent/50 ${
                idx === focusIdx ? "bg-accent" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(suggestion);
                setOpen(false);
                setFocusIdx(-1);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
