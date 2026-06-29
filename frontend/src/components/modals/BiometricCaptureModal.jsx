import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { X, Camera, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

const BiometricCaptureModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useSelector((state) => state.auth);
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let activeStream = null;
    let isMounted = true;

    const startCamera = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Camera initialization failed:', err);
        setError('Camera access is required for biometric validation. Please ensure webcam permissions are allowed and no other app is using it.');
        setIsLoading(false);
      }
    };

    startCamera();

    // Kill switch return function to shut down the physical camera lens immediately on unmount
    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCapture = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the current video frame on the canvas scaled down to 320x240
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        // Export to Base64 JPEG at 60% compression quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);

        // Immediate cleanup of camera stream
        if (videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        }

        onSuccess(compressedBase64);
      }
    } catch (err) {
      console.error('Failed to capture frame:', err);
      setError('Frame capture failed. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#172B4D]">
                Worksite Biometric Gate
              </h3>
              <p className="text-xs text-[#6B778C]">
                Live identity verification required for immutable shift log
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6B778C] transition-colors hover:bg-slate-200/70 hover:text-[#172B4D]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* User Context Badge */}
          <div className="flex items-center gap-3 bg-slate-50/60 p-3 rounded-lg border border-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A89CD] text-sm font-bold text-white shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#172B4D]">
                {user?.name || 'Employee'}
              </p>
              <p className="text-xs font-mono text-[#6B778C]">
                {user?.employeeId || 'YT-EMP-—'}
              </p>
            </div>
          </div>

          {/* Camera Viewport */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border-2 border-slate-200 bg-slate-950 flex items-center justify-center">
            {isLoading && (
              <div className="flex flex-col items-center gap-2.5 text-slate-400">
                <Loader2 className="h-7 w-7 animate-spin text-[#0A89CD]" />
                <span className="text-xs font-semibold">Initializing camera stream...</span>
              </div>
            )}

            {error && (
              <div className="mx-6 flex flex-col items-center text-center gap-2 text-rose-500">
                <AlertCircle className="h-8 w-8 text-rose-500" />
                <p className="text-xs font-bold leading-relaxed">{error}</p>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover transform -scale-x-100 ${
                isLoading || error ? 'hidden' : 'block'
              }`}
            />

            {/* Face Guideline Overlay */}
            {!isLoading && !error && (
              <>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-[75%] w-[60%] rounded-[50%] border-2 border-dashed border-emerald-400/80 bg-emerald-500/[0.02]" />
                </div>
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 rounded-full bg-slate-900/85 px-3 py-1 text-[9px] font-bold text-slate-200 uppercase tracking-widest pointer-events-none flex items-center gap-1 shadow-sm border border-slate-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  🔒 End-to-End Encrypted Frame
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-5">
          <button
            onClick={handleCapture}
            disabled={isLoading || !!error}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0A89CD] py-3 text-sm font-semibold text-white shadow-md shadow-blue-200/50 transition-all duration-200 hover:bg-[#0873AB] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            <span>Capture & Authorize Punch</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BiometricCaptureModal;
