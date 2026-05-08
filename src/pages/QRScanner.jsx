import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import QrScanner from "qr-scanner";
import { Capacitor } from "@capacitor/core";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { parseLotteryQr } from "../utils/qrParser";
import { isNativeApp as checkIsNative } from "../utils/platform";
import { scanNativeQrCode } from "../services/nativeQrScanner";
import { Loader2, Camera, Clipboard, Image as ImageIcon, ChevronLeft } from "lucide-react";

const QRScannerPage = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const isDecodedRef = useRef(false);

  // 네이티브 스캔 상태 관리 Ref
  const isStartingRef = useRef(false);
  const isScanningRef = useRef(false);
  const isScannedRef = useRef(false);

  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  
  // 디버그용 상태
  const [debug, setDebug] = useState({
    isNative: checkIsNative(),
    platform: Capacitor.getPlatform(),
    pluginLoaded: !!BarcodeScanner,
    lastError: "",
    lastText: ""
  });

  const isNative = debug.isNative;

  // ── 초기화 및 자동 스캔 ──
  useEffect(() => {
    // 네이티브 앱인 경우 즉시 스캔 실행
    if (isNative) {
      const timer = setTimeout(() => {
        startScanner();
      }, 400);
      return () => clearTimeout(timer);
    }

    // 웹 환경에서는 클립보드 자동 감지
    (async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.includes("dhlottery.co.kr")) {
          setUrlInput(text);
        }
      } catch {}
    })();

    // PWA Share Target
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("url") || params.get("text");
    if (shared && shared.includes("dhlottery")) {
      goToResult(shared);
    }

    return () => {
      stopScanner();
      isScannedRef.current = false;
    };
  }, []);

  // ── 결과 페이지 이동 ──
  const goToResult = (url) => {
    const parsed = parseLotteryQr(url);
    if (parsed && parsed.type !== "unknown") {
      localStorage.setItem("bokgwon24_last_qr_raw", url);
      setDebug(prev => ({ ...prev, lastText: url }));
      if (navigator.vibrate) navigator.vibrate(100);
      navigate("/qr-result", { state: { rawQr: url, parsed }, replace: true });
    } else {
      setError("동행복권 QR 주소를 인식할 수 없습니다.");
      setTimeout(() => setError(""), 3000);
    }
  };

  // ── 붙여넣기 ──
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
        if (text.includes("dhlottery.co.kr")) {
          goToResult(text);
        }
      }
    } catch {
      alert("클립보드에 접근할 수 없습니다. 직접 붙여넣기 해주세요.");
    }
  };

  // ── 확인 버튼 ──
  const handleSubmit = () => {
    if (!urlInput.trim()) return;
    goToResult(urlInput.trim());
  };

  // ── 사진 촬영 후 분석 ──
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
        alsoTryWithoutScanRegion: true,
      });
      if (result?.data) {
        goToResult(result.data);
        return;
      }
    } catch {}

    alert("사진에서 QR을 찾지 못했습니다.");
    e.target.value = "";
  };

  // ── 실시간 스캐너 ──
  const startScanner = async () => {
    if (isNative) {
      if (isStartingRef.current || isScanningRef.current || isScannedRef.current) return;
      
      try {
        isStartingRef.current = true;
        isScanningRef.current = true;
        setError("");

        const result = await scanNativeQrCode();
        
        if (result.success && result.decodedText) {
          isScannedRef.current = true;
          goToResult(result.decodedText);
        } else {
          // 취소했거나 빈 값이 넘어온 경우 홈으로 즉시 이동
          navigate("/", { replace: true });
        }
      } catch (err) {
        console.warn("Native scan error:", err);
        // 에러 발생 시에도 홈으로 즉시 이동하여 낙차 없는 경험 제공
        navigate("/", { replace: true });
      } finally {
        isStartingRef.current = false;
        isScanningRef.current = false;
      }
      return;
    }

    if (scannerRef.current) return;
    setShowScanner(true);

    try {
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const text = typeof result === "string" ? result : result?.data;
          if (text && !isDecodedRef.current) {
            isDecodedRef.current = true;
            stopScanner();
            goToResult(text);
          }
        },
        { preferredCamera: "environment", highlightScanRegion: true, maxScansPerSecond: 25 }
      );
      scannerRef.current = scanner;
      await scanner.start();
    } catch (err) {
      alert("카메라 실패: " + err.message);
      setShowScanner(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try { scannerRef.current.stop(); scannerRef.current.destroy(); } catch {}
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  // ── 렌더링 분기: 웹 스캐너 모드 ──
  if (showScanner) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 100 }}>
        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <button onClick={stopScanner} style={{ position: "absolute", top: 16, left: 16, zIndex: 10, width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none" }}>
          <ChevronLeft size={24} />
        </button>
      </div>
    );
  }

  // ── 렌더링 분기: 네이티브 스캐닝 중 (안내 페이지 제거됨) ──
  if (isNative) {
    return (
      <div className="full-flex-center" style={{ minHeight: "100vh", backgroundColor: "white", flexDirection: "column", gap: "20px" }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary-blue)" />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontWeight: "900", fontSize: "1.2rem", color: "#1E293B", marginBottom: "8px" }}>QR 스캐너를 여는 중...</p>
          <p style={{ color: "#64748B", fontSize: "0.9rem" }}>잠시만 기다려 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#F8FAFC", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ background: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", borderBottom: "1px solid #E2E8F0" }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", fontSize: 24, color: "#64748B" }}>
          <ChevronLeft size={28} />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", fontSize: "1.1rem", fontWeight: 800, color: "#1E293B", marginRight: 28 }}>QR 당첨 확인</h1>
      </header>

      <main style={{ flex: 1, padding: "24px 20px" }}>
        {/* 웹 브라우저 UI (네이티브는 위에서 return됨) */}
        <div style={{ background: "#EEF2FF", borderRadius: 20, padding: "20px", border: "1px solid #C7D2FE", marginBottom: 24 }}>
          <p style={{ fontWeight: 900, color: "#312E81", fontSize: "1rem", marginBottom: 12 }}>📱 이렇게 확인하세요</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Step n="1" text="휴대폰 카메라로 복권 QR을 찍으세요" />
            <Step n="2" text="화면에 뜬 주소를 길게 눌러 복사하세요" />
            <Step n="3" text='[붙여넣기] 버튼을 누르면 자동 확인됩니다' />
          </div>
        </div>

        <button onClick={handlePaste} style={ctaBtnStyle}>
          <Clipboard size={22} /> 주소 붙여넣기로 바로 확인
        </button>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://qr.dhlottery.co.kr/..."
            style={inputStyle}
          />
          <button onClick={handleSubmit} style={okBtnStyle}>확인</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <label style={{ ...subBtnStyle, flex: 1 }}>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
            <ImageIcon size={18} /> 사진 분석
          </label>
          <button onClick={startScanner} style={{ ...subBtnStyle, flex: 1 }}>
            <Camera size={18} /> 실시간 스캔 (Beta)
          </button>
        </div>

        {error && (
          <p style={{ color: "#EF4444", fontSize: "0.85rem", fontWeight: 700, textAlign: "center", marginTop: 12 }}>
            ⚠️ {error}
          </p>
        )}
      </main>
    </div>
  );
};

const Step = ({ n, text }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#4F46E5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.75rem", flexShrink: 0 }}>{n}</div>
    <p style={{ color: "#4338CA", fontSize: "0.85rem", fontWeight: 700 }}>{text}</p>
  </div>
);

const ctaBtnStyle = {
  width: "100%", padding: "18px", borderRadius: "18px", border: "none",
  background: "var(--primary-blue)", color: "#fff", fontWeight: 900, fontSize: "1.1rem",
  boxShadow: "0 8px 20px rgba(37, 99, 235, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: "16px"
};

const subBtnStyle = {
  width: "100%", padding: "14px", borderRadius: "14px", border: "1px solid #E2E8F0",
  background: "#fff", color: "#475569", fontWeight: 800, fontSize: "0.9rem",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8
};

const inputStyle = {
  flex: 1, padding: "14px", borderRadius: "14px", border: "1px solid #E2E8F0",
  fontSize: "0.85rem", background: "#fff", fontWeight: "700", outline: "none"
};

const okBtnStyle = {
  padding: "0 20px", borderRadius: "14px", border: "none",
  background: "#1E293B", color: "#fff", fontWeight: 800
};

export default QRScannerPage;
