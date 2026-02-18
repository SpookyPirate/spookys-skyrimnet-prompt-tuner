"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useConfigStore } from "@/stores/configStore";
import { sendLlmRequest } from "@/lib/llm/client";
import { TUNER_SYSTEM_PROMPT } from "@/lib/tuner/system-prompt";
import type { ChatMessage } from "@/types/llm";
import {
  Send,
  Loader2,
  Trash2,
  Square,
  Bot,
  User,
  FileText,
  FolderSearch,
} from "lucide-react";

interface TunerMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: { name: string; args: string; result?: string }[];
}

export function TunerChat() {
  const [messages, setMessages] = useState<TunerMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const globalApiKey = useConfigStore((s) => s.globalApiKey);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    const userMessage = input.trim();
    setInput("");

    const userMsg: TunerMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: userMessage,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    setStreamingText("");

    try {
      // Build message history for the LLM
      const llmMessages: ChatMessage[] = [
        { role: "system", content: TUNER_SYSTEM_PROMPT },
        ...messages.map(
          (m): ChatMessage => ({
            role: m.role === "system" ? "assistant" : m.role,
            content: m.content,
          })
        ),
        { role: "user", content: userMessage },
      ];

      const abortController = new AbortController();
      abortRef.current = abortController;

      const log = await sendLlmRequest({
        messages: llmMessages,
        agent: "tuner",
        onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
        signal: abortController.signal,
      });

      const response = log.response || "";
      setStreamingText("");

      if (log.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-error`,
            role: "system",
            content: `Error: ${log.error}`,
          },
        ]);
      } else {
        // Check if the response contains file operation requests
        const toolCalls = parseToolCalls(response);

        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            role: "assistant",
            content: response,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          },
        ]);

        // Execute any tool calls
        if (toolCalls.length > 0) {
          for (const call of toolCalls) {
            try {
              const result = await executeToolCall(call.name, call.args);
              call.result = result;
            } catch (e) {
              call.result = `Error: ${(e as Error).message}`;
            }
          }
          // Update the message with results
          setMessages((prev) => [...prev]);
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-error`,
            role: "system",
            content: `Error: ${(error as Error).message}`,
          },
        ]);
      }
    } finally {
      setIsProcessing(false);
      abortRef.current = null;
    }
  }, [input, isProcessing, messages]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsProcessing(false);
    setStreamingText("");
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    setStreamingText("");
  }, []);

  const hasApiKey = !!globalApiKey;

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-3 space-y-3">
          {messages.length === 0 && !streamingText && (
            <div className="text-center text-xs text-muted-foreground py-8 space-y-2">
              <Bot className="h-8 w-8 mx-auto opacity-20" />
              <p>SkyrimNet Tuner Agent</p>
              <p className="text-[10px] max-w-xs mx-auto">
                {hasApiKey
                  ? "Ask me to enhance speech styles, create character bios, explain prompt architecture, or suggest improvements."
                  : "Configure an API key in Settings to start."}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <TunerBubble key={msg.id} message={msg} />
          ))}

          {streamingText && (
            <TunerBubble
              message={{
                id: "streaming",
                role: "assistant",
                content: streamingText,
              }}
            />
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleClear}
            disabled={isProcessing}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={
              hasApiKey
                ? "Ask the tuner agent..."
                : "Set API key in Settings first"
            }
            disabled={!hasApiKey || isProcessing}
            className="h-8 text-xs"
          />
          {isProcessing ? (
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleStop}
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || !hasApiKey}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TunerBubble({ message }: { message: TunerMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="text-center text-[10px] text-destructive py-0.5">
        {message.content}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
            {message.toolCalls.map((call, i) => (
              <div key={i} className="rounded bg-background/50 p-1.5 text-[10px]">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {call.name}
                  </Badge>
                  <span className="font-mono text-muted-foreground truncate">
                    {call.args}
                  </span>
                </div>
                {call.result && (
                  <pre className="mt-1 max-h-20 overflow-auto text-[9px] text-muted-foreground">
                    {call.result.substring(0, 500)}
                    {call.result.length > 500 ? "..." : ""}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="shrink-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

// Simple tool call parser — looks for structured patterns in the response
function parseToolCalls(
  response: string
): { name: string; args: string; result?: string }[] {
  const calls: { name: string; args: string; result?: string }[] = [];
  // This is a simple pattern matcher — in a full implementation,
  // we'd use OpenAI function calling or Anthropic tool use
  const patterns = [
    /```read_file\s*\n([\s\S]*?)```/g,
    /```write_file\s*\n([\s\S]*?)```/g,
    /```search_characters\s*\n([\s\S]*?)```/g,
  ];
  // For now, tool calls are handled through the LLM's natural response
  return calls;
}

async function executeToolCall(
  name: string,
  args: string
): Promise<string> {
  switch (name) {
    case "read_file": {
      const res = await fetch(
        `/api/files/read?path=${encodeURIComponent(args.trim())}`
      );
      const data = await res.json();
      return data.content || data.error || "File not found";
    }
    case "search_characters": {
      const res = await fetch(
        `/api/files/search?q=${encodeURIComponent(args.trim())}`
      );
      const data = await res.json();
      return (data.results || [])
        .map((r: { displayName?: string; name: string }) => r.displayName || r.name)
        .join(", ");
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
