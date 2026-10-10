import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, CheckCircle, AlertCircle, RefreshCw, Upload } from 'lucide-react';
import jsQR from 'jsqr';
import { Student, StepType, JOURNEY_STEPS } from '../../types';
import { dbStore } from '../../services/dbStore';
import { playAlertChime } from '../../services/soundService';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  step?: StepType; // Optional: If omitted, auto-detects student's next required step
  onScanSuccess: (student: Student, notes?: string, resolvedStep?: StepType) => void;
  allowedClass?: string;     // Optional filter for teacher
  schoolId?: string;         // School isolation
  targetStudentId?: string;  // Specific student lock (e.g. for Parent)
  parentMode?: boolean;      // Parent specific scanning logic
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  step,
  onScanSuccess,
  allowedClass,
  schoolId,
  targetStudentId,
  parentMode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [activeResolvedStep, setActiveResolvedStep] = useState<StepType>(step || 1);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const stepDef = step ? JOURNEY_STEPS[step] : JOURNEY_STEPS[activeResolvedStep];

  // Stop camera stream safely
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCodeFound = async (token: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const student = dbStore.getStudentByQR(token.trim());
    if (!student) {
      setScanMessage(`अमान्य QR कोड: "${token}"`);
      setTimeout(() => setIsProcessing(false), 2000);
      return;
    }

    // Check specific target student (Parent Dashboard child isolation)
    if (targetStudentId && student.id !== targetStudentId) {
      setScanMessage(`यह QR कोड आपके पंजीकृत बच्चे का नहीं है! कृपया सही आईडी कार्ड स्कैन करें।`);
      setTimeout(() => setIsProcessing(false), 2500);
      return;
    }

    // Check school isolation
    if (schoolId && student.schoolId !== schoolId) {
      setScanMessage('यह छात्र इस स्कूल का नहीं है!');
      setTimeout(() => setIsProcessing(false), 2500);
      return;
    }

    // Check class filter (Teacher dashboard)
    if (allowedClass && student.className !== allowedClass) {
      setScanMessage(`यह छात्र ${student.className} का है, जबकि यह ${allowedClass} की कक्षा है।`);
      setTimeout(() => setIsProcessing(false), 2500);
      return;
    }

    // Resolve Step to record
    let targetStep: StepType;

    if (step) {
      targetStep = step;
    } else {
      // Auto-detect next step for this student
      const nextInfo = dbStore.getNextStepForStudent(student.id);
      if (nextInfo.isComplete) {
        setScanMessage(`✅ छात्र "${student.name}" के आज के सभी 5 चरण पूर्ण हो चुके हैं! दोहराव (Double Scan) की अनुमति नहीं है।`);
        setTimeout(() => setIsProcessing(false), 3000);
        return;
      }

      if (!nextInfo.nextStep) {
        setScanMessage(`आज की यात्रा पूरी है। दोहराव नहीं हो सकता।`);
        setTimeout(() => setIsProcessing(false), 2500);
        return;
      }

      if (parentMode) {
        if (nextInfo.nextStep === 1) {
          targetStep = 1;
        } else if (nextInfo.nextStep === 5) {
          targetStep = 5;
        } else {
          setScanMessage(
            `चरण 1 (घर से प्रस्थान) पहले ही पूर्ण है। चरण ${nextInfo.nextStep} (${JOURNEY_STEPS[nextInfo.nextStep].titleHi}) स्कूल गेट / कक्षा में स्कैन होगा।`
          );
          setTimeout(() => setIsProcessing(false), 3500);
          return;
        }
      } else {
        targetStep = nextInfo.nextStep;
      }
    }

    // Validate step: double scan and strict step-by-step sequence check
    const validation = dbStore.validateStepForStudent(student.id, targetStep);
    if (!validation.valid) {
      setScanMessage(validation.error || 'स्कैन सत्यापन विफल हुआ');
      setTimeout(() => setIsProcessing(false), 3000);
      return;
    }

    // Passed all validations!
    setActiveResolvedStep(targetStep);
    setScannedStudent(student);
    setScanMessage(null);
    await playAlertChime();
    stopCamera();

    setTimeout(() => {
      onScanSuccess(student, undefined, targetStep);
      onClose();
    }, 900);
  };

  const tickScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      if (canvas) {
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && code.data) {
            handleCodeFound(code.data);
            return;
          }
        }
      }
    }
    animationFrameId.current = requestAnimationFrame(tickScan);
  };

  // Start camera stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported on this browser/device');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        animationFrameId.current = requestAnimationFrame(tickScan);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setCameraError(
        error.message.includes('Permission')
          ? 'कैमरा अनुमति अस्वीकृत हुई। कृपया ब्राउज़र सेटिंग्स में कैमरा की अनुमति दें।'
          : 'कैमरा चालू नहीं हो सका। कृपया फोटो अपलोड द्वारा QR स्कैन करें।'
      );
      setCameraActive(false);
    }
  };

  // Handle uploaded QR image file from gallery
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          handleCodeFound(code.data);
        } else {
          setScanMessage('फोटो में कोई QR कोड नहीं मिला।');
        }
      }
    };
    img.src = URL.createObjectURL(file);
  };

  useEffect(() => {
    if (isOpen) {
      setScannedStudent(null);
      setScanMessage(null);
      setIsProcessing(false);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700/80 p-5 text-slate-100 shadow-2xl relative animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl bg-gradient-to-r ${stepDef.color} text-white shadow`}>
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {step
                  ? `चरण ${step}: ${stepDef.titleHi}`
                  : parentMode
                  ? 'अभिभावक QR स्कैनर (Parent QR)'
                  : 'लाइव सुरक्षा QR स्कैनर'}
              </h3>
              <p className="text-xs text-slate-400">
                {step
                  ? stepDef.descHi
                  : parentMode
                  ? 'अपने बच्चे के आईडी कार्ड का QR कोड स्कैन करें'
                  : 'छात्र कार्ड का QR कोड स्कैन करें'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Scanner Viewport */}
        <div className="mt-4 relative rounded-2xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border-2 border-slate-800">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera active overlay with target square */}
          {cameraActive && !scannedStudent && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-52 border-2 border-dashed border-emerald-400/90 rounded-2xl relative animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl -mt-1 -ml-1" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr -mt-1 -mr-1" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl -mb-1 -ml-1" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br -mb-1 -mr-1" />
              </div>
              <p className="absolute bottom-3 text-xs bg-black/60 px-3 py-1 rounded-full text-emerald-300 font-medium">
                छात्र के आईडी कार्ड का QR कोड सामने लाएं
              </p>
            </div>
          )}

          {/* Success Flash */}
          {scannedStudent && (
            <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2 border border-emerald-400/30">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h4 className="font-bold text-lg text-emerald-300">QR स्कैन सफल!</h4>
              <p className="text-white font-semibold text-base mt-1">{scannedStudent.name}</p>
              <p className="text-xs text-slate-300">
                {scannedStudent.rollNo} • {scannedStudent.className}
              </p>
              <p className="text-[11px] text-emerald-400 mt-2 italic animate-pulse">
                लाइव वॉइस अलर्ट भेजा जा रहा है...
              </p>
            </div>
          )}

          {/* Camera Error / Fallback */}
          {!cameraActive && !scannedStudent && (
            <div className="p-6 text-center text-slate-400 flex flex-col items-center justify-center">
              <Camera className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-xs text-slate-300 max-w-xs">{cameraError || 'कैमरा चालू हो रहा है...'}</p>
              <button
                onClick={startCamera}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>पुनः प्रयास करें</span>
              </button>
            </div>
          )}
        </div>

        {/* Scan Message / Error */}
        {scanMessage && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{scanMessage}</span>
          </div>
        )}

        {/* Alternate Option: QR Image Upload */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <label className="flex items-center gap-1.5 cursor-pointer text-blue-400 hover:text-blue-300">
            <Upload className="w-3.5 h-3.5" />
            <span>गैलरी से QR फोटो स्कैन करें</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          <span className="text-[10px] text-slate-500">लाइव ऑटो-स्कैन</span>
        </div>
      </div>
    </div>
  );
};
