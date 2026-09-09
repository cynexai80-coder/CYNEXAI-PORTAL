import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/erp/Button';
import {
  StopCircle, ArrowRight, ArrowLeft, Maximize2, Play,
  Code, Sparkles, Loader2, Radio, BookOpen, CheckCircle, AlertCircle, Menu, X, Edit, Users as UsersIcon, Video
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCurrentUser } from '../../lib/auth';
import { generateAIMaterials, generatePostClassSummary } from '../../lib/aiGenerator';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { getInstructorClasses, updateClassMaterials, updateClassStatus, completeClassWithSummary, ClassRow, getLiveAttendance, updateClassDetails, ensureClassQuestions } from '../../lib/api/teacher';

import { CodeWorkspace } from './CodeWorkspace';
import { SqlWorkspace } from './SqlWorkspace';
import { DataWorkspace } from './DataWorkspace';

const parseKeypoints = (raw: string) => {
  if (!raw) return [];
  if (!raw.toLowerCase().includes('[slide')) {
    return [raw.split('\n').filter(Boolean)];
  }
  const slides = raw.split(/\[Slide \d+\]/i).filter(Boolean);
  return slides.map(s => s.trim().split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean));
};

export default function LiveStreamDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const classIdParam = searchParams.get('classId');
  const user = getCurrentUser();

  // ── State ──
  const [classData, setClassData] = useState<ClassRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [ending, setEnding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [showEndModal, setShowEndModal] = useState(false);
  
  // Recording State
  const [youtubeOpened, setYoutubeOpened] = useState(false);
  const [youtubeConfirmed, setYoutubeConfirmed] = useState(false);
  
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelMode, setPanelMode] = useState<'slides' | 'code'>('slides');
  const [slide, setSlide] = useState(1);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [slideTheme, setSlideTheme] = useState<'retro'|'minimal'|'dark'>('retro');

  // Slide scaling — render at 1600×900, scale down to fit container
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [slideScale, setSlideScale] = useState(0.5);

  useEffect(() => {
    const updateScale = () => {
      const container = slideContainerRef.current;
      if (!container) return;
      // Use getBoundingClientRect for accurate rendered size (not layout size)
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scale = Math.min(rect.width / 1600, rect.height / 900) * 0.95;
      setSlideScale(scale);
    };
    updateScale();
    // Multiple timeouts to catch late layout updates
    const t1 = setTimeout(updateScale, 50);
    const t2 = setTimeout(updateScale, 200);
    const observer = new ResizeObserver(updateScale);
    if (slideContainerRef.current) observer.observe(slideContainerRef.current);
    window.addEventListener('resize', updateScale);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [panelMode, sidebarOpen]);

  useEffect(() => { fetchClasses(); }, []);
  useEffect(() => {
    if (isLive && classData) {
      const i = setInterval(() => {
        getLiveAttendance(classData.id).then(setAttendance);
      }, 5000);
      getLiveAttendance(classData.id).then(setAttendance);
      return () => clearInterval(i);
    }
  }, [isLive, classData]);

  const fetchClasses = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const classes = await getInstructorClasses(user.id, classIdParam || undefined);
      if (classes.length > 0) {
        setClassData(classes[0]);
        setEditForm({ title: classes[0].title, description: classes[0].description || '' });
        ensureClassQuestions(classes[0].id, classes[0].title, classes[0].description || '', classes[0].ai_keypoints || '').catch(() => {});
      }
    } catch (e) { console.error('Failed to load class', e); } 
    finally { setLoading(false); }
  };

  const handleUpdateDetails = async () => {
    if (!classData) return;
    await updateClassDetails(classData.id, editForm.title, editForm.description);
    setClassData({ ...classData, title: editForm.title, description: editForm.description });
    setShowEditModal(false);
  };

  const handleGenerateMaterials = async () => {
    if (!classData) return;
    setGenerating(true);
    try {
      const { ppt, script, keypoints } = await generateAIMaterials(classData.title, classData.description || '');
      await updateClassMaterials(classData.id, ppt, script, keypoints);
      setClassData({ ...classData, ai_ppt_markdown: ppt, ai_script: script, ai_keypoints: keypoints });
      await ensureClassQuestions(classData.id, classData.title, classData.description || '', keypoints);
    } catch (e: any) {
      if (e?.message === 'QUOTA_EXCEEDED') {
        alert('❌ Gemini API quota exceeded.\n\nYour free tier API key has run out of daily credits.\n\nTo fix this:\n1. Go to https://aistudio.google.com\n2. Create a new API key with billing enabled, OR\n3. Wait until tomorrow for the free quota to reset.\n\nThen update VITE_GEMINI_API_KEY in your .env file.');
      } else {
        alert('AI generation failed: ' + (e?.message || 'Unknown error'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleStartClass = async () => {
    if (!classData || !youtubeConfirmed) return;
    
    await updateClassStatus(classData.id, 'in_progress', 'live');
    await ensureClassQuestions(classData.id, classData.title, classData.description || '', classData.ai_keypoints || '').catch(() => {});
    localStorage.setItem('cynexai_live_class_id', classData.id);
    localStorage.setItem('cynexai_live_slide', '1');
    localStorage.setItem('cynexai_live_mode', 'slides');
    setIsLive(true);
  };

  const handleEndClass = async () => {
    if (!classData) return;
    setEnding(true);
    
    try {
      const summary = await generatePostClassSummary(classData.title, classData.ai_keypoints || '');
      await completeClassWithSummary(classData.id, summary, ytUrl || null);
      localStorage.removeItem('cynexai_live_class_id');
      setIsLive(false);
      setShowEndModal(false);
      alert('Class ended! AI summary generated.');
      navigate('/teacher');
    } catch (e) {
      alert('Failed to end class.');
    } finally {
      setEnding(false);
    }
  };

  const changeSlide = (n: number) => {
    setSlide(n);
    localStorage.setItem('cynexai_live_slide', n.toString());
  };

  const changePanelMode = (m: 'slides' | 'code') => {
    setPanelMode(m);
    localStorage.setItem('cynexai_live_mode', m);
  };

  const openPopOut = () => {
    window.open(`/teacher/presentation-view?classId=${classData?.id}`, '_blank', 'width=1280,height=800,toolbar=no,menubar=no');
  };

  // ── Derived ──
  const hasAI = !!classData?.ai_ppt_markdown;
  const slides = hasAI ? (classData!.ai_ppt_markdown as string).split('---').map(s => s.trim()).filter(Boolean) : [];
  const currentSlideText = slides[slide - 1] || '# No slides yet';
  const parsedKeypoints = parseKeypoints(classData?.ai_keypoints || '');
  const currentKeypoints = parsedKeypoints[slide - 1] || parsedKeypoints[0] || [];

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      <span className="font-bold text-lg">Loading class environment...</span>
    </div>
  );

  if (!classData) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white flex-col gap-4">
      <AlertCircle className="w-12 h-12 text-yellow-400" />
      <h2 className="text-2xl font-bold">No classes available</h2>
      <Button onClick={() => navigate('/teacher/cms')}>Open Course CMS</Button>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#0a0a0f] text-white overflow-hidden font-sans">
      
      {/* ── Collapsible Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 420, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full bg-[#111118] border-r border-white/5 flex flex-col shrink-0 overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 relative">
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">{classData.module_title || 'Active Class'}</div>
              <div className="w-full bg-white/10 dark:bg-black/20 border border-white/10 rounded-xl px-4 py-3 group relative cursor-pointer" onClick={() => setShowEditModal(true)}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full shrink-0 ${isLive ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
                  <span className="font-bold text-base text-white truncate pr-6">{classData.title}</span>
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            {isLive && (
              <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Radio className="w-4 h-4 text-red-400 animate-pulse" />
                  <span className="text-red-400 font-bold text-sm">LIVE NOW</span>
                </div>
                <div className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-bold">{attendance.length} Joined</div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-4">
              {/* Jitsi iframe moved here (Teacher's Pic & Broadcast) */}
              {isLive && hasAI && (
                <div className="mb-6 rounded-xl overflow-hidden border border-white/10 bg-black aspect-video relative">
                  <iframe
                    src={`https://meet.element.io/CynexAIClass${classData.id.replace(/[^a-zA-Z0-9]/g, '')}#config.prejoinPageEnabled=false&config.disableDeepLinking=true`}
                    allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                    className="absolute inset-0 w-full h-full border-0"
                  />
                </div>
              )}

              {/* Attendance */}
              {isLive && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <UsersIcon className="w-3.5 h-3.5" /> Students Joined ({attendance.length})
                  </h3>
                  <div className="space-y-2">
                    {attendance.map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">{a.student_name}</span>
                          <span className="text-[10px] text-slate-400">{a.batch_name} • {a.course_name}</span>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      </div>
                    ))}
                    {attendance.length === 0 && <p className="text-slate-500 text-xs italic">Waiting for students...</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-white/5 space-y-2">
              {/* Theme picker — always visible */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Slide Theme</p>
                <div className="flex gap-1.5">
                  {(['retro', 'minimal', 'dark'] as const).map(t => (
                    <button key={t} onClick={() => setSlideTheme(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all capitalize ${
                        slideTheme === t
                          ? t === 'retro' ? 'bg-[#f4a7a1] text-black border-black shadow'
                            : t === 'minimal' ? 'bg-white text-slate-900 border-white shadow'
                            : 'bg-indigo-600 text-white border-indigo-500 shadow'
                          : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20 hover:text-white'
                      }`}>{t}
                    </button>
                  ))}
                </div>
              </div>

              {!hasAI ? (
                <Button onClick={handleGenerateMaterials} disabled={generating} className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 font-bold text-white">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate AI Slides
                </Button>
              ) : !isLive ? (
                <div className="flex flex-col gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Step 1: Start Recording</div>
                  <Button 
                    onClick={() => {
                      window.open('https://studio.youtube.com/channel/UC/livestreaming', '_blank');
                      setYoutubeOpened(true);
                    }} 
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 font-bold text-white py-2"
                  >
                    <Video className="w-4 h-4" /> Open YouTube Studio
                  </Button>
                  
                  {youtubeOpened && (
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-black/40 rounded-lg border border-white/10 hover:border-white/30 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={youtubeConfirmed} 
                        onChange={(e) => setYoutubeConfirmed(e.target.checked)}
                        className="w-4 h-4 accent-red-500 rounded cursor-pointer"
                      />
                      <span className="text-xs text-slate-200 font-semibold select-none leading-tight">I confirm the YouTube stream is running</span>
                    </label>
                  )}

                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mt-2">Step 2: Start Class</div>
                  <Button 
                    onClick={handleStartClass} 
                    disabled={!youtubeConfirmed}
                    className={`w-full flex items-center justify-center gap-2 font-bold text-white transition-all duration-300 ${youtubeConfirmed ? 'bg-green-600 hover:bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-slate-700 opacity-50 cursor-not-allowed'}`}
                  >
                    <Play className="w-4 h-4" /> Start Live Class
                  </Button>
                  
                  <button onClick={handleGenerateMaterials} disabled={generating} className="text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors py-1 flex items-center justify-center gap-1.5 mt-2 uppercase tracking-wider">
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Regenerate AI Slides
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowEndModal(true)} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl py-2.5 text-sm transition-colors">
                  <StopCircle className="w-4 h-4" /> End Class
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ── Main Stage ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#0B0B1A]">
        {/* Topbar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#111118]/80 backdrop-blur border-b border-white/5 absolute top-0 left-0 right-0 z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="flex gap-1 bg-black/30 rounded-lg p-1">
              <button onClick={() => changePanelMode('slides')} className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${panelMode === 'slides' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <BookOpen className="w-3.5 h-3.5" /> Slides
              </button>
              <button onClick={() => changePanelMode('code')} className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${panelMode === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Code className="w-3.5 h-3.5" /> Code & Draw
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {panelMode === 'slides' && hasAI && (
              <div className="flex items-center gap-2">
                <button onClick={() => changeSlide(Math.max(1, slide - 1))} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-bold text-slate-300 w-16 text-center">{slide} / {slides.length}</span>
                <button onClick={() => changeSlide(Math.min(slides.length, slide + 1))} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button onClick={openPopOut} className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
              <Maximize2 className="w-3.5 h-3.5" /> Pop-Out Screen
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 mt-14 relative overflow-hidden">
          {!hasAI ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-violet-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">No AI materials yet</h2>
              <p className="text-slate-400 mb-8 max-w-md">Click "Generate AI Materials" in the sidebar to auto-create your presentation slides and keypoints.</p>
            </div>
          ) : panelMode === 'slides' ? (
            <div
              className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#0B0B1A] via-[#0F172A] to-[#0A0F1C]"
              ref={slideContainerRef}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

              {/* Positioning wrapper — keeps framer-motion animation separate from CSS transform scaling */}
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
                <motion.div
                  key={slide}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ width: '1600px', height: '900px', position: 'absolute', top: 0, left: 0 }}
                  className={`border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden p-8 ${
                    slideTheme === 'dark' ? 'bg-[#0f172a]' : slideTheme === 'minimal' ? 'bg-white dark:bg-black' : 'bg-[#f5e4dd]'
                  }`}
                >
                  {/* Retro Background Grid */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                  {/* Decorative Folders */}
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-8 z-0">
                    {['bg-[#f4a7a1]', 'bg-[#a3c9c4]', 'bg-[#f2c180]', 'bg-[#e77a71]', 'bg-[#a3c9c4]'].map((color, idx) => (
                      <div key={idx} className={`w-14 h-12 ${color} border-2 border-black relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
                        <div className={`absolute -top-3 left-0 w-6 h-3 ${color} border-2 border-black border-b-0`} />
                      </div>
                    ))}
                  </div>

                  {/* Main Content Window */}
                  <div className={`ml-28 flex-1 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col relative z-10 overflow-hidden ${
                    slideTheme === 'dark' ? 'bg-[#0f172a]' : slideTheme === 'minimal' ? 'bg-white' : 'bg-[#f5e4dd]'
                  }`}>
                    {/* Window Titlebar */}
                    <div className={`h-10 border-b-4 border-black flex items-center justify-end px-4 gap-2 ${
                      slideTheme === 'dark' ? 'bg-indigo-900' : slideTheme === 'minimal' ? 'bg-gray-100 dark:bg-zinc-900/50' : 'bg-[#f4a7a1]'
                    }`}>
                      <div className="w-5 h-5 border-2 border-black bg-white dark:bg-black" />
                      <div className="w-5 h-5 border-2 border-black bg-white dark:bg-black" />
                      <div className="w-5 h-5 border-2 border-black bg-white dark:bg-black flex items-center justify-center font-bold text-xs">X</div>
                    </div>

                     {/* Content Area — justify-start prevents top overflow */}
                    <div className="flex-1 px-12 py-8 flex flex-col justify-start items-center text-center overflow-hidden">
                      <ReactMarkdown
                        components={{
                          h1: ({node, ...props}) => <h1 style={{fontSize:'54px', fontWeight:900, textTransform:'uppercase', letterSpacing:'-1px', marginBottom:'24px', lineHeight:1.1, wordBreak:'break-word', color:
                            slideTheme==='dark'?'#a5b4fc':slideTheme==='minimal'?'#111':'#000'}} {...props} />,
                          h2: ({node, ...props}) => <h2 style={{fontSize:'34px', fontWeight:800, textTransform:'uppercase', marginBottom:'18px', lineHeight:1.2, wordBreak:'break-word', color:
                            slideTheme==='dark'?'#c7d2fe':slideTheme==='minimal'?'#333':'#000'}} {...props} />,
                          p:  ({node, ...props}) => <p  style={{fontSize:'24px', fontWeight:600, marginBottom:'14px', lineHeight:1.5, wordBreak:'break-word', color:
                            slideTheme==='dark'?'#e2e8f0':slideTheme==='minimal'?'#444':'#111', maxWidth:'1200px'}} {...props} />,
                          ul: ({node, ...props}) => <ul style={{listStyle:'none', padding:0, margin:'12px 0', width:'100%', maxWidth:'1300px'}} {...props} />,
                          li: ({node, ...props}) => (
                            <li style={{display:'flex', alignItems:'flex-start', gap:'16px', padding:'10px 18px',
                              background: slideTheme==='dark'?'rgba(99,102,241,0.12)':slideTheme==='minimal'?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.5)',
                              border: slideTheme==='dark'?'1px solid rgba(99,102,241,0.3)':slideTheme==='minimal'?'1px solid #ddd':'2px solid #000',
                              boxShadow: slideTheme==='retro'?'3px 3px 0 #000':'none',
                              marginBottom:'10px', fontSize:'22px', fontWeight:600, wordBreak:'break-word',
                              color: slideTheme==='dark'?'#e2e8f0':'#000', borderRadius: slideTheme==='minimal'?'8px':'0'}}>
                              <span style={{width:'12px', height:'12px', minWidth:'12px',
                                background: slideTheme==='dark'?'#818cf8':slideTheme==='minimal'?'#6366f1':'#e77a71',
                                border: slideTheme==='retro'?'2px solid #000':'none',
                                borderRadius: slideTheme==='minimal'?'50%':'0',
                                display:'inline-block', marginTop:'5px', flexShrink:0}} />
                              <span {...props} />
                            </li>
                          ),
                          img: () => null, // No images in slides
                        }}
                      >
                        {currentSlideText}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
              </div>

              {/* Slide dots */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                {slides.map((_, i) => (
                  <button key={i} onClick={() => changeSlide(i + 1)}
                    className={`h-2 rounded-full transition-all ${slide === i + 1 ? 'bg-[#e77a71] w-6' : 'bg-white dark:bg-black/30 w-2 hover:bg-white dark:bg-black/50'}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            (() => {
              const moduleTitle = (classData?.module_title || '').toLowerCase();
              if (moduleTitle.includes('sql') || moduleTitle.includes('database')) return <SqlWorkspace />;
              if (moduleTitle.includes('excel') || moduleTitle.includes('data')) return <DataWorkspace />;
              return <CodeWorkspace />;
            })()
          )}
        </div>
      </div>

      {/* ── Right Sidebar: Keypoints ── */}
      <AnimatePresence>
        {sidebarOpen && hasAI && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full bg-[#111118] border-l border-white/5 flex flex-col shrink-0 overflow-hidden"
          >
            <div className="p-5 border-b border-white/5">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" /> Teaching Guide
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-5">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Slide {slide} Keypoints
              </h3>
              {slides.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No keypoints available...</p>
              ) : (
                <ul className="space-y-4">
                  {currentKeypoints.map((kp: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-100 leading-relaxed bg-white/10 p-4 rounded-xl border border-white/10">
                      <ArrowRight className="w-4 h-4 text-green-400 mt-1 shrink-0" />
                      <ReactMarkdown>{kp}</ReactMarkdown>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Class Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1a1a28] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Edit Class Setup</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Class Title</label>
                <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white mt-1 outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Description / Topics</label>
                <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} rows={3} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white mt-1 outline-none focus:border-indigo-500 resize-none" placeholder="What will you teach today?" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEditModal(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-sm">Cancel</button>
              <button onClick={handleUpdateDetails} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm">Save & Update</button>
            </div>
          </div>
        </div>
      )}

      {/* ── End Class Modal ── */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1a1a28] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><CheckCircle className="w-6 h-6 text-green-400"/> End Class</h2>
            <p className="text-slate-400 text-sm mb-4">Paste YouTube recording URL so students can replay. AI summary will be auto-generated.</p>
            <input type="url" placeholder="https://youtube.com/watch?v=..." value={ytUrl} onChange={e => setYtUrl(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-4 outline-none focus:border-indigo-500" />
            <div className="flex gap-3">
              <button onClick={() => setShowEndModal(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl text-sm">Cancel</button>
              <button onClick={handleEndClass} disabled={ending} className="flex-1 bg-green-600 hover:bg-green-500 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl text-sm">
                {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'End & Generate Summary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
