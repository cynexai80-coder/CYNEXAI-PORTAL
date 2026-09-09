import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../lib/auth';
import { getClassFlowData, saveQaResponse, markClassWatched, submitOnlineAttendance } from '../../lib/api/student';
import { ArrowLeft, Play, CheckCircle, Lock, Code2, BookOpen, Clock, Star, AlertCircle, Wifi, Video, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';
import ReactPlayer from 'react-player';
import { formatYoutubeUrl } from '../../lib/videoUtils';
import ReactMarkdown from 'react-markdown';
import { cleanAiContent } from '../../lib/aiGenerator';
import html2pdf from 'html2pdf.js';
import { PythonEditor } from '../../components/ui/erp/PythonEditor';


interface Question {
  id: string;
  type: 'mcq' | 'code';
  question_text: string;
  options_json: string;
  correct_answer_idx: number;
  boilerplate_json?: string;
}

import { logOnlineAttendancePing } from '../../lib/api/teacher';

const REQUIRED_WATCH_SECONDS = 5 * 60; // 5 minutes for live attendance as required

export default function ClassFlow() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const classId = searchParams.get('classId') || '';
  const currentStep = searchParams.get('step') || 'video'; // video, qa, coding

  const [classData, setClassData] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stepQuestions, setStepQuestions] = useState<Question[]>([]);
  const [hasWatched, setHasWatched] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [showMaterials, setShowMaterials] = useState(true);

  // Q&A state
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, boolean>>({});
  const [codeAnswer, setCodeAnswer] = useState('');
  const [qaComplete, setQaComplete] = useState(false);
  const [score, setScore] = useState(0);

  // Watch timer (for recorded YouTube classes)
  const watchStartRef = useRef<number | null>(null);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const REQUIRED_VIDEO_SECONDS = 5 * 60; // 5 min for video completion unlock

  // Live attendance timer (5 min for live classes)
  const [hasJoinedLiveClass, setHasJoinedLiveClass] = useState(false);
  const liveStartRef = useRef<number | null>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!classId || !user) return;
    getClassFlowData(classId, user.id).then(data => {
      setClassData(data.classData);
      setQuestions(data.questions || []);
      setHasWatched(data.hasWatched);
      const filteredQs = (data.questions || []).filter((q: Question) => 
        currentStep === 'coding' ? q.type === 'code' || q.type === 'coding' : q.type === 'mcq'
      );
      setStepQuestions(filteredQs);
      
      // Check if all questions for THIS step are answered
      const stepAnswered = filteredQs.length > 0 && filteredQs.every((q: Question) => 
        data.answeredQuestionIds.includes(q.id)
      );
      setHasAnswered(stepAnswered);
      if (stepAnswered) {
        setQaComplete(true);
      }
      setLoading(false);
    });
  }, [classId, user?.id, currentStep]);

  // Real-time polling to sync class status with database
  useEffect(() => {
    if (!classId) return;
    const interval = setInterval(() => {
      import('../../lib/api/student').then(({ checkClassStatus }) => {
        checkClassStatus(classId).then(latest => {
          if (latest) {
            setClassData((prev: any) => {
              if (!prev) return prev;
              if (
                prev.status !== latest.status ||
                prev.youtube_video_id !== latest.youtube_video_id ||
                prev.meet_link !== latest.meet_link
              ) {
                return {
                  ...prev,
                  status: latest.status,
                  youtube_video_id: latest.youtube_video_id,
                  meet_link: latest.meet_link
                };
              }
              return prev;
            });
          }
        });
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [classId]);

  // Start live attendance timer ONLY after student clicks "Join Live Class"
  useEffect(() => {
    if (!classData || !user || !hasJoinedLiveClass) return;
    const isLive = classData.type === 'live' || classData.meet_link;
    if (!isLive || attendanceMarked) return;

    liveStartRef.current = Date.now();
    liveIntervalRef.current = setInterval(() => {
      setLiveSeconds(prev => {
        const next = prev + 1;
        const currentMins = Math.ceil(next / 60);

        // Ping database every 30 seconds to update live duration minutes
        if (next % 30 === 0 || next >= REQUIRED_WATCH_SECONDS) {
          logOnlineAttendancePing(user.id, classId, classData.batch_id || 'default', currentMins).then(res => {
            if (res.markedPresent && !attendanceMarked) {
              setAttendanceMarked(true);
            }
          });
        }

        if (next >= REQUIRED_WATCH_SECONDS && user && !attendanceMarked) {
          submitOnlineAttendance(user.id, classId).then(result => {
            if (result.success) {
              setAttendanceMarked(true);
            }
          });
          if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [classData, user?.id, attendanceMarked, hasJoinedLiveClass]);

  // YouTube watch timer - REMOVED 5 MIN REQUIREMENT
  useEffect(() => {
    // We now use a manual "Mark as Completed" button
  }, []);

  const handleDownloadNotes = () => {
    if (!classData?.ai_study_guide || !printRef.current) return;
    const element = printRef.current;
    const opt = {
      margin:       [15, 15, 15, 15],
      filename:     `${classData.title.replace(/[^a-zA-Z0-9]/g, '_')}_Study_Guide.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleSelectAnswer = (questionId: string, idx: number) => {
    if (submittedAnswers[questionId] !== undefined) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: idx }));
  };

  const handleSubmitAnswer = async (q: Question) => {
    if (selectedAnswers[q.id] === undefined && q.type !== 'code') return;
    const isCorrect = q.type === 'mcq'
      ? selectedAnswers[q.id] === q.correct_answer_idx
      : true;

    setSubmittedAnswers(prev => ({ ...prev, [q.id]: isCorrect }));
    if (isCorrect) setScore(s => s + 1);

    if (user) {
      await saveQaResponse({
        studentId: user.id,
        classId,
        questionId: q.id,
        answerIdx: selectedAnswers[q.id],
        isCorrect,
        codeAnswer: q.type === 'code' ? codeAnswer : undefined
      });
    }

    if (currentQIdx < stepQuestions.length - 1) {
      setTimeout(() => setCurrentQIdx(i => i + 1), 800);
    } else {
      setQaComplete(true);
      setHasAnswered(true);
      
      // Auto-redirect from QA to Coding if coding step exists
      if (currentStep === 'qa' && questions.some((q: Question) => q.type === 'code' || q.type === 'coding')) {
        setTimeout(() => {
          navigate(`/student/class-flow?classId=${classId}&step=coding`);
        }, 1500);
      }
    }
  };

  const handleMarkVideoCompleted = async () => {
    if (!user || !classId) return;
    await markClassWatched(user.id, classId);
    setHasWatched(true);
    // Auto-redirect to QA node
    if (questions.some((q: Question) => q.type === 'mcq')) {
      navigate(`/student/class-flow?classId=${classId}&step=qa`);
    } else {
      // Return to map if no QA
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground font-medium">Class not found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-bold hover:underline flex items-center gap-1 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const status = (classData.status || '').toLowerCase();
  const isLiveNow = (status === 'in_progress' || status === 'live');
  const isEnded = status === 'completed' || status === 'ended';
  const isWaitingForAccess = !isLiveNow && !isEnded && !classData.youtube_video_id;
  const isRecordedClass = !!classData.youtube_video_id || (isEnded && !isLiveNow);

  const livePct = Math.min(100, (liveSeconds / REQUIRED_WATCH_SECONDS) * 100);
  const liveMinLeft = Math.max(0, Math.ceil((REQUIRED_WATCH_SECONDS - liveSeconds) / 60));
  const currentQ = stepQuestions[currentQIdx];
  const parsedOptions = currentQ ? (() => { try { return JSON.parse(currentQ.options_json || '[]'); } catch { return []; } })() : [];

  // Parse AI materials from ai_script or ai_ppt_markdown
  const aiMaterials = classData.ai_script || classData.ai_ppt_markdown || null;

  return (
    <div className="min-h-screen candy-map-bg p-4 md:p-8" ref={container}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:bg-zinc-900/50 dark:hover:bg-white dark:bg-black/10 transition-all candy-panel !border-2 !p-0 shadow-none"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-xs text-slate-800 dark:text-white/80 font-bold uppercase tracking-wider">Class</p>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">{classData.title}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Class type badge */}
          {isLiveNow ? (
            <span className="flex items-center gap-1 text-xs bg-red-500/10 text-red-500 font-bold px-3 py-1.5 rounded-full border border-red-500/20">
              <Wifi className="w-3 h-3 animate-pulse" /> Live
            </span>
          ) : isEnded ? (
            <span className="flex items-center gap-1 text-xs bg-slate-500/10 text-slate-600 dark:text-slate-300 font-bold px-3 py-1.5 rounded-full border border-slate-500/20">
              <CheckCircle className="w-3 h-3 text-slate-500" /> Class ended
            </span>
          ) : isWaitingForAccess ? (
            <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-3 py-1.5 rounded-full border border-amber-500/20">
              <Clock className="w-3 h-3 animate-pulse" /> Waiting for Access
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 font-bold px-3 py-1.5 rounded-full border border-blue-500/20">
              <Video className="w-3 h-3" /> Recorded
            </span>
          )}
          {hasWatched && <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 font-bold px-3 py-1.5 rounded-full border border-green-500/20"><CheckCircle className="w-3 h-3" /> Watched</span>}
          {attendanceMarked && <span className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-400 font-bold px-3 py-1.5 rounded-full border border-purple-500/20"><CheckCircle className="w-3 h-3" /> Attendance ✓</span>}
          {hasAnswered && <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 font-bold px-3 py-1.5 rounded-full border border-blue-500/20"><Star className="w-3 h-3" /> Completed</span>}
        </div>
      </div>

      <div className={`mx-auto ${currentStep === 'video' && classData?.ai_study_guide ? 'max-w-7xl lg:grid lg:grid-cols-3 lg:gap-8' : 'max-w-4xl space-y-6'}`}>

        {/* ── MAIN CONTENT AREA ── */}
        <div className={currentStep === 'video' && classData?.ai_study_guide ? 'lg:col-span-2 space-y-6' : 'space-y-6'}>
        {/* ── VIDEO STEP ── */}
        {currentStep === 'video' && (
          <>
            {/* ── RECORDED CLASS: YouTube Video ── */}
            {classData.youtube_video_id && (
              <div id="recorded-player" className="candy-panel overflow-hidden mb-6 flow-panel">
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                  {(() => {
                    const rawUrl = classData.youtube_video_id || '';
                    let videoId = '';
                    const match = rawUrl.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|v=|live\/|shorts\/))([\w-]{11})/i);
                    if (match && match[1]) {
                      videoId = match[1];
                    } else if (/^[\w-]{11}$/.test(rawUrl.trim())) {
                      videoId = rawUrl.trim();
                    }

                    if (videoId) {
                      return (
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&showinfo=0`}
                          className="absolute inset-0 w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      );
                    } else {
                      return (
                        <div className="text-slate-400 flex flex-col items-center">
                          <AlertCircle className="w-8 h-8 mb-2" />
                          <p>Invalid YouTube URL</p>
                        </div>
                      );
                    }
                  })()}
                </div>
                <div className="p-4 bg-slate-50/70 dark:bg-black/50 border-t border-slate-200 dark:border-white/20 flex justify-between items-center">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">Finished watching?</p>
                  <button
                    onClick={handleMarkVideoCompleted}
                    className={`px-6 py-2 text-sm transition-all ${
                      hasWatched ? 'bg-green-500/10 text-green-500 border border-green-500/20 font-bold rounded-xl' : 'candy-btn'
                    }`}
                    disabled={hasWatched}
                  >
                    {hasWatched ? 'Completed ✓' : 'Mark as Completed'}
                  </button>
                </div>
              </div>
            )}

            {/* ── STATE 1: WAITING FOR TEACHER TO GIVE ACCESS ── */}
            {isWaitingForAccess && (
              <div className="candy-panel overflow-hidden mb-6 flow-panel">
                <div className="p-8 text-center border-b border-slate-200 dark:border-white/20 bg-white/50 dark:bg-black/30">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                    <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white text-xl mb-2">
                    Waiting for teacher to give access
                  </h3>
                  <p className="text-slate-600 dark:text-white/60 text-sm mb-6 font-bold max-w-md mx-auto leading-relaxed">
                    The teacher has not started this live session yet. Please stay on this page or check back when your instructor launches the class.
                  </p>
                  <button
                    disabled
                    className="px-6 py-3 text-sm rounded-2xl font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 cursor-not-allowed flex items-center gap-2 mx-auto shadow-sm opacity-90"
                  >
                    <Clock className="w-4 h-4 animate-spin" /> Waiting for teacher to give access
                  </button>
                </div>
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 text-center border-t border-amber-100 dark:border-amber-900/30">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-bold">
                    💡 Access to this live class session will be granted automatically as soon as the instructor starts the class.
                  </p>
                </div>
              </div>
            )}

            {/* ── STATE 2: LIVE NOW ── */}
            {isLiveNow && (
              <div className="candy-panel overflow-hidden mb-6 flow-panel">
                {/* Live join area */}
                <div className="p-6 text-center border-b border-slate-200 dark:border-white/20 bg-white/50 dark:bg-black/30">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                    <Wifi className="w-8 h-8 text-red-500 animate-pulse" />
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">Live Class in Session</h3>
                  <p className="text-slate-600 dark:text-white/60 text-sm mb-4 font-bold">Stay on this page for 5 minutes to mark your attendance automatically.</p>
                  <a
                    href={classData.meet_link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setHasJoinedLiveClass(true)}
                    className="candy-btn px-6 py-3 text-sm inline-flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-white" /> Join Live Class
                  </a>
                </div>

                {/* 5-min attendance timer */}
                <div className="p-4 bg-slate-50/70 dark:bg-black/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-slate-700 dark:text-white/70 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Attendance Progress
                    </span>
                    {attendanceMarked ? (
                      <span className="text-xs font-bold text-green-500 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Marked!
                      </span>
                    ) : hasJoinedLiveClass ? (
                      <span className="text-xs font-bold text-primary">
                        {liveMinLeft} min remaining
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        Not Started
                      </span>
                    )}
                  </div>
                  <div className="h-3 bg-foreground/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${attendanceMarked ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}
                      style={{ width: `${attendanceMarked ? 100 : hasJoinedLiveClass ? livePct : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-white/60 font-bold mt-2">
                    {attendanceMarked
                      ? '✅ Attendance marked! Great job attending this live class.'
                      : hasJoinedLiveClass
                      ? 'Stay on this page for 5 minutes to automatically mark attendance.'
                      : '👇 Click "Join Live Class" above to start your 5-minute attendance tracking.'}
                  </p>
                </div>
              </div>
            )}

            {/* ── STATE 3: CLASS ENDED / BATCH PROGRESS UPDATED ── */}
            {isEnded && !classData.youtube_video_id && (
              <div className="candy-panel overflow-hidden mb-6 flow-panel">
                <div className="p-6 text-center border-b border-slate-200 dark:border-white/20 bg-white/50 dark:bg-black/30">
                  <div className="w-16 h-16 rounded-2xl bg-slate-500/10 flex items-center justify-center mx-auto mb-4 border border-slate-500/20">
                    <CheckCircle className="w-8 h-8 text-slate-500 dark:text-slate-300" />
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white text-xl mb-1">Class ended</h3>
                  <p className="text-slate-600 dark:text-white/60 text-sm mb-5 font-bold max-w-md mx-auto">
                    This live session has ended. You can now review the class summary and materials below.
                  </p>
                  <span className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white/80 border border-slate-300 dark:border-white/20">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> Class Ended · Review Notes Below
                  </span>
                </div>
              </div>
            )}

        {/* ── External Class Notes / Document ── */}
        {classData.doc_url && (
          <div className="candy-panel p-5 flex items-center justify-between mb-6 flow-panel">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white">Class Document / Notes</h3>
                <p className="text-sm text-slate-600 dark:text-white/60 font-bold">External study materials attached by the instructor.</p>
              </div>
            </div>
            <a 
              href={classData.doc_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="candy-btn-blue px-4 py-2"
            >
              Open Document
            </a>
          </div>
        )}

            {classData.ai_summary && (
              <div className="candy-panel p-5 mt-6 mb-6 flow-panel">
                <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3"><BookOpen className="w-4 h-4 text-primary" /> Class Summary</h2>
                <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-3 font-medium prose dark:prose-invert max-w-none">
                  <ReactMarkdown>
                    {cleanAiContent(classData.ai_summary)}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Q&A / CODING STEP ── */}
        {(currentStep === 'qa' || currentStep === 'coding') && (
          stepQuestions.length > 0 ? (
            <div className="candy-panel overflow-hidden flow-panel">
              <div className="p-5 border-b border-slate-200 dark:border-white/20 bg-slate-50/50 dark:bg-black/30">
                <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  {currentStep === 'qa' ? 'Post-Class Q&A' : 'Coding Challenge'}
                  <span className="ml-auto text-xs bg-primary/10 text-primary font-bold px-2 py-1 rounded-full">
                    {qaComplete ? `${score}/${stepQuestions.length} correct` : `${currentQIdx + 1} of ${stepQuestions.length}`}
                  </span>
                </h2>
              </div>

              {hasAnswered && !qaComplete ? (
                <div className="p-6 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="font-bold text-foreground">You've already completed this section!</p>
                  <p className="text-muted-foreground text-sm mt-1">+5 coins per correct answer were awarded.</p>
                </div>
              ) : qaComplete ? (
                <div className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg border-4 border-yellow-200">
                    <Star className="w-8 h-8 text-white fill-white" />
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white text-xl mb-1">Section Complete!</h3>
                  <p className="text-slate-600 dark:text-white/60 text-sm mb-3 font-bold">You scored {score} out of {stepQuestions.length}</p>
                  <p className="text-yellow-500 font-black text-lg">+{score * 5} coins earned! 🪙</p>
                  <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2 candy-btn-blue text-sm">
                    Return to Quest Map
                  </button>
                </div>
              ) : currentQ ? (
                <div className="p-5 bg-white/70 dark:bg-black/50">
                  <p className="font-black text-slate-900 dark:text-white text-base mb-4">{currentQIdx + 1}. {currentQ.question_text}</p>

                  {currentQ.type === 'mcq' && parsedOptions.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {parsedOptions.map((opt: string, idx: number) => {
                        const isSelected = selectedAnswers[currentQ.id] === idx;
                        const isSubmitted = submittedAnswers[currentQ.id] !== undefined;
                        const isCorrect = idx === currentQ.correct_answer_idx;
                        let btnClass = 'border-border text-foreground';
                        if (isSubmitted) {
                          if (isCorrect) btnClass = 'border-green-500 bg-green-500/10 text-green-400';
                          else if (isSelected) btnClass = 'border-red-500 bg-red-500/10 text-red-400';
                        } else if (isSelected) {
                          btnClass = 'border-primary bg-primary/10 text-primary';
                        }
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectAnswer(currentQ.id, idx)}
                            className={`w-full text-left p-3 min-h-[44px] rounded-xl border-2 font-medium text-sm transition-all ${btnClass} hover:border-primary/50`}
                          >
                            <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : (currentQ.type === 'code' || currentQ.type === 'coding') ? (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-primary" />
                          <span className="text-sm font-bold text-foreground">Python Code Editor:</span>
                        </div>
                      </div>
                      <PythonEditor
                        initialCode={currentQ.boilerplate_json || "def solution():\\n    # Write your code here\\n    pass"}
                        onChange={setCodeAnswer}
                        onRunSuccess={() => {
                          // Allow submission after a successful run without exceptions
                        }}
                      />
                    </div>
                  ) : null}

                  <button
                    onClick={() => handleSubmitAnswer(currentQ)}
                    disabled={submittedAnswers[currentQ.id] !== undefined || (currentQ.type === 'code' && !codeAnswer.trim())}
                    className="w-full py-3 candy-btn text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittedAnswers[currentQ.id] !== undefined ? 'Submitted ✓' : 'Submit Answer'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="candy-panel p-8 text-center mt-6 flow-panel">
              <AlertCircle className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4 opacity-50" />
              <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">No Questions Available</h3>
              <p className="text-slate-600 dark:text-white/60 text-sm mb-6 font-bold">There are no {currentStep === 'qa' ? 'Q&A' : 'coding'} questions generated for this class yet.</p>
              <button 
                onClick={() => navigate(-1)} 
                className="candy-btn-blue px-6 py-2"
              >
                Return to Quest Map
              </button>
            </div>
          )
        )}
        </div>

        {/* ── RIGHT SIDEBAR: STUDY GUIDE ── */}
        {currentStep === 'video' && classData?.ai_study_guide && (
          <div className="lg:col-span-1 mt-6 lg:mt-0">
            <div className="candy-panel p-0 sticky top-8 flow-panel flex flex-col bg-white dark:bg-black overflow-hidden border border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
              
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white dark:bg-black/5 flex items-center justify-between shrink-0">
                <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                  </div>
                  Study Guide
                </h2>
                <button 
                  onClick={handleDownloadNotes} 
                  title="Download Notes"
                  className="w-8 h-8 rounded-full bg-slate-200/50 dark:bg-white/10 hover:bg-slate-200 dark:bg-zinc-900/50 dark:hover:bg-white dark:bg-black/20 flex items-center justify-center text-slate-600 dark:text-white/60 transition-all hover:scale-105 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div ref={notesRef} className="bg-white dark:bg-black p-2">
                  <ReactMarkdown
                    components={{
                    h1: ({node, ...props}) => <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6 tracking-tight" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-black text-slate-800 dark:text-white mt-8 mb-4 border-b border-slate-100 dark:border-white/10 pb-2 tracking-tight" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-6 mb-3" {...props} />,
                    p: ({node, ...props}) => <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-black text-slate-900 dark:text-white" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-5 space-y-2 marker:text-blue-400" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-5 space-y-2 marker:text-blue-400 marker:font-bold" {...props} />,
                    li: ({node, ...props}) => <li className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed" {...props} />,
                    code: ({node, inline, className, children, ...props}: any) => {
                      return inline ? (
                        <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white dark:bg-black/10 text-pink-600 dark:text-pink-400 text-xs font-mono font-bold" {...props}>
                          {children}
                        </code>
                      ) : (
                        <div className="my-5 rounded-xl overflow-hidden border border-slate-800 bg-[#0f172a] shadow-xl">
                          <div className="flex items-center px-4 py-2 bg-[#1e293b] border-b border-slate-700">
                            <div className="flex gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                            </div>
                          </div>
                          <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-50 leading-relaxed">
                            <code {...props}>{children}</code>
                          </pre>
                        </div>
                      );
                    },
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-500/10 p-4 rounded-r-xl my-5 text-slate-700 dark:text-slate-300 italic text-sm" {...props} />
                  }}
                >
                  {classData.ai_study_guide}
                </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Hidden off-screen container strictly styled for gorgeous PDF generation */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div 
          ref={printRef} 
          className="bg-white dark:bg-black text-slate-900 dark:text-white" 
          style={{ width: '800px', padding: '40px', fontFamily: '"Inter", system-ui, sans-serif' }}
        >
          {/* Custom PDF Header */}
          <div className="border-b-4 border-blue-600 pb-6 mb-8 text-center" style={{ pageBreakAfter: 'avoid' }}>
            <h1 className="text-4xl font-black text-blue-600 tracking-tight mb-2">CYNEXAI Study Guide</h1>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{classData?.title}</h2>
          </div>

          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-6 tracking-tight mt-10" style={{ pageBreakAfter: 'avoid' }} {...props} />,
              h2: ({node, ...props}) => <h2 className="text-2xl font-black text-slate-800 dark:text-white mt-10 mb-4 border-b border-slate-200 dark:border-white/10 pb-2 tracking-tight" style={{ pageBreakAfter: 'avoid' }} {...props} />,
              h3: ({node, ...props}) => <h3 className="text-xl font-bold text-blue-600 mt-8 mb-3" style={{ pageBreakAfter: 'avoid' }} {...props} />,
              p: ({node, ...props}) => <p className="text-base text-slate-700 dark:text-white leading-relaxed mb-5" {...props} />,
              strong: ({node, ...props}) => <strong className="font-black text-slate-900 dark:text-white" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-5 space-y-2 marker:text-blue-600" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-5 space-y-2 marker:text-blue-600 font-bold" {...props} />,
              li: ({node, ...props}) => <li className="text-base text-slate-700 dark:text-white leading-relaxed" {...props} />,
              code: ({node, inline, className, children, ...props}: any) => {
                return inline ? (
                  <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-900/50 text-pink-600 text-sm font-mono font-bold" {...props}>
                    {children}
                  </code>
                ) : (
                  <div className="my-6 rounded-xl border border-slate-200 dark:border-white/10 bg-[#f8fafc] shadow-sm overflow-hidden" style={{ pageBreakInside: 'avoid' }}>
                    <div className="flex items-center px-4 py-2 bg-slate-200 dark:bg-zinc-900/50/50 border-b border-slate-200 dark:border-white/10">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                      </div>
                    </div>
                    <pre className="p-5 text-sm font-mono text-slate-800 dark:text-white whitespace-pre-wrap leading-relaxed break-words">
                      <code {...props}>{children}</code>
                    </pre>
                  </div>
                );
              },
              blockquote: ({node, ...props}) => (
                <blockquote 
                  className="border-l-4 border-blue-500 bg-blue-50 p-5 rounded-r-xl my-6 text-slate-800 dark:text-white italic text-base" 
                  style={{ pageBreakInside: 'avoid' }} 
                  {...props} 
                />
              )
            }}
          >
            {classData?.ai_study_guide || ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
