import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ExternalLink, ArrowRight, PhoneOff, Loader2, RefreshCw } from 'lucide-react';

interface JitsiMeetProps {
  roomName: string;
  displayName?: string;
  classId: string;
  onClassEnded: () => void; // called when teacher ends class in DB
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function JitsiMeet({ roomName, displayName = 'Student', classId, onClassEnded }: JitsiMeetProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const apiRef  = useRef<any>(null);

  const [phase, setPhase] = useState<
    'loading-script' | 'initializing' | 'in-meeting' | 'teacher-left' | 'class-ended' | 'failed'
  >('loading-script');

  const [pollCount, setPollCount] = useState(0);

  // ── Poll DB every 8s for class status change ─────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Dynamic import to avoid circular deps
        const { checkClassStatus } = await import('../lib/api/student');
        const status = await checkClassStatus(classId);
        if (status === 'completed') {
          clearInterval(interval);
          setPhase('class-ended');
          setTimeout(() => onClassEnded(), 2000);
        }
      } catch { /* network error — ignore */ }
      setPollCount(c => c + 1);
    }, 8000);

    return () => clearInterval(interval);
  }, [classId]);

  // ── Init Jitsi ────────────────────────────────────────────────────────────
  const initJitsi = useCallback(() => {
    if (!wrapRef.current) return;

    // Get REAL rendered pixel size
    const rect = wrapRef.current.getBoundingClientRect();
    const w = Math.max(Math.round(rect.width),  320);
    const h = Math.max(Math.round(rect.height), 400);

    setPhase('initializing');

    try {
      if (apiRef.current) { try { apiRef.current.dispose(); } catch {} apiRef.current = null; }

      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode : wrapRef.current,
        width      : w,
        height     : h,
        configOverwrite: {
          prejoinPageEnabled     : false,
          prejoinConfig          : { enabled: false },
          startWithAudioMuted    : true,
          startWithVideoMuted    : false,
          disableDeepLinking     : true,
          disableInviteFunctions : true,
          hideConferenceSubject  : true,
          enableNoisyMicDetection: false,
          // Force tile view so student sees teacher screen share immediately
          startAudioOnly         : false,
          disableTileView        : false,
          defaultRemoteDisplayName: 'Teacher',
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: ['microphone', 'camera', 'chat', 'raisehand', 'tileview', 'fullscreen', 'hangup'],
          SHOW_JITSI_WATERMARK      : false,
          SHOW_BRAND_WATERMARK      : false,
          SHOW_WATERMARK_FOR_GUESTS : false,
          SHOW_POWERED_BY           : false,
          HIDE_INVITE_MORE_HEADER   : true,
          APP_NAME                  : 'CynexAI Live',
          DISPLAY_WELCOME_PAGE_CONTENT: false,
          MOBILE_APP_PROMO          : false,
        },
        userInfo: { displayName },
      });

      // Force the Jitsi-created iframe to fill 100% of wrapper
      setTimeout(() => {
        const iframe = wrapRef.current?.querySelector('iframe');
        if (iframe) {
          iframe.style.width    = '100%';
          iframe.style.height   = '100%';
          iframe.style.position = 'absolute';
          iframe.style.top      = '0';
          iframe.style.left     = '0';
          iframe.style.border   = 'none';
        }
        setPhase('in-meeting');
      }, 500);

      apiRef.current.addEventListeners({
        videoConferenceJoined: () => setPhase('in-meeting'),
        participantLeft: (e: any) => {
          // If teacher left (we detect because they're the only other one)
          const count = apiRef.current?.getNumberOfParticipants?.() ?? 1;
          if (count <= 1) setPhase('teacher-left');
        },
        videoConferenceLeft: () => {
          // Student chose to hang up
          onClassEnded();
        },
        errorOccurred: () => setPhase('failed'),
      });

    } catch (err) {
      console.error('Jitsi error:', err);
      setPhase('failed');
    }
  }, [roomName, displayName]);

  // ── Load External API script then boot ────────────────────────────────────
  useEffect(() => {
    let alive = true;

    function tryBoot() {
      if (!alive) return;
      // Wait one frame so the DOM has real dimensions
      requestAnimationFrame(() => {
        if (alive) initJitsi();
      });
    }

    if (window.JitsiMeetExternalAPI) {
      tryBoot();
    } else {
      let script = document.getElementById('jitsi-ext-api') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id  = 'jitsi-ext-api';
        script.src = 'https://meet.jit.si/external_api.js';
        document.head.appendChild(script);
      }
      script.addEventListener('load',  () => { if (alive) tryBoot(); });
      script.addEventListener('error', () => { if (alive) setPhase('failed'); });
      if ((script as any).__loaded) tryBoot();
      script.addEventListener('load', () => { (script as any).__loaded = true; });
    }

    return () => {
      alive = false;
      if (apiRef.current) { try { apiRef.current.dispose(); } catch {} apiRef.current = null; }
    };
  }, [roomName]);

  const rejoin = () => { setPhase('loading-script'); initJitsi(); };

  const directUrl = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.startWithAudioMuted=true`;

  return (
    // Component overlay — fills its parent container
    <div className="absolute inset-0 bg-[#0a0a14] flex flex-col rounded-2xl overflow-hidden">

      {/* Thin top bar — room name + "class ended" indicator */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${phase === 'in-meeting' ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-white/70 text-xs font-mono truncate">{roomName}</span>
        </div>
        {phase === 'teacher-left' && (
          <span className="text-yellow-400 text-xs font-bold animate-pulse">⚠ Teacher stepped away</span>
        )}
        {phase === 'class-ended' && (
          <span className="text-green-400 text-xs font-bold">✓ Class ended</span>
        )}
      </div>

      {/* Jitsi container — fills entire remaining screen */}
      <div ref={wrapRef} className="flex-1 relative overflow-hidden">

        {/* Loading: script downloading */}
        {(phase === 'loading-script' || phase === 'initializing') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20">
            <div className="w-14 h-14 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-white font-bold text-base">Joining live class…</p>
              <p className="text-slate-500 text-sm mt-1">Setting up your connection</p>
            </div>
            <p className="text-slate-600 text-xs">Room: {roomName}</p>
          </div>
        )}

        {/* Teacher stepped away */}
        {phase === 'teacher-left' && (
          <div className="absolute top-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <div className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-sm font-bold px-4 py-2 rounded-full backdrop-blur">
              ⚠ Teacher stepped away — please wait
            </div>
          </div>
        )}

        {/* Class ended — auto-redirect */}
        {phase === 'class-ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-20 bg-[#0a0a14]">
            <div className="text-6xl">🏁</div>
            <div className="text-center">
              <h2 className="text-white font-bold text-xl mb-1">Class has ended!</h2>
              <p className="text-slate-400 text-sm">Your teacher wrapped up. Continuing to quiz…</p>
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-bold">Redirecting…</span>
            </div>
          </div>
        )}

        {/* Failed — show fallback */}
        {phase === 'failed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center z-20">
            <div className="text-5xl">📡</div>
            <div>
              <p className="text-white font-bold text-lg mb-1">Meeting couldn't load</p>
              <p className="text-slate-400 text-sm">Your browser may be blocking the camera or microphone.</p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={rejoin}
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
              <a
                href={directUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Open in Browser
              </a>
            </div>
            <p className="text-slate-600 text-xs">Room: {roomName}</p>
          </div>
        )}
      </div>

      {/* Bottom action strip */}
      {phase === 'in-meeting' && (
        <div className="shrink-0 flex items-center justify-center gap-4 p-3 bg-black/60 backdrop-blur">
          <button
            onClick={() => { if (apiRef.current) { try { apiRef.current.executeCommand('hangup'); } catch {} } }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors"
          >
            <PhoneOff className="w-4 h-4" /> Leave Meeting
          </button>
          <button
            onClick={onClassEnded}
            className="flex items-center gap-2 text-slate-400 hover:text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors bg-white/5 hover:bg-white/10"
          >
            Skip to Quiz <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
