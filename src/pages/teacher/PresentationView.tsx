import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getClassForPresentation } from '../../lib/api/teacher';
import ReactMarkdown from 'react-markdown';
import { BookOpen, Code, ArrowLeft, ArrowRight, Pencil, Eraser, Loader2, MousePointer2, PlayCircle, Cast, MonitorPlay, Upload, FileCode2, Trash2, Undo2, Redo2, Minus, Square, Circle as CircleIcon, ArrowRight as ArrowIcon, Diamond, Database, FilePlus, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { executeCode, Language, UploadedFile } from '../../lib/compiler';
import Editor from '@monaco-editor/react';

type DrawTool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle' | 'arrow' | 'diamond' | 'cylinder';
type Theme = 'retro' | 'modern-dark' | 'glassmorphism' | 'minimalist';

export default function PresentationView() {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('classId');

  const [slides, setSlides] = useState<string[]>([]);
  const [slide, setSlide] = useState(1);
  const [mode, setMode] = useState<'slides' | 'code'>('slides');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>('modern-dark');

  // Slide scaling
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [slideScale, setSlideScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      const c = slideContainerRef.current;
      if (!c) return;
      setSlideScale(Math.min(c.clientWidth / 1600, c.clientHeight / 900) * 0.95);
    };
    updateScale();
    const t = setTimeout(updateScale, 100);
    const obs = new ResizeObserver(updateScale);
    if (slideContainerRef.current) obs.observe(slideContainerRef.current);
    window.addEventListener('resize', updateScale);
    return () => { clearTimeout(t); obs.disconnect(); window.removeEventListener('resize', updateScale); };
  }, [mode]);

  // Editor State
  const [code, setCode] = useState('# Live Code Editor\n\ndef solution():\n    pass\n\nprint("Hello from CynexAI!")');
  const [language, setLanguage] = useState<Language>('python');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  
  // Draw vs Type
  const [isDrawMode, setIsDrawMode] = useState(false);

  // Screen Cast
  const [isCasting, setIsCasting] = useState(false);
  const castStreamRef = useRef<MediaStream | null>(null);
  const handleCast = async () => {
    if (isCasting) {
      castStreamRef.current?.getTracks().forEach(t => t.stop());
      castStreamRef.current = null;
      setIsCasting(false);
      return;
    }
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      castStreamRef.current = stream;
      setIsCasting(true);
      stream.getVideoTracks()[0].onended = () => { setIsCasting(false); castStreamRef.current = null; };
    } catch (e) {
      // user cancelled
    }
  };

// Drawing State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [drawSize, setDrawSize] = useState(4);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  
  // History for Undo/Redo & Live Preview
  const historyRef = useRef<ImageData[]>([]);
  const historyStepRef = useRef<number>(-1);
  const snapshotBeforeDrawRef = useRef<ImageData | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (classId) fetchSlides();
  }, [classId]);

  // Sync to/from parent window (teacher dashboard / localStorage)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cynexai_live_slide' && e.newValue) setSlide(parseInt(e.newValue, 10));
      if (e.key === 'cynexai_live_mode' && e.newValue) setMode(e.newValue as 'slides' | 'code');
      if (e.key === 'cynexai_live_theme' && e.newValue) setTheme(e.newValue as Theme);
      if (e.key === 'cynexai_live_clear_canvas') clearCanvas(false);
    };
    window.addEventListener('storage', handleStorage);

    const savedClassId = localStorage.getItem('cynexai_live_classId');
    if (classId && savedClassId !== classId) {
      setSlide(1);
      localStorage.setItem('cynexai_live_slide', '1');
      localStorage.setItem('cynexai_live_classId', classId);
    } else {
      const s = localStorage.getItem('cynexai_live_slide');
      if (s) setSlide(parseInt(s, 10));
    }
    
    const m = localStorage.getItem('cynexai_live_mode');
    if (m) setMode(m as 'slides' | 'code');
    const t = localStorage.getItem('cynexai_live_theme');
    if (t) setTheme(t as Theme);
    const l = localStorage.getItem('cynexai_live_lang');
    if (l) setLanguage(l as Language);
    const c = localStorage.getItem('cynexai_live_code');
    if (c) setCode(c);
    const o = localStorage.getItem('cynexai_live_output');
    if (o) setOutput(o);
    
    const af = localStorage.getItem('cynexai_live_active_file');
    if (af) setActiveFile(af === 'null' ? null : af);
    const fs = localStorage.getItem('cynexai_live_files');
    if (fs) {
      try { setFiles(JSON.parse(fs)); } catch (e) {}
    }

    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateFiles = (newFiles: UploadedFile[]) => {
    setFiles(newFiles);
    try {
      localStorage.setItem('cynexai_live_files', JSON.stringify(newFiles));
    } catch (e) {
      // Ignore quota exceeded
    }
  };

  const updateActiveFile = (f: string | null) => {
    setActiveFile(f);
    localStorage.setItem('cynexai_live_active_file', f === null ? 'null' : f);
  };

  // --- DRAWING LOGIC ---

  const saveHistoryState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Discard any redo states
    if (historyStepRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyStepRef.current + 1);
    }
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(imgData);
    if (historyRef.current.length > 20) historyRef.current.shift(); // Max 20 steps
    historyStepRef.current = historyRef.current.length - 1;
    
    setCanUndo(true);
    setCanRedo(false);
  };

  const undoDraw = () => {
    if (historyStepRef.current <= 0) {
      // Clear if undoing first stroke
      if (historyStepRef.current === 0) {
        historyStepRef.current = -1;
        clearCanvas(false);
        setCanUndo(false);
        setCanRedo(true);
      }
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    historyStepRef.current -= 1;
    ctx.putImageData(historyRef.current[historyStepRef.current], 0, 0);
    setCanUndo(historyStepRef.current >= 0);
    setCanRedo(true);
  };

  const redoDraw = () => {
    if (historyStepRef.current >= historyRef.current.length - 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    historyStepRef.current += 1;
    ctx.putImageData(historyRef.current[historyStepRef.current], 0, 0);
    setCanUndo(true);
    setCanRedo(historyStepRef.current < historyRef.current.length - 1);
  };

  const fetchSlides = async () => {
    if (!classId) { setLoading(false); return; }
    
    try {
      const cls = await getClassForPresentation(classId);
      if (cls && cls.ai_ppt_markdown) {
        setSlides(cls.ai_ppt_markdown.split('---').map((s: string) => s.trim()).filter(Boolean));
      } else {
        setSlides(['# No Slides Found\n\nPlease generate slides from the Course CMS.']);
      }
    } catch (e) {
      console.error(e);
      setSlides(['# Error Loading Slides\n\nPlease try again.']);
    } finally {
      setLoading(false);
    }
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawMode || !canvasRef.current) return;
    const pt = getCanvasPoint(e);
    startPoint.current = pt;
    lastPoint.current = pt;
    setIsDrawing(true);
    
    // Save history BEFORE stroke
    saveHistoryState();
    
    // Save snapshot for live preview
    snapshotBeforeDrawRef.current = canvasRef.current.getContext('2d')!.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const drawShape = (ctx: CanvasRenderingContext2D, tool: DrawTool, start: {x: number, y: number}, end: {x: number, y: number}) => {
    ctx.beginPath();
    const w = end.x - start.x;
    const h = end.y - start.y;
    
    if (tool === 'line') {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    } else if (tool === 'rect') {
      ctx.rect(start.x, start.y, w, h);
    } else if (tool === 'circle') {
      const r = Math.hypot(w, h);
      ctx.arc(start.x, start.y, r, 0, 2 * Math.PI);
    } else if (tool === 'arrow') {
      const angle = Math.atan2(h, w);
      const headlen = 40 + ctx.lineWidth;
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
    } else if (tool === 'diamond') {
      ctx.moveTo(start.x + w/2, start.y);
      ctx.lineTo(end.x, start.y + h/2);
      ctx.lineTo(start.x + w/2, end.y);
      ctx.lineTo(start.x, start.y + h/2);
      ctx.closePath();
    } else if (tool === 'cylinder') {
      const rx = w / 2;
      const ry = h * 0.15; // ellipse height ratio
      ctx.ellipse(start.x + rx, start.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
      ctx.moveTo(start.x, start.y + ry);
      ctx.lineTo(start.x, end.y - ry);
      ctx.moveTo(end.x, start.y + ry);
      ctx.lineTo(end.x, end.y - ry);
      ctx.ellipse(start.x + rx, end.y - ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI, false);
    }
    
    ctx.stroke();
  };

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !isDrawMode || !startPoint.current || !lastPoint.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    const pt = getCanvasPoint(e);
    
    ctx.lineWidth = drawSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (drawTool === 'pen' || drawTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(pt.x, pt.y);
      if (drawTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = drawSize * 8;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = drawColor;
      }
      ctx.stroke();
      lastPoint.current = pt;
    } else {
      // Shapes - live preview
      if (snapshotBeforeDrawRef.current) {
        ctx.putImageData(snapshotBeforeDrawRef.current, 0, 0);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawColor;
      drawShape(ctx, drawTool, startPoint.current, pt);
    }
    
    ctx.globalCompositeOperation = 'source-over';
  }, [isDrawing, drawTool, drawColor, drawSize, isDrawMode]);

  const clearCanvas = (triggerSync = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    if (triggerSync) {
      saveHistoryState();
      localStorage.setItem('cynexai_live_clear_canvas', Date.now().toString());
    }
  };

  const changeSlide = (n: number) => {
    const next = Math.max(1, Math.min(n, slides.length));
    setSlide(next);
    localStorage.setItem('cynexai_live_slide', next.toString());
  };

  const updateMode = (m: 'slides' | 'code') => {
    setMode(m);
    localStorage.setItem('cynexai_live_mode', m);
  };

  const handleEditorChange = (v: string | undefined) => {
    const val = v || '';
    if (activeFile === null) {
      setCode(val);
      localStorage.setItem('cynexai_live_code', val);
    } else {
      const newFiles = files.map(f => f.name === activeFile ? { ...f, content: val } : f);
      updateFiles(newFiles);
    }
  };

  const getEditorLanguage = () => {
    if (activeFile === null) return language === 'sqlite3' ? 'sql' : language;
    if (activeFile.endsWith('.py')) return 'python';
    if (activeFile.endsWith('.js')) return 'javascript';
    if (activeFile.endsWith('.ts')) return 'typescript';
    if (activeFile.endsWith('.json')) return 'json';
    if (activeFile.endsWith('.html')) return 'html';
    if (activeFile.endsWith('.css')) return 'css';
    if (activeFile.endsWith('.java')) return 'java';
    if (activeFile.endsWith('.sql')) return 'sql';
    if (activeFile.endsWith('.csv')) return 'csv';
    return 'plaintext';
  };

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as Language;
    setLanguage(newLang);
    localStorage.setItem('cynexai_live_lang', newLang);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filePromises = Array.from(e.target.files).map(file => {
      return new Promise<UploadedFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve({ name: file.name, content: ev.target?.result as string });
        reader.readAsText(file);
      });
    });
    
    Promise.all(filePromises).then(newUploadedFiles => {
      let currentFiles = [...files];
      newUploadedFiles.forEach(nf => {
        if (!currentFiles.find(f => f.name === nf.name)) currentFiles.push(nf);
      });
      updateFiles(currentFiles);
    });
    
    e.target.value = '';
  };

  const createNewFile = () => {
    const name = prompt('Enter new file name (e.g. utils.py):');
    if (!name) return;
    if (files.some(f => f.name === name)) {
      alert('File already exists');
      return;
    }
    const newFiles = [...files, { name, content: '' }];
    updateFiles(newFiles);
    updateActiveFile(name);
  };

  const removeFile = (name: string) => {
    const newFiles = files.filter(f => f.name !== name);
    if (activeFile === name) updateActiveFile(null);
    updateFiles(newFiles);
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('Running...');
    localStorage.setItem('cynexai_live_output', 'Running...');
    
    try {
      const result = await executeCode(code, language, files);
      setOutput(result);
      localStorage.setItem('cynexai_live_output', result);
    } catch (e: any) {
      setOutput(e.message || 'Error executing code');
      localStorage.setItem('cynexai_live_output', e.message || 'Error');
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white gap-2">
      <Loader2 className="w-6 h-6 animate-spin text-blue-400" /> Loading presentation...
    </div>
  );

  const currentSlide = slides[slide - 1] || '# Slide not found';

  // --- THEME RENDERERS ---

  const renderModernDarkTheme = () => {
    const imgRegex = /!\[.*?\]\((.*?)\)/;
    const match = currentSlide.match(imgRegex);
    const imgSrc = match ? encodeURI(match[1]) : null;
    const textContent = currentSlide.replace(imgRegex, '');

    return (
      <motion.div
        key={`modern-dark-${slide}`}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex overflow-hidden relative w-[1600px] h-[900px] absolute top-0 left-0"
      >
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] -mr-[400px] -mt-[400px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[100px] -ml-[300px] -mb-[300px] pointer-events-none" />
        
        <div className={`flex-1 px-16 md:px-20 py-16 flex flex-col justify-center items-start text-left relative z-10 overflow-y-auto ${imgSrc ? 'w-[55%]' : 'w-full'}`}>
          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 className="text-5xl md:text-6xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-8 leading-tight" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6" {...props} />,
              p: ({node, ...props}) => <p className="text-xl md:text-2xl text-slate-300 leading-relaxed mb-6" {...props} />,
              ul: ({node, ...props}) => <ul className="space-y-4 mb-6 w-full" {...props} />,
              li: ({node, ...props}) => (
                <li className="flex items-start text-xl md:text-2xl text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-2.5 mr-4 flex-shrink-0" />
                  <span {...props} />
                </li>
              ),
              img: () => null
            }}
          >{textContent}</ReactMarkdown>
        </div>

        {imgSrc && (
          <div className="w-[45%] h-full relative z-0 flex-shrink-0">
            <img src={imgSrc} className="absolute inset-0 w-full h-full object-cover" alt="Slide visual" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/50 to-transparent w-48 left-0" />
            <div className="absolute inset-0 bg-blue-500/20 mix-blend-overlay" />
          </div>
        )}
      </motion.div>
    );
  };

  const renderGlassmorphismTheme = () => {
    const imgRegex = /!\[.*?\]\((.*?)\)/;
    const match = currentSlide.match(imgRegex);
    const imgSrc = match ? encodeURI(match[1]) : null;
    const textContent = currentSlide.replace(imgRegex, '');

    return (
      <motion.div
        key={`glass-${slide}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-[1600px] h-[900px] absolute top-0 left-0 relative flex items-center justify-center p-12 overflow-hidden rounded-[40px]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600 opacity-80" />
        {imgSrc && <img src={imgSrc} className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" alt="Glass bg" />}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-4000" />
        
        <div className="relative w-full h-full bg-slate-900/80 dark:bg-black/40 backdrop-blur-2xl border border-white/20 rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.2)] flex flex-col p-12 md:p-16 z-10 overflow-y-auto">
          <div className="flex-1 flex flex-col justify-center items-center text-center max-w-5xl mx-auto">
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => <h1 className="text-5xl md:text-7xl font-display font-black text-white drop-shadow-lg mb-8 leading-tight tracking-tight" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-4xl md:text-6xl font-display font-bold text-white drop-shadow-md mb-8" {...props} />,
                p: ({node, ...props}) => <p className="text-xl md:text-3xl text-white/90 leading-relaxed mb-6 font-medium" {...props} />,
                ul: ({node, ...props}) => <ul className="space-y-6 mb-6 text-left inline-block" {...props} />,
                li: ({node, ...props}) => (
                  <li className="flex items-start text-xl md:text-3xl text-white font-medium bg-white/10 dark:bg-black/20 px-6 py-4 rounded-2xl border border-white/20 backdrop-blur-sm">
                    <span className="w-3 h-3 rounded-full bg-white mt-3 mr-4 flex-shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                    <span {...props} />
                  </li>
                ),
                img: () => null
              }}
            >{textContent}</ReactMarkdown>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderRetroTheme = () => {
    const imgRegex = /!\[.*?\]\((.*?)\)/;
    const match = currentSlide.match(imgRegex);
    const imgSrc = match ? encodeURI(match[1]) : null;
    const textContent = currentSlide.replace(imgRegex, '');

    return (
      <motion.div
        key={`retro-${slide}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-[1600px] h-[900px] absolute top-0 left-0 bg-[#008080] p-12 flex items-center justify-center relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '16px 16px' }} />
        
        <div className="w-full h-full bg-[#c0c0c0] border-[6px] border-t-white border-l-white border-b-[#808080] border-r-[#808080] flex flex-col relative z-10">
          <div className="h-10 bg-[#000080] flex items-center justify-between px-3 select-none">
            <span className="text-white font-bold text-lg tracking-wider">CynexOS - Presentation.exe</span>
            <div className="flex gap-1">
              <div className="w-6 h-6 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] flex items-center justify-center font-bold text-xs pb-1 cursor-pointer hover:bg-white dark:bg-black active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white">-</div>
              <div className="w-6 h-6 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] flex items-center justify-center font-bold text-xs pb-1 cursor-pointer hover:bg-white dark:bg-black active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white">□</div>
              <div className="w-6 h-6 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] flex items-center justify-center font-bold text-xs pb-1 cursor-pointer hover:bg-white dark:bg-black active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white">x</div>
            </div>
          </div>
          
          <div className="flex-1 flex flex-row overflow-hidden">
            {imgSrc && (
              <div className="w-[35%] h-full border-r-[6px] border-r-[#808080] p-6 bg-white dark:bg-black flex items-center justify-center">
                <img src={imgSrc} className="w-full max-h-full object-cover border-[4px] border-t-[#808080] border-l-[#808080] border-b-white border-r-white shadow-[2px_2px_0px_rgba(0,0,0,1)]" alt="Retro visual" />
              </div>
            )}
            <div className={`p-10 md:p-14 overflow-y-auto ${imgSrc ? 'w-[65%]' : 'w-full'}`}>
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-5xl md:text-6xl font-black text-black mb-8 tracking-tight uppercase" style={{ textShadow: '2px 2px 0px #fff' }} {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-4xl md:text-5xl font-bold text-black mb-6 uppercase border-b-[4px] border-black pb-2 inline-block" {...props} />,
                  p: ({node, ...props}) => <p className="text-xl md:text-2xl text-black leading-relaxed mb-6 font-medium" {...props} />,
                  ul: ({node, ...props}) => <ul className="space-y-4 mb-6" {...props} />,
                  li: ({node, ...props}) => (
                    <li className="flex items-start text-xl md:text-2xl text-black font-medium">
                      <span className="text-blue-700 dark:text-white font-bold mr-3">►</span>
                      <span {...props} />
                    </li>
                  ),
                  img: () => null
                }}
              >{textContent}</ReactMarkdown>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderMinimalistTheme = () => {
    const imgRegex = /!\[.*?\]\((.*?)\)/;
    const match = currentSlide.match(imgRegex);
    const imgSrc = match ? encodeURI(match[1]) : null;
    const textContent = currentSlide.replace(imgRegex, '');

    return (
      <motion.div
        key={`minimalist-${slide}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        className="w-[1600px] h-[900px] absolute top-0 left-0 bg-[#fdfdfd] flex overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900 z-20" />
        
        <div className={`flex-1 px-16 md:px-24 py-20 flex flex-col justify-center items-start text-left relative z-10 overflow-y-auto ${imgSrc ? 'w-[55%]' : 'w-full'}`}>
          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 className="text-5xl md:text-7xl font-display font-light text-slate-900 dark:text-white mb-10 tracking-tight" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-3xl md:text-5xl font-display text-slate-800 dark:text-white mb-8 font-light" {...props} />,
              p: ({node, ...props}) => <p className="text-xl md:text-2xl text-slate-600 leading-relaxed mb-8 font-light max-w-4xl" {...props} />,
              ul: ({node, ...props}) => <ul className="space-y-6 mb-8 w-full" {...props} />,
              li: ({node, ...props}) => (
                <li className="flex items-start text-xl md:text-2xl text-slate-600 font-light border-l-2 border-slate-200 dark:border-white/10 pl-6 ml-2">
                  <span {...props} />
                </li>
              ),
              img: () => null
            }}
          >{textContent}</ReactMarkdown>
        </div>
        
        {imgSrc && (
          <div className="w-[45%] h-full relative z-0 flex-shrink-0">
            <img src={imgSrc} className="absolute inset-0 w-full h-full object-cover grayscale opacity-90" alt="Minimalist visual" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#fdfdfd] to-transparent w-32 left-0" />
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans select-none">
      {/* Minimal control bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900/80 backdrop-blur border-b border-white/5 absolute top-0 left-0 right-0 z-30">
        <div className="flex gap-2 items-center">
          <button onClick={() => updateMode('slides')} className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${mode === 'slides' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
            <BookOpen className="w-4 h-4" /> Slides
          </button>
          <button onClick={() => updateMode('code')} className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${mode === 'code' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
            <Code className="w-4 h-4" /> Code & Draw
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Cast / Screen Share */}
          <button
            onClick={handleCast}
            title={isCasting ? 'Stop casting' : 'Cast / Share this screen'}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${isCasting ? 'bg-green-600 text-white animate-pulse' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
          >
            {isCasting ? <><MonitorPlay className="w-4 h-4" /> Casting…</> : <><Cast className="w-4 h-4" /> Cast</>}
          </button>
        </div>

        {mode === 'slides' && slides.length > 0 && (
          <div className="flex items-center gap-3">
            <button onClick={() => changeSlide(slide - 1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-300 w-20 text-center font-mono">{slide} / {slides.length}</span>
            <button onClick={() => changeSlide(slide + 1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {mode === 'code' && (
          <div className="flex items-center gap-4">
            
            <div className="flex items-center gap-2 border-r border-white/10 pr-4">
              <select 
                value={language} 
                onChange={handleLangChange}
                className="bg-slate-800 text-white text-xs font-bold rounded-lg px-2 py-1.5 border border-slate-700 outline-none"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
                <option value="sqlite3">SQL</option>
              </select>
              <button 
                onClick={runCode} disabled={isRunning}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />} Run
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Undo / Redo */}
              <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
                <button onClick={undoDraw} disabled={!canUndo} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${canUndo ? 'text-slate-300 hover:text-white hover:bg-white dark:bg-black/10' : 'text-slate-600 cursor-not-allowed'}`} title="Undo">
                  <Undo2 className="w-4 h-4" />
                </button>
                <button onClick={redoDraw} disabled={!canRedo} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${canRedo ? 'text-slate-300 hover:text-white hover:bg-white dark:bg-black/10' : 'text-slate-600 cursor-not-allowed'}`} title="Redo">
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              {/* Type vs Draw toggle */}
              <button onClick={() => setIsDrawMode(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${!isDrawMode ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-white dark:bg-black/5'}`} title="Type Mode">
                <MousePointer2 className="w-4 h-4" />
              </button>
              
              <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-white/10">
                <button onClick={() => { setIsDrawMode(true); setDrawTool('pen'); }} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDrawMode && drawTool === 'pen' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Pen">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setIsDrawMode(true); setDrawTool('eraser'); }} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDrawMode && drawTool === 'eraser' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Eraser">
                  <Eraser className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setIsDrawMode(true); setDrawTool('line'); }} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDrawMode && drawTool === 'line' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Line">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setIsDrawMode(true); setDrawTool('arrow'); }} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDrawMode && drawTool === 'arrow' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Arrow">
                  <ArrowIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setIsDrawMode(true); setDrawTool('rect'); }} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDrawMode && drawTool === 'rect' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Rectangle">
                  <Square className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setIsDrawMode(true); setDrawTool('circle'); }} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDrawMode && drawTool === 'circle' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Circle">
                  <CircleIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setIsDrawMode(true); setDrawTool('diamond'); }} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDrawMode && drawTool === 'diamond' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Diamond (Decision)">
                  <Diamond className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setIsDrawMode(true); setDrawTool('cylinder'); }} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDrawMode && drawTool === 'cylinder' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Database Cylinder">
                  <Database className="w-3.5 h-3.5" />
                </button>
              </div>

              {isDrawMode && (
                <div className="flex items-center gap-1 ml-2">
                  {['#ef4444', '#22c55e', '#facc15', '#3b82f6', '#ffffff'].map(c => (
                    <button key={c} onClick={() => { setDrawColor(c); if (drawTool === 'eraser') setDrawTool('pen'); }}
                      className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110"
                      style={{ backgroundColor: c, borderColor: drawColor === c ? 'white' : 'transparent' }}
                    />
                  ))}
                  <input type="range" min={2} max={16} value={drawSize} onChange={e => setDrawSize(+e.target.value)} className="w-16 accent-blue-500 ml-2" />
                </div>
              )}
              <button onClick={() => clearCanvas()} className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 ml-2 transition-colors">Clear</button>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 relative mt-14 bg-[#0A0F1C]">
        {mode === 'slides' ? (
          <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#0B0B1A] via-[#0F172A] to-[#0A0F1C]" ref={slideContainerRef}>
            {theme !== 'minimalist' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
            )}
            
            {/* Positioning wrapper */}
            <div style={{
              position: 'absolute',
              width: '1600px',
              height: '900px',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) scale(${slideScale})`,
              transformOrigin: 'center center',
            }}>
              <AnimatePresence mode="wait">
                {theme === 'retro' && renderRetroTheme()}
                {theme === 'modern-dark' && renderModernDarkTheme()}
                {theme === 'glassmorphism' && renderGlassmorphismTheme()}
                {theme === 'minimalist' && renderMinimalistTheme()}
              </AnimatePresence>
            </div>

            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-20">
              {slides.map((_, i) => (
                <button key={i} onClick={() => changeSlide(i + 1)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${slide === i + 1 ? 'w-8 bg-blue-500' : 'w-2.5 bg-white dark:bg-black/20'}`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col lg:flex-row">
            
            {/* Left Sidebar: Files Panel */}
            <div className="w-full lg:w-64 bg-[#0a0a0f] border-r border-slate-700/50 flex flex-col z-20" style={{ pointerEvents: 'auto' }}>
              <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/50 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Files</span>
                <div className="flex items-center gap-2">
                  <button onClick={createNewFile} className="text-blue-400 hover:text-blue-300" title="New File">
                    <FilePlus className="w-4 h-4" />
                  </button>
                  <label className="cursor-pointer text-blue-400 hover:text-blue-300" title="Upload File">
                    <Upload className="w-4 h-4" />
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                
                {/* Main Script */}
                <div 
                  onClick={() => updateActiveFile(null)} 
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${activeFile === null ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-white dark:bg-black/5 text-slate-300'}`}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm truncate">main.{language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'java' ? 'java' : 'sql'}</span>
                </div>

                <div className="h-px bg-slate-700/50 my-2 mx-2" />

                {files.length === 0 ? (
                  <div className="text-center p-4 text-slate-500 text-xs mt-2">
                    Create or upload files.
                  </div>
                ) : (
                  files.map(f => (
                    <div 
                      key={f.name} 
                      onClick={() => updateActiveFile(f.name)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group transition-colors ${activeFile === f.name ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-white dark:bg-black/5 text-slate-300'}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileCode2 className="w-4 h-4 flex-shrink-0 opacity-70" />
                        <span className="text-sm truncate">{f.name}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(f.name); }} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Middle: Code Editor & Canvas overlay */}
            <div className="relative flex-1 bg-[#0d1117] border-r border-slate-700/50">
              <div className="absolute inset-0 z-0" style={{ pointerEvents: isDrawMode ? 'none' : 'auto' }}>
                <Editor
                  height="100%"
                  language={getEditorLanguage()}
                  theme="vs-dark"
                  value={activeFile === null ? code : files.find(f => f.name === activeFile)?.content || ''}
                  onChange={handleEditorChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 18,
                    wordWrap: 'on',
                    padding: { top: 24 },
                    scrollBeyondLastLine: false,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    bracketPairColorization: { enabled: true },
                    formatOnPaste: true,
                  }}
                />
              </div>
              <canvas
                ref={canvasRef}
                width={3840}
                height={2160}
                className="absolute inset-0 w-full h-full"
                style={{ touchAction: 'none', cursor: drawTool === 'eraser' ? 'cell' : 'crosshair', zIndex: 10, pointerEvents: isDrawMode ? 'auto' : 'none' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={() => setIsDrawing(false)}
                onMouseLeave={() => setIsDrawing(false)}
              />
            </div>
            
            {/* Right side: Execution Output */}
            <div className="w-full lg:w-1/3 bg-[#0a0a0f] flex flex-col">
              <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/50 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Output ({language})</span>
              </div>
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                <pre className="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{output}</pre>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
