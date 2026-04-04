import { useState, useEffect, type ComponentType } from "react";
import type { EditorProps } from "@monaco-editor/react";

interface CodeEditorProps {
  onKeyDown: (key: string) => void;
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
          defaultValue="// Start coding..."
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
    </div>
  );
}
