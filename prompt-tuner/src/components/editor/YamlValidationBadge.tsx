"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, AlertTriangle } from "lucide-react";

interface YamlValidationBadgeProps {
  content: string;
  filePath: string;
}

export function YamlValidationBadge({ content, filePath }: YamlValidationBadgeProps) {
  const [valid, setValid] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!content) return;

    // Debounce validation
    const timer = setTimeout(async () => {
      try {
        // Determine type from path
        const type = filePath.includes("trigger") ? "trigger" : "action";
        const res = await fetch("/api/yaml/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, type }),
        });
        const data = await res.json();
        setValid(data.valid);
        setErrors(data.errors || []);
      } catch {
        setValid(null);
        setErrors([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [content, filePath]);

  if (valid === null) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {valid ? (
          <Badge className="bg-green-600/80 text-[9px] px-1.5 py-0 gap-0.5">
            <Check className="h-2.5 w-2.5" />
            Valid
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 gap-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />
            {errors.length} error{errors.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        {valid ? (
          <span className="text-xs">YAML configuration is valid</span>
        ) : (
          <div className="text-xs space-y-0.5">
            {errors.map((e, i) => (
              <div key={i} className="text-destructive">
                {e}
              </div>
            ))}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
