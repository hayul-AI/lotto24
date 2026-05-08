import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Loader2, Camera } from 'lucide-react';
import jsQR from 'jsqr';

const InternalScanner = ({ onBack, onScanSuccess }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isScanningRef = useRef(false);
  const requestRef = useRef(null);

  const [status, setStatus] = useState('카메라 준비 중...');
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: "continuous" }]
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        isScanningRef.current = true;
        setStatus("QR 코드를 박스 안에 맞춰주세요");
        startScanningLoop();
      }
    } catch (err) {
      alert("카메라를 켤 수 없습니다. 사진 촬영을 이용해 주세요.");
    }
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startScanningLoop = () => {
    // @ts-ignore
    const detector = ('BarcodeDetector' in window) ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const scan = async () => {
      if (!isScanningRef.current || !videoRef.current) return;

      const video = videoRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const vWidth = video.videoWidth;
        const vHeight = video.videoHeight;
        
        const scanSize = Math.min(vWidth, vHeight) * 0.6;
        const sx = (vWidth - scanSize) / 2;
        const sy = (vHeight - scanSize) / 2;

        canvas.width = 400;
        canvas.height = 400;
        context.drawImage(video, sx, sy, scanSize, scanSize, 0, 0, 400, 400);

        if (detector) {
          try {
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0) {
              onScanSuccess(barcodes[0].rawValue);
              return;
            }
          } catch (e) {}
        }

        const imageData = context.getImageData(0, 0, 400, 400);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          onScanSuccess(code.data);
          return;
        }
      }
      requestRef.current = requestAnimationFrame(scan);
    };
    requestRef.current = requestAnimationFrame(scan);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPhotoLoading(true);
    setStatus("이미지 분석 중...");

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(resolve => img.onload = resolve);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        onScanSuccess(code.data);
      } else {
        alert("사진에서 QR 코드를 찾을 수 없습니다.");
        setStatus("인식 실패");
      }
    } catch (err) {
      alert("이미지 분석 오류");
    } finally {
      setIsPhotoLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', position: 'relative', overflow: 'hidden', color: 'white' }}>
      <video ref={videoRef} playsInline muted style={{ width: '100vw', height: '100vh', objectFit: 'cover', position: 'absolute' }} />
      
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
        <header style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', pointerEvents: 'auto' }}>
          <button onClick={onBack} style={iconBtnStyle}><ChevronLeft size={28} /></button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: '800' }}>내부 스캐너 Beta</span>
        </header>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ width: '250px', height: '250px', border: '2px solid rgba(255,255,255,0.4)', borderRadius: '40px', position: 'relative', boxShadow: '0 0 0 4000px rgba(0,0,0,0.6)' }}>
            <div className="scan-line" />
            <div style={{ position: 'absolute', top: -2, left: -2, width: 40, height: 40, borderTop: '5px solid #3B82F6', borderLeft: '5px solid #3B82F6', borderTopLeftRadius: 40 }} />
            <div style={{ position: 'absolute', top: -2, right: -2, width: 40, height: 40, borderTop: '5px solid #3B82F6', borderRight: '5px solid #3B82F6', borderTopRightRadius: 40 }} />
            <div style={{ position: 'absolute', bottom: -2, left: -2, width: 40, height: 40, borderBottom: '5px solid #3B82F6', borderLeft: '5px solid #3B82F6', borderBottomLeftRadius: 40 }} />
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 40, height: 40, borderBottom: '5px solid #3B82F6', borderRight: '5px solid #3B82F6', borderBottomRightRadius: 40 }} />
          </div>
          <div style={{ position: 'absolute', bottom: '80px', width: '100%', textAlign: 'center' }}>
            <p style={{ color: '#FACC15', fontWeight: '900', fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {isPhotoLoading ? <Loader2 className="animate-spin" /> : null} {status}
            </p>
          </div>
        </div>

        <footer style={{ padding: '30px 20px 40px', pointerEvents: 'auto' }}>
          <button 
            onClick={() => document.getElementById('photo-input-beta').click()}
            style={{ width: '100%', height: '60px', backgroundColor: '#3B82F6', color: 'white', borderRadius: '16px', border: 'none', fontWeight: '900', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Camera size={24} /> 사진 촬영 인식
          </button>
          <input id="photo-input-beta" type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />
        </footer>
      </div>

      <style>{`
        .scan-line { position: absolute; width: 100%; height: 2px; background: #3B82F6; top: 0; animation: scan 2s linear infinite; box-shadow: 0 0 15px #3B82F6; }
        @keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const iconBtnStyle = { background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' };

export default InternalScanner;
