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
    <div className="h-[400px] flex items-center justify-center bg-[#0f0f0f] text-muted-foreground text-sm border-b border-border">
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

      // Provide helpful message for common DOM manipulation attempts
      if (
        message.includes("innerHTML") ||
        message.includes("getElementById") ||
        message.includes("Cannot read properties of null") ||
        message.includes("Cannot set property")
      ) {
        lines.push({
          type: "error",
          text: 'Code runs in a sandboxed environment without DOM access. Use console.log() to output results instead of direct DOM manipulation.',
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
    <section className="glass-card overflow-hidden fade-in">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-[#101010]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/60" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/45" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/35" />
          </div>
          <span className="text-[11px] text-muted-foreground ml-1 font-mono">mindpulse.js</span>
        </div>
        <button
          type="button"
          onClick={runCode}
          className="px-2.5 py-1 rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors duration-150"
        >
          Run
        </button>
      </div>
      {mounted && MonacoEditor ? (
        <MonacoEditor
          height="min(56vh, 400px)"
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
            padding: { top: 14 },
            lineNumbers: "on",
            renderLineHighlight: "line",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
          }}
        />
      ) : (
        <EditorFallback />
      )}
      <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-3 border-t border-border bg-[#0f0f0f]">
        <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2">Output</p>
        <div className="rounded-md border border-border bg-[#0a0a0a] p-3 min-h-[96px] sm:min-h-[120px] font-mono text-sm overflow-auto">
          {output.length === 0 ? (
            <p className="text-muted-foreground">Output will appear here...</p>
          ) : (
            output.map((line, index) => (
              <pre
                key={`${line.type}-${index}`}
                className={`whitespace-pre-wrap break-words ${line.type === "error" ? "text-red-400" : "text-foreground"}`}
              >
                {line.text}
              </pre>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
