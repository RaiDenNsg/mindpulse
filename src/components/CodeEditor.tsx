import { useState, useEffect, type ComponentType } from "react";
import type { EditorProps } from "@monaco-editor/react";

interface CodeEditorProps {
  onKeyDown: (key: string) => void;
}

interface OutputLine {
  type: "log" | "error";
  text: string;
}

function EditorFallback() {
  return (
    <div className="h-[400px] flex items-center justify-center bg-[oklch(0.14_0.01_260)] text-muted-foreground text-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading editor...</span>
      </div>
    </div>
  );
}

export default function CodeEditor({ onKeyDown }: CodeEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [MonacoEditor, setMonacoEditor] = useState<ComponentType<EditorProps> | null>(null);
  const [code, setCode] = useState("// Start coding...");
  const [output, setOutput] = useState<OutputLine[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let active = true;

    import("@monaco-editor/react").then((mod) => {
      if (active) {
        setMonacoEditor(() => mod.default);
      }
    });

    return () => {
      active = false;
    };
  }, [mounted]);

  const formatOutputValue = (value: unknown) => {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const runCode = () => {
    const lines: OutputLine[] = [];
    const capturedConsole = {
      log: (...args: unknown[]) => {
        lines.push({
          type: "log",
          text: args.map(formatOutputValue).join(" "),
        });
      },
    };

    try {
      const runner = new Function("console", `"use strict";\n${code}`);
      const result = runner(capturedConsole);

      if (typeof result !== "undefined") {
        lines.push({
          type: "log",
          text: formatOutputValue(result),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lines.push({
        type: "error",
        text: message,
      });

      if (message.includes("innerHTML") || message.includes("getElementById")) {
        lines.push({
          type: "error",
          text: "Output panel is React-state based. Use console.log(...) instead of direct DOM manipulation.",
        });
      }
    }

    if (lines.length === 0) {
      lines.push({
        type: "log",
        text: "(no output)",
      });
    }

    setOutput(lines);
  };

  return (
    <div className="glass-card overflow-hidden fade-in">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-struggle-red/80" />
          <span className="w-3 h-3 rounded-full bg-neutral-yellow/80" />
          <span className="w-3 h-3 rounded-full bg-focus-green/80" />
        </div>
        <span className="text-xs text-muted-foreground ml-2 font-mono">mindpulse.js</span>
      </div>
      {mounted && MonacoEditor ? (
        <MonacoEditor
          height="400px"
          defaultLanguage="javascript"
          value={code}
          onChange={(value) => {
            setCode(value ?? "");
          }}
          theme="vs-dark"
          onMount={(editor) => {
            editor.onKeyDown((e) => {
              onKeyDown(e.browserEvent.key);
            });
            editor.focus();
          }}
          loading={<EditorFallback />}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 16 },
            lineNumbers: "on",
            renderLineHighlight: "gutter",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
          }}
        />
      ) : (
        <EditorFallback />
      )}
      <div className="px-4 pb-4 pt-3 border-t border-border space-y-3">
        <button
          type="button"
          onClick={runCode}
          className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Run Code
        </button>
        <div className="rounded-md border border-border bg-black/90 p-3 min-h-[120px] font-mono text-sm overflow-auto">
          {output.length === 0 ? (
            <p className="text-emerald-400/70">Output will appear here...</p>
          ) : (
            output.map((line, index) => (
              <pre
                key={`${line.type}-${index}`}
                className={`whitespace-pre-wrap break-words ${line.type === "error" ? "text-red-400" : "text-emerald-400"}`}
              >
                {line.text}
              </pre>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
