import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';

// Expose pyodide globally
declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<any>;
    pyodide: any;
  }
}

interface PythonEditorProps {
  value?: string;
  initialCode?: string;
  onChange?: (code: string) => void;
  onRunSuccess?: () => void;
  height?: string;
  hideHeader?: boolean;
  hideTerminal?: boolean;
}

export const PythonEditor: React.FC<PythonEditorProps> = ({ 
  value,
  initialCode = "print('Hello from CynexAI!')",
  onChange,
  onRunSuccess,
  height = "340px",
  hideHeader = false,
  hideTerminal = false,
}) => {
  const [code, setCode] = useState(value ?? initialCode);
  const [output, setOutput] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Sync state when controlled value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setCode(value);
    }
  }, [value]);

  // Initialize Pyodide on mount
  useEffect(() => {
    const initPyodide = async () => {
      try {
        if (!window.loadPyodide) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
          script.async = true;
          document.body.appendChild(script);
          await new Promise((resolve) => (script.onload = resolve));
        }

        if (!window.pyodide) {
          window.pyodide = await window.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
          });
          await window.pyodide.loadPackage('micropip');
        }
        setIsReady(true);
      } catch (err) {
        console.error("Failed to load Pyodide:", err);
        setOutput("Error: Failed to initialize Python environment.");
      } finally {
        setIsInitializing(false);
      }
    };
    initPyodide();
  }, []);

  const handleRunCode = async () => {
    if (!window.pyodide) return;
    setIsRunning(true);
    setOutput("Running...\n");
    
    let stdoutBuffer = "";
    let stderrBuffer = "";

    window.pyodide.setStdout({ batched: (msg: string) => stdoutBuffer += msg + "\n" });
    window.pyodide.setStderr({ batched: (msg: string) => stderrBuffer += msg + "\n" });

    try {
      const imports = [];
      if (code.includes('import numpy') || code.includes('from numpy')) imports.push('numpy');
      if (code.includes('import pandas') || code.includes('from pandas')) imports.push('pandas');
      if (code.includes('import matplotlib') || code.includes('from matplotlib')) imports.push('matplotlib');
      if (code.includes('import sklearn') || code.includes('from sklearn')) imports.push('scikit-learn');

      if (imports.length > 0) {
        setOutput((prev) => prev + `Installing dependencies: ${imports.join(', ')}...\n`);
        const micropip = window.pyodide.pyimport('micropip');
        for (const pkg of imports) {
          await micropip.install(pkg);
        }
      }

      await window.pyodide.runPythonAsync(code);
      setOutput((prev) => prev + stdoutBuffer + (stderrBuffer ? `\nErrors:\n${stderrBuffer}` : ''));
      
      if (!stderrBuffer) {
        onRunSuccess?.();
      }
    } catch (err: any) {
      setOutput((prev) => prev + stdoutBuffer + `\nException:\n${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCodeChange = (val: string | undefined) => {
    if (val !== undefined) {
      setCode(val);
      onChange?.(val);
    }
  };

  return (
    <div className={`flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-950 w-full ${hideHeader && hideTerminal ? '' : 'h-[500px]'}`}>
      {/* Optional Toolbar */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs font-bold text-slate-400 ml-2 font-mono">main.py</span>
          </div>
          <div className="flex items-center gap-2">
            {isInitializing && (
              <span className="text-xs font-bold text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded">
                <Loader2 className="w-3 h-3 animate-spin" /> Initializing Python...
              </span>
            )}
            <Button 
              variant="primary" 
              onClick={handleRunCode} 
              disabled={!isReady || isRunning}
              className="h-8 text-xs flex items-center gap-2 px-4 bg-emerald-600 hover:bg-emerald-500 border-none text-white font-bold"
            >
              {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-white" />}
              {isRunning ? 'Running' : 'Run Code'}
            </Button>
          </div>
        </div>
      )}

      {/* Editor Container */}
      <div className="w-full relative" style={{ height: hideHeader && hideTerminal ? height : 'calc(100% - 160px)' }}>
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={handleCodeChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'JetBrains Mono, monospace',
            padding: { top: 12, bottom: 12 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            automaticLayout: true
          }}
        />
      </div>

      {/* Optional Terminal Output */}
      {!hideTerminal && (
        <div className="h-[160px] border-t border-slate-800 bg-[#1e1e1e] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">Terminal Output</span>
            <button onClick={() => setOutput('')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-sm">
            {output ? (
              <pre className="text-emerald-400 whitespace-pre-wrap">{output}</pre>
            ) : (
              <span className="text-slate-600 italic text-xs">Click 'Run Code' to execute your solution.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
