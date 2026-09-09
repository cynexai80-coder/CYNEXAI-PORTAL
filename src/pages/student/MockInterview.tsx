import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getCurrentUser } from '../../lib/auth';
import { 
  getLastMockInterview, 
  saveMockInterview, 
  getMockInterviewHistory,
  getStudentDashboardData, 
  processVoiceInterview, 
  processTextInterviewResponse,
  getInitialInterviewAudio, 
  evaluateMockInterview,
  textToSpeech,
  spendCoins,
  MockInterview as MockInterviewType,
  InterviewEvaluation 
} from '../../lib/api/student';
import { 
  Mic, Loader2, CheckCircle, Clock, Star, Play, Settings, XCircle, 
  Volume2, Send, History, Award, BookOpen, Sparkles, MessageSquare, AlertCircle, RefreshCw 
} from 'lucide-react';
import { Avatar2D } from '../../components/ui/Avatar2D';
import { getGamificationSettings } from '../../lib/api/gamification';

const VOICES = [
  { id: 'aura-asteria-en', name: 'Priya (Indian HR Female)', desc: 'Warm & professional' },
  { id: 'aura-orion-en', name: 'Arjun (Indian HR Male)', desc: 'Authoritative & clear' },
  { id: 'aura-helios-en', name: 'Vikram (International Male)', desc: 'MNC style' },
  { id: 'aura-angus-en', name: 'Meera (International Female)', desc: 'Senior management' },
];

const SPEEDS = [
  { label: '0.75x (Slower)', value: 0.75 },
  { label: '1.0x (Normal)', value: 1.0 },
  { label: '1.25x (Fast)', value: 1.25 },
  { label: '1.5x (Very Fast)', value: 1.5 },
];

const ROLE_PRESETS = [
  'Full Stack Web Developer',
  'Data Scientist / AI Engineer',
  'Data Analyst',
  'Cloud & DevOps Engineer',
  'Cybersecurity Specialist',
  'Digital Marketing Lead'
];

type Phase = 'setup' | 'interview' | 'evaluating' | 'complete';

export default function MockInterview() {
  const user = getCurrentUser();
  const [phase, setPhase] = useState<Phase>('setup');
  const [loading, setLoading] = useState(true);
  const [coinsAvailable, setCoinsAvailable] = useState(0);
  const [interviewCost, setInterviewCost] = useState(50);
  
  // Context & Settings
  const [studentContext, setStudentContext] = useState<string>('Student in training');
  const [targetJobRole, setTargetJobRole] = useState<string>('Full Stack Web Developer');
  const [voice, setVoice] = useState(VOICES[0].id);
  const [speed, setSpeed] = useState(SPEEDS[1].value);

  // Input modes
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');

  // States
  const [isRecording, setIsRecording] = useState(false);
  const [processingAI, setProcessingAI] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(true);
  const [replayingAudio, setReplayingAudio] = useState(false);

  // Conversation & Evaluation
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [turnCount, setTurnCount] = useState(1);
  const [showChatLog, setShowChatLog] = useState(false);
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);
  const [pastInterviews, setPastInterviews] = useState<MockInterviewType[]>([]);
  const [selectedPastInterview, setSelectedPastInterview] = useState<MockInterviewType | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'history'>('setup');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      try {
        const [dashData, gameSettings, historyData] = await Promise.all([
          getStudentDashboardData(user.id).catch(() => ({ modules: [], course: null, gamification: { streak: 0, coins: 0 }, upcomingClass: null })),
          getGamificationSettings().catch(() => []),
          getMockInterviewHistory(user.id).catch(() => [])
        ]);

        const costSetting = gameSettings.find((s: any) => s.task_type === 'ai_interview_cost');
        setInterviewCost(costSetting ? costSetting.reward_amount : 50);
        setCoinsAvailable(dashData?.gamification?.coins || 0);
        setPastInterviews(historyData);

        let contextStr = "Student taking a mock interview.";
        if (dashData?.modules && dashData.modules.length > 0) {
          const completedMods = dashData.modules.filter((m: any) => m.completedClasses > 0).map((m: any) => m.title);
          if (completedMods.length > 0) {
            contextStr = `Student has completed the following modules: ${completedMods.join(", ")}.`;
          }
        }
        setStudentContext(contextStr);
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user?.id]);

  const weeklyInterviewsTaken = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    return pastInterviews.filter(i => {
      if (!i.created_at) return false;
      const date = new Date(i.created_at);
      return !isNaN(date.getTime()) && date >= monday;
    }).length;
  }, [pastInterviews]);

  const isWeeklyLimitReached = weeklyInterviewsTaken >= 2;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const playAudioBase64 = (base64Str: string) => {
    if (!base64Str) { setIsAvatarSpeaking(false); setReplayingAudio(false); return; }
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = '';
      }
      const audioUrl = base64Str.startsWith('data:') ? base64Str : `data:audio/mp3;base64,${base64Str}`;
      const audio = new Audio(audioUrl);
      audio.playbackRate = speed;
      audioPlayerRef.current = audio;

      setIsAvatarSpeaking(true);
      audio.onended = () => {
        setIsAvatarSpeaking(false);
        setReplayingAudio(false);
      };
      audio.onerror = (e) => {
        console.error('Audio element error:', e);
        setIsAvatarSpeaking(false);
        setReplayingAudio(false);
        setTtsAvailable(false);
      };
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn('Audio play rejected:', e);
          setIsAvatarSpeaking(false);
          setReplayingAudio(false);
        });
      }
    } catch (e) {
      console.error('Audio playback error:', e);
      setIsAvatarSpeaking(false);
      setReplayingAudio(false);
    }
  };

  const replayLastAiResponse = async () => {
    const lastAi = [...chatHistory].reverse().find(m => m.role === 'ai');
    if (!lastAi || replayingAudio) return;
    setReplayingAudio(true);
    try {
      const audioBase64 = await textToSpeech(lastAi.content, voice);
      playAudioBase64(audioBase64);
    } catch (e) {
      console.error("Failed to replay audio", e);
      setReplayingAudio(false);
    }
  };

  const startInterview = async () => {
    if (isWeeklyLimitReached) {
      alert("Weekly limit reached! Students are allowed a maximum of 2 mock interviews per week. Your quota resets next week.");
      return;
    }
    if (!user) return;
    setPhase('interview');
    setChatHistory([]);
    setTurnCount(1);
    setTtsAvailable(true);
    setEvaluation(null);

    try {
      const { aiResponse, audioBase64 } = await getInitialInterviewAudio(studentContext, voice, targetJobRole);
      setChatHistory([{ role: 'ai', content: aiResponse }]);
      playAudioBase64(audioBase64);
    } catch (err) {
      console.error("Initial audio error", err);
      setChatHistory([{ role: 'ai', content: `Hello! Welcome. I'm Priya Sharma from HR. Please take a seat and introduce yourself for the ${targetJobRole} position.` }]);
      setTtsAvailable(false);
    } finally {
      setProcessingAI(false);
    }
  };

  const startRecording = async () => {
    if (isAvatarSpeaking || processingAI) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Switch to Text mode below if needed.');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
        await handleAudioSubmission(audioBlob);
      };
    }
  };

  const handleAudioSubmission = async (audioBlob: Blob) => {
    setProcessingAI(true);
    try {
      const { transcript, aiResponse, audioBase64 } = await processVoiceInterview(
        audioBlob, 
        chatHistory, 
        studentContext, 
        turnCount,
        voice,
        targetJobRole
      );
      
      const newHistory = [
        ...chatHistory,
        { role: 'user', content: transcript },
        { role: 'ai', content: aiResponse }
      ];
      setChatHistory(newHistory);
      setTurnCount(prev => prev + 1);
      if (audioBase64) playAudioBase64(audioBase64);
    } catch (err: any) {
      console.error('AI Processing error:', err);
      const isAudioErr = err?.message?.includes('understand');
      const fallbackMsg = isAudioErr 
        ? 'I did not quite catch that. Could you please repeat yourself clearly?'
        : 'I see. That is interesting. Could you elaborate a bit more on your technical experience?';
      setChatHistory(prev => [...prev, { role: 'ai', content: fallbackMsg }]);
    } finally {
      setProcessingAI(false);
    }
  };

  const handleTextSubmission = async () => {
    if (!textInput.trim() || processingAI || isAvatarSpeaking) return;
    const userMsg = textInput.trim();
    setTextInput('');
    setProcessingAI(true);

    const updatedHistory = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(updatedHistory);

    try {
      const { aiResponse, audioBase64 } = await processTextInterviewResponse(
        userMsg,
        chatHistory,
        studentContext,
        turnCount,
        voice,
        targetJobRole
      );
      setChatHistory([...updatedHistory, { role: 'ai', content: aiResponse }]);
      setTurnCount(prev => prev + 1);
      if (audioBase64) playAudioBase64(audioBase64);
    } catch (err) {
      console.error('Text response error:', err);
      setChatHistory([...updatedHistory, { role: 'ai', content: 'Thank you. Let us move to the next aspect of your experience.' }]);
    } finally {
      setProcessingAI(false);
    }
  };

  const finishInterview = async () => {
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    setIsAvatarSpeaking(false);
    setPhase('evaluating');

    try {
      const evalResult = await evaluateMockInterview(chatHistory, targetJobRole);
      setEvaluation(evalResult);

      const calculatedCoins = Math.min(turnCount * 5, 50);
      if (user) {
        await saveMockInterview({
          studentId: user.id,
          transcript: JSON.stringify(chatHistory),
          feedback: JSON.stringify(evalResult),
          score: evalResult.overallScore,
          coinsAwarded: calculatedCoins,
          evaluation: evalResult,
          targetRole: targetJobRole
        });
        
        // Refresh history
        const refreshedHistory = await getMockInterviewHistory(user.id);
        setPastInterviews(refreshedHistory);
      }
    } catch (e) {
      console.error("Error evaluating interview", e);
    } finally {
      setPhase('complete');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ─── Setup Screen ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="min-h-screen candy-map-bg p-4 md:p-8 flex flex-col items-center">
        <div className="max-w-4xl w-full space-y-6">
          {/* Header */}
          <div className="text-center space-y-2 candy-panel p-6 bg-white/80 dark:bg-black/60 backdrop-blur-md !border-2">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-3">
              <Mic className="w-8 h-8 text-blue-600 dark:text-blue-400" /> AI Mock Interview Room
            </h1>
            <p className="text-slate-600 dark:text-white/70 font-bold text-sm">
              Practice live interactive voice mock interviews with real-time feedback.
            </p>
          </div>

          {/* Navigation Tabs (New Interview vs Past Results) */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setActiveTab('setup')}
              className={`px-6 py-2.5 rounded-2xl font-black text-sm transition-all border-2 ${
                activeTab === 'setup'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                  : 'bg-white/60 dark:bg-black/40 text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10'
              }`}
            >
              Start New Session
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2.5 rounded-2xl font-black text-sm transition-all border-2 flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                  : 'bg-white/60 dark:bg-black/40 text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10'
              }`}
            >
              <History className="w-4 h-4" /> Past Reports ({pastInterviews.length})
            </button>
          </div>

          {activeTab === 'setup' ? (
            <div className="candy-panel p-6 md:p-8 space-y-6 !border-2">
              {/* Weekly Quota Limit Banner */}
              <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 candy-panel !border-2 rounded-2xl gap-4 ${
                isWeeklyLimitReached 
                  ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/40' 
                  : 'bg-blue-500/10 dark:bg-blue-950/40 border-blue-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    isWeeklyLimitReached ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Weekly Quota (2 / Week)</p>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        isWeeklyLimitReached ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      }`}>
                        {weeklyInterviewsTaken} / 2 Completed
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {isWeeklyLimitReached 
                        ? 'Weekly limit reached (2/2 sessions completed this week). Quota resets next Monday!'
                        : `${2 - weeklyInterviewsTaken} mock interview session${2 - weeklyInterviewsTaken === 1 ? '' : 's'} available for this week.`}
                    </p>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-bold text-slate-400">Twice per week limit</span>
                </div>
              </div>

              {/* Target Job Role Presets & Custom Input */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-slate-600 dark:text-white/70 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-blue-500" /> Target Job Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Full Stack Web Developer, Data Scientist..."
                  value={targetJobRole}
                  onChange={(e) => setTargetJobRole(e.target.value)}
                  className="w-full candy-panel !border-2 px-4 py-3 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-blue-400 transition-all bg-white/70 dark:bg-black/50"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {ROLE_PRESETS.map(role => (
                    <button
                      key={role}
                      onClick={() => setTargetJobRole(role)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all border ${
                        targetJobRole === role
                          ? 'bg-blue-500 text-white border-blue-400'
                          : 'bg-white/50 dark:bg-black/30 text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10 hover:border-blue-300'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interviewer Persona Selection */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-slate-600 dark:text-white/70 uppercase tracking-wider">
                  <Settings className="w-4 h-4 text-blue-500" /> HR Interviewer Voice & Persona
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {VOICES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setVoice(v.id)}
                      className={`candy-panel p-4 text-left transition-all !border-2 ${
                        voice === v.id 
                          ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 dark:border-blue-400' 
                          : 'bg-white/50 dark:bg-black/30 border-slate-200 dark:border-white/10 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-black text-slate-900 dark:text-white text-sm">{v.name}</div>
                      <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5 font-bold">{v.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed Selector */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-slate-600 dark:text-white/70 uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-cyan-500" /> Speech Speed
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {SPEEDS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setSpeed(s.value)}
                      className={`candy-panel p-3 text-center text-sm font-black transition-all !border-2 ${
                        speed === s.value 
                          ? 'border-cyan-500 bg-cyan-50/80 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' 
                          : 'bg-white/50 dark:bg-black/30 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-cyan-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Action */}
              <button
                onClick={startInterview}
                disabled={processingAI || isWeeklyLimitReached || !targetJobRole.trim()}
                className={`w-full py-4 candy-btn-blue text-base md:text-lg font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isWeeklyLimitReached ? '!bg-slate-700 !border-slate-600 text-slate-300' : ''
                }`}
              >
                {isWeeklyLimitReached ? (
                  <>
                    <XCircle className="w-5 h-5" />
                    Weekly Limit Reached (2 / 2 Sessions Completed)
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    Start AI Mock Interview ({weeklyInterviewsTaken}/2 Used)
                  </>
                )}
              </button>
            </div>
          ) : (
            /* History Tab */
            <div className="candy-panel p-6 space-y-4 !border-2">
              <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" /> Your Previous Mock Interviews
              </h3>
              {pastInterviews.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-white/40 font-bold">
                  No mock interviews completed yet. Start your first session above!
                </div>
              ) : (
                <div className="space-y-3">
                  {pastInterviews.map((item) => {
                    let parsedEval: any = null;
                    try { parsedEval = JSON.parse(item.feedback); } catch(e){}
                    return (
                      <div key={item.id} className="p-4 candy-panel bg-white/60 dark:bg-black/40 !border-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 dark:text-white text-base">
                              {parsedEval?.targetRole || 'Mock Interview Session'}
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-300 font-bold border border-blue-500/30">
                              Score: {item.score?.toFixed(1)}/10
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-white/50 mt-1 font-medium">
                            Completed on {new Date(item.created_at).toLocaleDateString()} • {item.coins_awarded} coins earned
                          </p>
                          {parsedEval?.summary && (
                            <p className="text-xs text-slate-700 dark:text-white/70 mt-2 font-medium italic">
                              "{parsedEval.summary}"
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedPastInterview(item)}
                          className="px-4 py-2 text-xs candy-btn text-blue-600 dark:text-blue-400 font-black"
                        >
                          View Report
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Past Interview Modal */}
          {selectedPastInterview && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="max-w-2xl w-full candy-panel p-6 space-y-4 max-h-[85vh] overflow-y-auto bg-slate-900 text-white !border-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="font-black text-xl text-blue-400">Past Interview Report</h3>
                  <button onClick={() => setSelectedPastInterview(null)} className="p-1 rounded-lg hover:bg-white/10">
                    <XCircle className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 candy-panel bg-white/10 text-center">
                      <div className="text-xl font-black text-blue-400">{selectedPastInterview.score?.toFixed(1)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Overall</div>
                    </div>
                    <div className="p-3 candy-panel bg-white/10 text-center">
                      <div className="text-xl font-black text-green-400">+{selectedPastInterview.coins_awarded}</div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Coins</div>
                    </div>
                    <div className="p-3 candy-panel bg-white/10 text-center col-span-2">
                      <div className="text-xs font-black text-slate-300">{new Date(selectedPastInterview.created_at).toLocaleString()}</div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Date</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs uppercase font-black tracking-wider text-blue-300 mb-1">Transcript & Details</h4>
                    <pre className="text-xs bg-black/50 p-4 rounded-xl text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono max-h-60">
                      {selectedPastInterview.transcript}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Evaluating Phase ─────────────────────────────────────────────────────────
  if (phase === 'evaluating') {
    return (
      <div className="min-h-screen candy-map-bg flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full candy-panel p-8 text-center space-y-6 bg-white/80 dark:bg-black/70 backdrop-blur-md !border-2">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Analyzing Your Responses...</h2>
          <p className="text-sm font-bold text-slate-600 dark:text-white/60">
            Our AI HR Director is evaluating your technical accuracy, communication style, and confidence score.
          </p>
        </div>
      </div>
    );
  }

  // ─── Evaluation Results Phase ──────────────────────────────────────────────────
  if (phase === 'complete') {
    const score = evaluation?.overallScore || 7.5;
    const grade = score >= 8.5 ? 'Exceptional Candidate' : score >= 7.0 ? 'High Potential' : 'Needs Practice';

    return (
      <div className="min-h-screen candy-map-bg p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-2xl w-full candy-panel p-6 md:p-8 space-y-6 !border-2 bg-white/90 dark:bg-black/90 backdrop-blur-xl">
          <div className="text-center space-y-2">
            <div className="mx-auto w-20 h-20 bg-blue-100 dark:bg-blue-500/20 rounded-3xl flex items-center justify-center border-2 border-blue-300 dark:border-blue-500/40">
              <Award className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Interview Performance Report</h2>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400 tracking-wide uppercase">{grade} • {targetJobRole}</p>
          </div>

          {/* Breakdown Score Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="candy-panel p-4 bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-center">
              <div className="text-2xl font-black text-blue-600 dark:text-blue-300">{evaluation?.overallScore?.toFixed(1) || '7.5'}</div>
              <div className="text-[10px] font-black uppercase text-slate-500 dark:text-white/50">Overall Score</div>
            </div>
            <div className="candy-panel p-4 bg-sky-50/80 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-center">
              <div className="text-2xl font-black text-sky-600 dark:text-sky-300">{evaluation?.technicalScore?.toFixed(1) || '7.0'}</div>
              <div className="text-[10px] font-black uppercase text-slate-500 dark:text-white/50">Technical Depth</div>
            </div>
            <div className="candy-panel p-4 bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-center">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-300">{evaluation?.communicationScore?.toFixed(1) || '8.0'}</div>
              <div className="text-[10px] font-black uppercase text-slate-500 dark:text-white/50">Communication</div>
            </div>
            <div className="candy-panel p-4 bg-yellow-50/80 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-center">
              <div className="text-2xl font-black text-yellow-600 dark:text-yellow-400">+{Math.min(turnCount * 5, 50)}</div>
              <div className="text-[10px] font-black uppercase text-slate-500 dark:text-white/50">Coins Earned</div>
            </div>
          </div>

          {/* AI Feedback Cards */}
          <div className="space-y-4">
            {evaluation?.summary && (
              <div className="p-4 candy-panel bg-slate-50 dark:bg-zinc-900/80 !border-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-white/50 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-500" /> Executive Summary
                </h4>
                <p className="text-sm font-bold text-slate-800 dark:text-white/90 leading-relaxed">{evaluation.summary}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 candy-panel bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">Key Strengths</h4>
                <ul className="space-y-1 text-xs font-bold text-slate-700 dark:text-emerald-200 list-disc list-inside">
                  {(evaluation?.strengths || ['Clear communication', 'Good technical foundation']).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 candy-panel bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">Areas for Improvement</h4>
                <ul className="space-y-1 text-xs font-bold text-slate-700 dark:text-amber-200 list-disc list-inside">
                  {(evaluation?.improvements || ['Add specific metrics to project answers']).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            {evaluation?.recommendations && (
              <div className="p-4 candy-panel bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">HR Recommendation</h4>
                <p className="text-xs font-bold text-slate-800 dark:text-blue-200">{evaluation.recommendations}</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => { setPhase('setup'); setActiveTab('setup'); }} 
            className="w-full py-4 candy-btn-blue text-base font-black flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" /> Start Another Interview
          </button>
        </div>
      </div>
    );
  }

  // ─── Active Interview Room ─────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-4rem)] bg-black flex flex-col relative overflow-hidden page-container select-none">
      {/* Subtle Background Scenery */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 blur-2xl scale-110"
        style={{ backgroundImage: 'url(/interview-bg.png)' }}
      />
      
      {/* TTS Status Banner */}
      {!ttsAvailable && (
        <div className="absolute top-0 left-0 w-full z-40 bg-amber-500/90 backdrop-blur-md text-black px-4 py-2 text-center text-xs font-black shadow-lg">
          🔇 Audio unavailable — running in text-only mode. Use text bar below to respond.
        </div>
      )}

      {/* Top Left Header Info */}
      <div className="absolute top-4 left-4 z-30 candy-panel bg-white/80 dark:bg-black/60 backdrop-blur-md px-4 py-2.5 !border-2 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl overflow-hidden bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center border border-blue-200 dark:border-blue-500/30">
          <Avatar2D isSpeaking={false} size={36} gender={voice.includes('asteria') ? 'female' : 'male'} />
        </div>
        <div>
          <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Live AI Interview</p>
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{targetJobRole}</p>
        </div>
      </div>

      {/* Top Right Self View PiP */}
      <div className="absolute top-4 right-4 z-30 w-28 h-36 md:w-40 md:h-52 candy-panel overflow-hidden !border-2 shadow-2xl flex items-center justify-center bg-zinc-900">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
          <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center mb-1">
            <span className="text-lg">👤</span>
          </div>
          <span className="text-[10px] font-black text-zinc-400">Candidate</span>
        </div>
        <div className="absolute top-2 right-2 bg-black/70 p-1 rounded-md backdrop-blur-sm">
          {isRecording ? <Mic className="w-3 h-3 text-red-500 animate-pulse" /> : <Mic className="w-3 h-3 text-zinc-400" />}
        </div>
      </div>

      {/* Center Avatar Display */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full h-full pb-36 px-4">
        <div className={`transition-all duration-500 ease-in-out ${isAvatarSpeaking ? 'scale-110 drop-shadow-[0_0_40px_rgba(59,130,246,0.4)]' : 'scale-100'}`}>
          <Avatar2D isSpeaking={isAvatarSpeaking} size={260} gender={voice.includes('asteria') ? 'female' : 'male'} />
        </div>
        
        {/* Status Indicator */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest candy-panel px-5 py-2.5 !border-2 shadow-xl bg-white/80 dark:bg-zinc-900/90 text-slate-900 dark:text-white">
          {processingAI ? (
            <><Loader2 className="w-4 h-4 text-blue-500 animate-spin" /><span className="text-blue-600 dark:text-blue-400">AI Thinking...</span></>
          ) : isAvatarSpeaking ? (
            <><div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" /><span className="text-cyan-600 dark:text-cyan-400">Interviewer Speaking</span></>
          ) : (
            <><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">Your Turn (Speak or Type Below)</span></>
          )}
        </div>
      </div>

      {/* Captions Box (positioned right above control bar) */}
      {chatHistory.length > 0 && !showChatLog && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20 pointer-events-none">
          <div className="bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Interviewer Says:</span>
              <button
                onClick={replayLastAiResponse}
                disabled={replayingAudio || isAvatarSpeaking || processingAI}
                className="flex items-center gap-1 text-[11px] font-black bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 px-2.5 py-0.5 rounded-full border border-blue-500/30 transition-all disabled:opacity-50"
              >
                {replayingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                <span>Replay Voice</span>
              </button>
            </div>
            <p className="text-sm md:text-base text-white font-medium leading-relaxed">
              {chatHistory.filter(m => m.role === 'ai').slice(-1)[0]?.content || ''}
            </p>
          </div>
        </div>
      )}

      {/* Transcript Side Drawer & Backdrop Overlay */}
      {showChatLog && (
        <div 
          onClick={() => setShowChatLog(false)} 
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity"
        />
      )}
      
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-96 z-50 transform transition-transform duration-300 ease-in-out bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col ${
          showChatLog ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950">
          <h3 className="font-black text-base text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" /> Interview Transcript
          </h3>
          <button 
            onClick={() => setShowChatLog(false)} 
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-black uppercase text-slate-400 mb-1">
                {msg.role === 'user' ? 'You' : 'Interviewer'}
              </span>
              <div className={`p-3 rounded-2xl max-w-[85%] text-xs font-medium shadow-md ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-zinc-800 text-white border border-zinc-700 rounded-bl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Floating Control Bar (z-50 guarantees buttons are always accessible) */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 flex flex-col items-center gap-3">
        {inputMode === 'text' ? (
          <div className="w-full flex items-center gap-2 bg-zinc-900/95 backdrop-blur-2xl p-2 rounded-2xl border border-zinc-700/80 shadow-2xl">
            <input
              type="text"
              placeholder="Type your response to the interviewer..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSubmission()}
              disabled={processingAI || isAvatarSpeaking}
              className="flex-1 bg-transparent px-3 py-2 text-white font-medium placeholder:text-zinc-500 focus:outline-none text-sm"
              autoFocus
            />
            <button
              onClick={handleTextSubmission}
              disabled={!textInput.trim() || processingAI || isAvatarSpeaking}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-40"
              title="Send Response"
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              onClick={() => setInputMode('voice')}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              Voice Mode
            </button>
          </div>
        ) : (
          <div className="bg-zinc-900/95 backdrop-blur-2xl px-6 py-3 rounded-full border border-zinc-700/60 shadow-2xl flex items-center justify-center gap-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isAvatarSpeaking || processingAI}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all group ${
                isAvatarSpeaking || processingAI
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : isRecording
                  ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.7)] scale-95'
                  : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
              }`}
              title={isRecording ? "Click to Stop & Send" : "Click to Speak"}
            >
              {processingAI ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Mic className={`w-6 h-6 ${isRecording ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
              )}
            </button>

            <button
              onClick={() => setInputMode('text')}
              className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-full transition-all text-xs font-bold flex items-center gap-1.5"
              title="Switch to Text Input Mode"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden md:inline">Type</span>
            </button>

            <button
              onClick={() => setShowChatLog(!showChatLog)}
              className={`p-3 rounded-full transition-all text-xs font-bold ${
                showChatLog ? 'bg-blue-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
              title="Toggle Transcript Drawer"
            >
              <History className="w-4 h-4" />
            </button>

            <button 
              onClick={finishInterview}
              className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-full transition-all shadow-lg active:scale-95"
              title="End Interview & View AI Report"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
