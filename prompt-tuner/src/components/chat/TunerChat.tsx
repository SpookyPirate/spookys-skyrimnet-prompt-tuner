"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useConfigStore } from "@/stores/configStore";
import { useFileStore } from "@/stores/fileStore";
import { sendLlmRequest } from "@/lib/llm/client";
import { TUNER_SYSTEM_PROMPT } from "@/lib/tuner/system-prompt";
import { EditorPanel } from "@/components/editor/EditorPanel";
import type { ChatMessage } from "@/types/llm";
import {
  Send,
  Loader2,
  Trash2,
  Square,
  Bot,
  User,
  FileText,
  X,
  GripVertical,
} from "lucide-react";

interface ToolCall {
  name: string;
  args: Record<string, string>;
  result?: string;
}

interface TunerMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
}

function buildFileContext(openFiles: { name: string; displayName: string; content: string; path: string }[]): string {
  if (openFiles.length === 0) return "";
  const blocks = openFiles.map(
    (f) => `--- File: ${f.displayName || f.name} ---\nPath: ${f.path}\n${f.content}`
  );
  return `\n\nThe following files are currently open in the editor. Use them as context when answering:\n\n${blocks.join("\n\n")}`;
}

function stripToolCallXml(text: string): string {
  return text.replace(/<function_calls>[\s\S]*?<\/function_calls>/g, "").trim();
}

export function TunerChat() {
  const [messages, setMessages] = useState<TunerMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [chatWidth, setChatWidth] = useState(340);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startWidth: chatWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      setChatWidth(Math.max(260, Math.min(600, dragRef.current.startWidth + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [chatWidth]);
  const globalApiKey = useConfigStore((s) => s.globalApiKey);

  const openFiles = useFileStore((s) => s.openFiles);
  const closeFile = useFileStore((s) => s.closeFile);
  const hasOpenFiles = openFiles.length > 0;

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
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
      const fileContext = buildFileContext(openFiles);
      const systemContent = TUNER_SYSTEM_PROMPT + fileContext;

      const llmMessages: ChatMessage[] = [
        { role: "system", content: systemContent },
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
          { id: `${Date.now()}-error`, role: "system", content: `Error: ${log.error}` },
        ]);
      } else {
        const toolCalls = parseToolCalls(response);
        const displayContent = toolCalls.length > 0 ? stripToolCallXml(response) : response;
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            role: "assistant",
            content: displayContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          },
        ]);

        if (toolCalls.length > 0) {
          for (const call of toolCalls) {
            try {
              call.result = await executeToolCall(call.name, call.args, openFiles);
            } catch (e) {
              call.result = `Error: ${(e as Error).message}`;
            }
          }
          setMessages((prev) => [...prev]);
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-error`, role: "system", content: `Error: ${(error as Error).message}` },
        ]);
      }
    } finally {
      setIsProcessing(false);
      abortRef.current = null;
    }
  }, [input, isProcessing, messages, openFiles]);

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

  const chatPanel = (
    <div className="flex flex-col h-full w-full min-w-0">
        {/* Open files context bar */}
        {hasOpenFiles && (
          <div className="border-b px-2 py-1 flex items-center gap-1 flex-wrap bg-muted/30">
            <span className="text-[10px] text-muted-foreground shrink-0">Context:</span>
            {openFiles.map((f) => (
              <div
                key={f.path}
                className="flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary max-w-[160px]"
              >
                <FileText className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{f.displayName || f.name}</span>
                <button
                  onClick={() => closeFile(f.path)}
                  className="ml-0.5 shrink-0 opacity-50 hover:opacity-100"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
          <div className="p-3 space-y-3">
            {messages.length === 0 && !streamingText && (
              <div className="text-center text-xs text-muted-foreground py-8 space-y-2">
                <Bot className="h-8 w-8 mx-auto opacity-20" />
                <p>SkyrimNet Tuner Agent</p>
                <p className="text-[10px] max-w-xs mx-auto">
                  {hasApiKey
                    ? "Ask me to enhance speech styles, create character bios, explain prompt architecture, or suggest improvements. Open files from the explorer to give me context."
                    : "Configure an API key in Settings to start."}
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <TunerBubble key={msg.id} message={msg} />
            ))}

            {streamingText && (
              <TunerBubble
                message={{ id: "streaming", role: "assistant", content: streamingText }}
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
              placeholder={hasApiKey ? "Ask the tuner agent..." : "Set API key in Settings first"}
              disabled={!hasApiKey || isProcessing}
              className="h-8 text-xs"
            />
            {isProcessing ? (
              <Button variant="destructive" size="icon" className="h-8 w-8 shrink-0" onClick={handleStop}>
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

  if (!hasOpenFiles) {
    return <div className="flex h-full min-w-0 overflow-hidden">{chatPanel}</div>;
  }

  return (
    <div className="flex h-full min-w-0 overflow-hidden">
      {/* Editor fills remaining space */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <EditorPanel />
      </div>

      {/* Drag handle — matches ResizableHandle style */}
      <div
        onMouseDown={handleDragStart}
        className="relative flex w-px shrink-0 cursor-col-resize items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2"
      >
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-sm border">
          <GripVertical className="size-2.5" />
        </div>
      </div>

      {/* Chat panel — fixed width, resizable via drag */}
      <div style={{ width: chatWidth }} className="shrink-0 flex flex-col min-w-0 overflow-hidden border-l">
        {chatPanel}
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
                <div className="flex items-center gap-1 flex-wrap">
                  <FileText className="h-3 w-3 shrink-0" />
                  <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                    {call.name}
                  </Badge>
                  {Object.entries(call.args)
                    .filter(([k]) => k !== "content")
                    .map(([k, v]) => (
                      <span key={k} className="font-mono text-muted-foreground truncate">
                        {k}={v.length > 60 ? v.substring(0, 60) + "…" : v}
                      </span>
                    ))}
                </div>
                {call.result && (
                  <pre className="mt-1 max-h-20 overflow-auto text-[9px] text-muted-foreground whitespace-pre-wrap">
                    {call.result.substring(0, 400)}
                    {call.result.length > 400 ? "..." : ""}
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

function parseToolCalls(response: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
  let match;
  while ((match = invokeRegex.exec(response)) !== null) {
    const name = match[1];
    const body = match[2];
    const args: Record<string, string> = {};
    const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(body)) !== null) {
      args[paramMatch[1]] = paramMatch[2];
    }
    calls.push({ name, args });
  }
  return calls;
}

async function executeToolCall(
  name: string,
  args: Record<string, string>,
  openFiles: { path: string }[]
): Promise<string> {
  switch (name) {
    case "read_file": {
      const filePath = args.path || args.file_path || "";
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath.trim())}`);
      const data = await res.json();
      return data.content ?? data.error ?? "File not found";
    }
    case "write_file": {
      const filePath = (args.path || args.file_path || "").trim();
      const content = args.content ?? "";
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, content }),
      });
      const data = await res.json();
      if (!res.ok) return `Error: ${data.error}`;
      // Sync back to open editor tab if this file is open
      const store = useFileStore.getState();
      if (openFiles.some((f) => f.path === filePath)) {
        store.updateFileContent(filePath, content);
        store.markFileSaved(filePath);
      }
      store.refreshTree();
      return "File written successfully";
    }
    case "edit_file": {
      const filePath = (args.path || args.file_path || "").trim();
      const oldStr = args.old_str ?? "";
      const newStr = args.new_str ?? "";
      // Read current content
      const readRes = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
      const readData = await readRes.json();
      if (!readRes.ok) return `Error reading file: ${readData.error}`;
      const currentContent: string = readData.content;
      if (!currentContent.includes(oldStr)) {
        return `Error: Search string not found in file. Make sure to match the text exactly.`;
      }
      const newContent = currentContent.replace(oldStr, newStr);
      const writeRes = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, content: newContent }),
      });
      const writeData = await writeRes.json();
      if (!writeRes.ok) return `Error: ${writeData.error}`;
      const store = useFileStore.getState();
      if (openFiles.some((f) => f.path === filePath)) {
        store.updateFileContent(filePath, newContent);
        store.markFileSaved(filePath);
      }
      store.refreshTree();
      return "Edit applied successfully";
    }
    case "search_characters": {
      const query = args.query || args.name || Object.values(args)[0] || "";
      const res = await fetch(`/api/files/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      return (data.results || [])
        .map((r: { displayName?: string; name: string; path?: string }) =>
          `${r.displayName || r.name}: ${r.path || ""}`
        )
        .join("\n");
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
