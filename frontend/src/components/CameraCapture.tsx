import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize camera stream
  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn("Camera access denied or unavailable. Loading simulation fallback.", err);
      setError("Camera hardware not detected. Using high-resolution cargo mockup.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (error) {
      // Simulate photo selection using stock shipping container image
      setCapturedImage("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        
        // Stop the stream to save resources since we snapped
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[999] flex flex-col justify-between p-4 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex justify-between items-center text-white p-2">
        <h4 className="font-bold text-sm tracking-wide">Document Scan & POD Capture</h4>
        <button 
          type="button"
          onClick={onClose} 
          className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <XCircle className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-xl bg-black border border-slate-800 my-4 shadow-inner">
        {capturedImage ? (
          <img src={capturedImage} alt="Captured preview" className="max-h-full max-w-full object-contain" />
        ) : error ? (
          <div className="text-center p-6 text-slate-400 max-w-xs flex flex-col items-center gap-3">
            <Camera className="w-12 h-12 text-slate-600 animate-pulse" />
            <p className="text-xs font-semibold">{error}</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">System has pre-loaded a high-fidelity logistics cargo payload mockup. Click 'Snap Frame' below to confirm upload.</p>
          </div>
        ) : (
          <video 
            ref={videoRef}
            autoPlay 
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-100"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Footer Controls */}
      <div className="flex justify-center items-center gap-6 p-4">
        {capturedImage ? (
          <>
            <button 
              type="button"
              onClick={handleRetake}
              className="px-5 py-2.5 rounded-full border border-white/20 text-white font-semibold text-xs hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retake
            </button>
            <button 
              type="button"
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Confirm Image
            </button>
          </>
        ) : (
          <button 
            type="button"
            onClick={handleCapture}
            className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            title="Snap Frame"
          >
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
