import React, { useEffect, useState, useRef } from 'react';
import { Card } from '../../components/ui/erp/Card';
import { Button } from '../../components/ui/erp/Button';
import { 
  QrCode, ArrowLeft, CheckCircle, AlertCircle, Key, Send, 
  Camera, RefreshCw, X, Sparkles, Video, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { getCurrentUser } from '../../lib/auth';
import { getStudentMode } from '../../lib/api/student';
import { logQRAttendance } from '../../lib/api/teacher';

export default function AttendancePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [scanning, setScanning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [studentMode, setStudentMode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (user?.id) {
      getStudentMode(user.id).then(mode => setStudentMode(mode));
    }
  }, [user?.id]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
    setCameraLoading(false);
  };

  const startScanner = async () => {
    setResult(null);
    setCameraError(null);
    setScanning(true);
    setCameraLoading(true);

    // Allow DOM to mount the #qr-reader viewport
    setTimeout(async () => {
      try {
        const qrElement = document.getElementById("qr-reader");
        if (!qrElement) {
          setCameraError("Camera display container could not be initialized.");
          setCameraLoading(false);
          return;
        }

        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        const onScanSuccess = async (decodedText: string) => {
          try {
            if (navigator.vibrate) navigator.vibrate(200);
          } catch {}

          await stopScanner();

          try {
            let classId = decodedText;
            try {
              const data = JSON.parse(decodedText);
              classId = data.classId || data.token || decodedText;
            } catch (e) {}

            if (classId && user) {
              await logQRAttendance(user.id, classId);
              setResult({ success: true, message: 'Attendance marked successfully via Classroom QR Scanner!' });
            } else {
              setResult({ success: false, message: 'Invalid QR code format. Please scan classroom QR code.' });
            }
          } catch (e) {
            console.error(e);
            setResult({ success: false, message: 'Failed to record attendance. Please try again or use the session code.' });
          }
        };

        const onScanError = () => {
          // Ignore continuous frame decode misses
        };

        try {
          // 1. Prioritize back/environment camera directly
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
          );
          setCameraLoading(false);
        } catch (envErr) {
          // 2. Fallback to any available camera device (e.g. laptop webcam)
          const cameras = await Html5Qrcode.getCameras().catch(() => []);
          if (cameras && cameras.length > 0) {
            await html5QrCode.start(
              cameras[0].id,
              config,
              onScanSuccess,
              onScanError
            );
            setCameraLoading(false);
          } else {
            throw new Error("No camera found on this device or permission was denied. Please allow camera access in browser settings.");
          }
        }
      } catch (err: any) {
        console.error("Camera initialization error:", err);
        setCameraError(err?.message || "Could not open camera. Please grant camera permission in your browser.");
        setCameraLoading(false);
      }
    }, 200);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleManualCheckIn = async () => {
    if (!manualCode.trim() || !user) return;
    setSubmittingManual(true);
    setResult(null);

    try {
      await logQRAttendance(user.id, manualCode.trim());
      setResult({ success: true, message: 'Attendance marked successfully via session code!' });
      setManualCode('');
    } catch (e) {
      setResult({ success: false, message: 'Failed to check in. Please verify the session code.' });
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div className="min-h-screen candy-map-bg text-slate-900 dark:text-white p-4 md:p-8 pb-28 selection:bg-indigo-500/30">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Attendance Check-In
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-display text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5 mt-0.5">
              <QrCode className="w-7 h-7 text-blue-600 dark:text-blue-400" /> Offline & Hybrid Check-In
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Scan classroom QR code with your camera or enter session check-in token.
            </p>
          </div>
        </div>

        {/* Result Notification Banner */}
        {result && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 border shadow-md animate-in fade-in slide-in-from-top-2 duration-300 ${
            result.success 
              ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-700 dark:text-emerald-300' 
              : 'bg-red-500/10 dark:bg-red-950/40 border-red-500/40 text-red-700 dark:text-red-300'
          }`}>
            {result.success ? (
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
            )}
            <p className="font-bold text-xs md:text-sm">{result.message}</p>
          </div>
        )}

        {/* QR Scanner Card */}
        <div className="candy-panel p-6 md:p-8 !border-2 flex flex-col items-center shadow-xl">
          
          {!scanning ? (
            <div className="w-full text-center py-4 space-y-4">
              <div className="w-20 h-20 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/20 shadow-inner">
                <Camera className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Classroom Live Camera QR Scanner</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Click below to open your device camera and scan the QR code displayed on the classroom screen.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={startScanner}
                  className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 mx-auto shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" /> Start Live Camera Scanner
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">Live Camera QR Scanner</h3>
                </div>
                <button
                  onClick={stopScanner}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <X className="w-3.5 h-3.5" /> Close Camera
                </button>
              </div>

              {/* Live Camera Viewport */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-blue-500/40 bg-black shadow-2xl flex flex-col items-center justify-center min-h-[320px]">
                {cameraLoading && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 text-white gap-3 p-4 text-center">
                    <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-300">Accessing Device Camera...</p>
                    <p className="text-[11px] text-slate-400">Please grant camera permissions when prompted.</p>
                  </div>
                )}

                {cameraError ? (
                  <div className="p-6 text-center space-y-3 text-white">
                    <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                    <p className="text-sm font-bold text-amber-300">{cameraError}</p>
                    <button
                      onClick={startScanner}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black shadow-md"
                    >
                      Retry Camera
                    </button>
                  </div>
                ) : (
                  <div id="qr-reader" className="w-full max-w-[360px] mx-auto"></div>
                )}
              </div>

              <p className="text-center text-[11px] text-slate-400 font-medium">
                Point your camera directly at the classroom QR code to check in automatically.
              </p>
            </div>
          )}
        </div>

        {/* Manual Session Token Fallback Card */}
        <div className="candy-panel p-6 md:p-8 !border-2 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Manual Session Token Input
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If your camera is unavailable or permissions are restricted, enter the 6-character session code displayed by your teacher.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <input
              type="text"
              placeholder="e.g. class_123 or session_token..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualCheckIn()}
              className="w-full sm:flex-1 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-800 px-4 py-3 rounded-xl text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleManualCheckIn}
              disabled={!manualCode.trim() || submittingManual}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            >
              {submittingManual ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Check In</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
