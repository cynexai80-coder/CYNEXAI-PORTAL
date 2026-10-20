import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pencil, Eraser, Loader2, MousePointer2 } from 'lucide-react';
import { Button } from '../../components/ui/erp/Button';
import { executeCode, Language } from '../../lib/compiler';

type DrawTool = 'pen' | 'eraser';

export const CodeWorkspace: React.FC = () => {
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [code, setCode] = useState('# Code Editor\n\ndef demo():\n    print("Hello from CynexAI Studio!")\ndemo()');
  const [language, setLanguage] = useState<Language>('python');
  const [output, setOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [drawSize, setDrawSize] = useState(3);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const runCode = async () => {
    setIsExecuting(true);
    setOutput('Running code...');
    const result = await executeCode(code, language);
    setOutput(result);
    localStorage.setItem('cynexai_live_output', result);
    setIsExecuting(false);
  };

  useEffect(() => {
    localStorage.setItem('cynexai_live_code', code);
    localStorage.setItem('cynexai_live_lang', language);
  }, [code, language]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawMode) return;
    const pt = getCanvasPoint(e);
    lastPoint.current = pt;
    setIsDrawing(true);
  };

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawMode) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current!.x, lastPoint.current!.y);
    ctx.lineTo(pt.x, pt.y);
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = drawSize * 6;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = drawSize;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    lastPoint.current = pt;
  }, [isDrawing, drawTool, drawColor, drawSize, isDrawMode]);

  const stopDrawing = () => setIsDrawing(false);
  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.setItem('cynexai_live_clear_canvas', Date.now().toString());
  };

  return (
    <div className="absolute inset-0 bg-[#0a0a0f] flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-white/5">
        <div className="flex gap-1 bg-black/30 rounded-lg p-1">
          <button
            onClick={() => setIsDrawMode(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${!isDrawMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <MousePointer2 className="w-3.5 h-3.5" /> Type Code
          </button>
          <button
            onClick={() => setIsDrawMode(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${isDrawMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Pencil className="w-3.5 h-3.5" /> Draw / Whiteboard
          </button>
        </div>
        
        {isDrawMode && (
          <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-lg">
            <button onClick={() => setDrawTool('pen')} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${drawTool === 'pen' ? 'bg-indigo-600' : 'bg-white/5 hover:bg-white/10'}`}><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => setDrawTool('eraser')} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${drawTool === 'eraser' ? 'bg-indigo-600' : 'bg-white/5 hover:bg-white/10'}`}><Eraser className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            {['#ef4444', '#22c55e', '#3b82f6', '#facc15', '#ffffff'].map(c => (
              <button key={c} onClick={() => { setDrawColor(c); setDrawTool('pen'); }} className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110" style={{ backgroundColor: c, borderColor: drawColor === c ? 'white' : 'transparent' }} />
            ))}
            <input type="range" min={1} max={12} value={drawSize} onChange={e => setDrawSize(+e.target.value)} className="w-16 accent-indigo-500 ml-2" />
            <button onClick={clearCanvas} className="text-xs font-bold text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors ml-2">Clear</button>
          </div>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden bg-[#0a0a0f]">
        {/* Code Editor Layer */}
        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          className="absolute inset-0 w-full h-full bg-transparent text-emerald-400 font-mono p-6 text-sm resize-none outline-none custom-scrollbar"
          spellCheck={false}
          placeholder="// Write code here — students see this in real-time"
          style={{ zIndex: isDrawMode ? 0 : 20 }}
        />
        
        {/* Drawing Layer */}
        <canvas
          ref={canvasRef}
          width={2560}
          height={1440}
          className="absolute inset-0 w-full h-full"
          style={{ 
            touchAction: 'none', 
            cursor: isDrawMode ? (drawTool === 'eraser' ? 'cell' : 'crosshair') : 'default',
            zIndex: 10,
            pointerEvents: isDrawMode ? 'auto' : 'none'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>

      <div className="shrink-0 h-40 bg-[#0d0d14] relative z-20 flex flex-col border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#11111a]">
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as Language)}
            className="bg-black/50 text-slate-300 text-xs font-bold px-3 py-1.5 rounded outline-none border border-white/10"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
          </select>
          <Button
            onClick={runCode}
            disabled={isExecuting}
            className="h-8 px-4 text-xs font-bold bg-green-700 hover:bg-green-800 text-white"
          >
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Play className="w-3.5 h-3.5 mr-2" />}
            {isExecuting ? 'Running...' : 'Run Code'}
          </Button>
        </div>
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto">
          {output ? (
            <pre className="text-slate-300 whitespace-pre-wrap">{output}</pre>
          ) : (
            <span className="text-slate-600 italic">Terminal output will appear here...</span>
          )}
        </div>
      </div>
    </div>
  );
};
