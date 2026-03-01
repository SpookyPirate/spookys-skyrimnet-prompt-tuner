"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useConfigStore } from "@/stores/configStore";
import {
  AGENT_LABELS,
  AGENT_DESCRIPTIONS,
  type AgentType,
} from "@/types/config";
import { RotateCcw } from "lucide-react";

interface ModelSlotPanelProps {
  agent: AgentType;
}

export function ModelSlotPanel({ agent }: ModelSlotPanelProps) {
  const slot = useConfigStore((s) => s.slots[agent]);
  const updateApi = useConfigStore((s) => s.updateSlotApi);
  const updateTuning = useConfigStore((s) => s.updateSlotTuning);
  const resetSlot = useConfigStore((s) => s.resetSlot);

  const isOpenRouter = slot.api.apiEndpoint.includes("openrouter.ai");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{AGENT_LABELS[agent]}</h3>
          <p className="text-xs text-muted-foreground">
            {AGENT_DESCRIPTIONS[agent]}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => resetSlot(agent)}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>

      <Separator />

      {/* API Settings */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          API Settings
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Model Name(s)"
            description="Comma-separated for rotation"
            className="col-span-2"
          >
            <Input
              value={slot.api.modelNames}
              onChange={(e) =>
                updateApi(agent, { modelNames: e.target.value })
              }
              placeholder="google/gemini-2.5-flash, anthropic/claude-sonnet-4"
              className="h-7 text-xs font-mono"
            />
          </Field>

          <Field label="API Endpoint" className="col-span-2">
            <Input
              value={slot.api.apiEndpoint}
              onChange={(e) =>
                updateApi(agent, { apiEndpoint: e.target.value })
              }
              className="h-7 text-xs font-mono"
            />
          </Field>

          <Field
            label="API Key Override"
            description="Leave empty to use global key"
          >
            <Input
              type="password"
              value={slot.api.apiKey}
              onChange={(e) =>
                updateApi(agent, { apiKey: e.target.value })
              }
              placeholder="(uses global)"
              className="h-7 text-xs font-mono"
            />
          </Field>

          <Field label="Max Context Length">
            <Input
              type="number"
              value={slot.api.maxContextLength}
              onChange={(e) =>
                updateApi(agent, {
                  maxContextLength: parseInt(e.target.value) || 4096,
                })
              }
              min={512}
              max={128000}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="Request Timeout (s)">
            <Input
              type="number"
              value={slot.api.requestTimeout}
              onChange={(e) =>
                updateApi(agent, {
                  requestTimeout: parseInt(e.target.value) || 30,
                })
              }
              min={1}
              max={300}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="Connect Timeout (s)">
            <Input
              type="number"
              value={slot.api.connectTimeout}
              onChange={(e) =>
                updateApi(agent, {
                  connectTimeout: parseInt(e.target.value) || 10,
                })
              }
              min={1}
              max={30}
              className="h-7 text-xs"
            />
          </Field>

          <Field label="Use SSE (Streaming)">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={slot.api.useSSE}
                onChange={(e) =>
                  updateApi(agent, { useSSE: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-xs">{slot.api.useSSE ? "Enabled" : "Disabled"}</span>
            </label>
          </Field>

          <Field label="Max Retries">
            <Input
              type="number"
              value={slot.api.maxRetries}
              onChange={(e) =>
                updateApi(agent, {
                  maxRetries: parseInt(e.target.value) || 1,
                })
              }
              min={0}
              max={5}
              className="h-7 text-xs"
            />
          </Field>

          {isOpenRouter && (
            <>
              <Field label="Provider Settings" description="JSON" className="col-span-2">
                <textarea
                  value={slot.api.providerSettings}
                  onChange={(e) =>
                    updateApi(agent, { providerSettings: e.target.value })
                  }
                  className="w-full h-16 rounded-md border bg-transparent px-3 py-1.5 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </Field>

              <Field label="Provider Sorting">
                <select
                  value={slot.api.providerSorting}
                  onChange={(e) =>
                    updateApi(agent, {
                      providerSorting: e.target.value as "latency" | "price" | "throughput",
                    })
                  }
                  className="h-7 w-full rounded-md border bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="latency">Latency</option>
                  <option value="price">Price</option>
                  <option value="throughput">Throughput</option>
                </select>
              </Field>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* AI Tuning */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          AI Tuning
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <SliderField
            label="Temperature"
            value={slot.tuning.temperature}
            onChange={(v) => updateTuning(agent, { temperature: v })}
            min={0}
            max={2}
            step={0.05}
          />
          <Field label="Max Tokens">
            <Input
              type="number"
              value={slot.tuning.maxTokens}
              onChange={(e) =>
                updateTuning(agent, {
                  maxTokens: parseInt(e.target.value) || 4096,
                })
              }
              min={1}
              max={8192}
              className="h-7 text-xs"
            />
          </Field>
          <SliderField
            label="Top P"
            value={slot.tuning.topP}
            onChange={(v) => updateTuning(agent, { topP: v })}
            min={0}
            max={1}
            step={0.05}
          />
          <Field label="Top K">
            <Input
              type="number"
              value={slot.tuning.topK}
              onChange={(e) =>
                updateTuning(agent, {
                  topK: parseInt(e.target.value) || 5,
                })
              }
              min={0}
              max={100}
              className="h-7 text-xs"
            />
          </Field>
          <SliderField
            label="Frequency Penalty"
            value={slot.tuning.frequencyPenalty}
            onChange={(v) => updateTuning(agent, { frequencyPenalty: v })}
            min={-2}
            max={2}
            step={0.1}
          />
          <SliderField
            label="Presence Penalty"
            value={slot.tuning.presencePenalty}
            onChange={(v) => updateTuning(agent, { presencePenalty: v })}
            min={-2}
            max={2}
            step={0.1}
          />

          <Field label="Stop Sequences" description="JSON array" className="col-span-2">
            <Input
              value={slot.tuning.stopSequences}
              onChange={(e) =>
                updateTuning(agent, { stopSequences: e.target.value })
              }
              placeholder='["\\n", "END"]'
              className="h-7 text-xs font-mono"
            />
          </Field>

          <Field label="Structured Outputs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={slot.tuning.structuredOutputs}
                onChange={(e) =>
                  updateTuning(agent, { structuredOutputs: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-xs">
                {slot.tuning.structuredOutputs ? "Enabled" : "Disabled"}
              </span>
            </label>
          </Field>

          <Field label="Allow Reasoning">
            <select
              value={slot.tuning.allowReasoning ? "yes" : "no"}
              onChange={(e) =>
                updateTuning(agent, { allowReasoning: e.target.value === "yes" })
              }
              className="h-7 w-full rounded-md border bg-background text-foreground px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-background [&>option]:text-foreground"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>

        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  description,
  className,
  children,
}: {
  label: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium mb-1 block">
        {label}
        {description && (
          <span className="text-muted-foreground font-normal ml-1">
            ({description})
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground font-mono">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-1.5 accent-primary cursor-pointer"
      />
    </div>
  );
}
