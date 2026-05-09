import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import QrScanner from "qr-scanner";
import { Capacitor } from "@capacitor/core";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { parseLotteryQr } from "../utils/qrParser";
import { isNativeApp as checkIsNative } from "../utils/platform";
import { scanNativeQrCode } from "../services/nativeQrScanner";
import { Loader2, Camera, Clipboard, Image as ImageIcon, ChevronLeft, AlertCircle } from "lucide-react";

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
  const [debugRawQr, setDebugRawQr] = useState("");
  const [parseError, setParseError] = useState(null);
  const [showFallbackUI, setShowFallbackUI] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const isNative = checkIsNative();

  // ── 초기화 및 자동 스캔 ──
  useEffect(() => {
    const init = async () => {
      setIsInitializing(true);
      // 네이티브 앱인 경우 즉시 스캔 실행
      if (isNative) {
        // 네이티브는 약간의 지연 후 실행 (안정성)
        const timer = setTimeout(() => {
          startScanner();
        }, 300);

        const timeoutTimer = setTimeout(() => {
          if (isStartingRef.current) {
            console.warn("Native scanner initialization timed out.");
            setIsInitializing(false);
            setShowFallbackUI(true);
          }
        }, 5000);

        return () => {
          clearTimeout(timer);
          clearTimeout(timeoutTimer);
        };
      } else {
        // 웹 환경에서도 즉시 실시간 스캔 시작
        startScanner();
      }
    };

    init();

    return () => {
      stopScanner();
      isScannedRef.current = false;
    };
  }, []);

  // ── 결과 페이지 이동 ──
  const goToResult = (rawText) => {
    console.log("[QR SCAN RAW]", rawText);
    setDebugRawQr(String(rawText || ""));
    setParseError(null);

    if (!rawText || typeof rawText !== "string") {
      setParseError({ title: "QR 주소를 읽을 수 없습니다.", raw: rawText });
      isDecodedRef.current = false;
      setShowFallbackUI(true);
      return;
    }

    const parsed = parseLotteryQr(rawText);
    if (parsed && parsed.type !== "unknown") {
      localStorage.setItem("bokgwon24_last_qr_raw", rawText);
      if (navigator.vibrate) navigator.vibrate(100);
      navigate("/qr-result", { state: { rawQr: rawText, parsed }, replace: true });
    } else {
      setParseError({ title: parsed?.reason || "지원하지 않는 QR 형식입니다.", raw: rawText });
      isDecodedRef.current = false;
      setShowFallbackUI(true);
      if (!isNative) stopScanner();
    }
  };

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

  const handleSubmit = () => {
    if (!urlInput.trim()) return;
    goToResult(urlInput.trim());
  };

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
          // 취소한 경우 대체 UI 보여줌
          setIsInitializing(false);
          setShowFallbackUI(true);
        }
      } catch (err) {
        console.warn("Native scan error:", err);
        setError("카메라를 실행할 수 없습니다.");
        setShowFallbackUI(true);
      } finally {
        isStartingRef.current = false;
        isScanningRef.current = false;
        setIsInitializing(false);
      }
      return;
    }

    if (scannerRef.current) return;
    setError("");
    isDecodedRef.current = false;
    setIsInitializing(true);

    try {
      setShowScanner(true);
      
      // 약간의 지연 후 비디오 엘리먼트 확인
      setTimeout(async () => {
        if (!videoRef.current) {
          setError("카메라 초기화 실패");
          setShowScanner(false);
          setShowFallbackUI(true);
          setIsInitializing(false);
          return;
        }

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
          setIsInitializing(false);
        } catch (err) {
          console.error("Web scanner start error:", err);
          setError("카메라 권한이 없거나 카메라를 찾을 수 없습니다.");
          setShowScanner(false);
          setShowFallbackUI(true);
          setIsInitializing(false);
        }
      }, 300);
    } catch (err) {
      setError("스캐너 준비 중 오류가 발생했습니다.");
      setShowScanner(false);
      setShowFallbackUI(true);
      setIsInitializing(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try { scannerRef.current.stop(); scannerRef.current.destroy(); } catch {}
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  return (
    <div style={{ backgroundColor: "#F8FAFC", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* 웹 스캐너 화면 overlay */}
      {showScanner && (
        <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 1000 }}>
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", zIndex: 10 }}>
            <button onClick={stopScanner} style={circleBtnStyle}>
              <ChevronLeft size={24} />
            </button>
          </div>
          <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 10 }}>
            <p style={{ color: "white", background: "rgba(0,0,0,0.5)", padding: "8px 16px", borderRadius: "20px", fontSize: "0.9rem", fontWeight: "700" }}>
              사각형 안에 QR 코드를 맞춰주세요
            </p>
          </div>
        </div>
      )}

      {/* 로딩/준비 중 화면 */}
      {isInitializing && !showScanner && !showFallbackUI && (
        <div className="full-flex-center" style={{ 
          position: "fixed", inset: 0, zIndex: 200, backgroundColor: "#fff",
          flexDirection: "column", gap: "16px"
        }}>
          <Loader2 className="animate-spin" size={40} color="#2563EB" />
          <p style={{ fontWeight: "800", color: "#1E293B" }}>QR 스캐너를 준비 중입니다...</p>
        </div>
      )}

      <header style={{ background: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", borderBottom: "1px solid #E2E8F0", position: "relative", zIndex: 5 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", fontSize: 24, color: "#64748B" }}>
          <ChevronLeft size={28} />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", fontSize: "1.1rem", fontWeight: 800, color: "#1E293B", marginRight: 28 }}>QR 당첨 확인</h1>
      </header>

      <main style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", paddingBottom: "120px" }}>
        {parseError ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <AlertCircle size={48} color="#EF4444" style={{ margin: "0 auto 16px" }} />
            <h2 style={{ color: "#1E293B", fontWeight: "900", fontSize: "1.2rem", marginBottom: "12px" }}>{parseError.title}</h2>
            
            <div style={{ 
              background: "#fff", padding: "16px", borderRadius: "16px", border: "1px solid #E2E8F0", 
              textAlign: "left", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
            }}>
              <p style={{ fontSize: "0.85rem", color: "#64748B", fontWeight: "800", marginBottom: "8px" }}>QR 원문</p>
              <div style={{ 
                background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1",
                fontSize: "0.7rem", color: "#1E293B", wordBreak: "break-all", fontFamily: "monospace"
              }}>
                {parseError.raw}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={() => { setParseError(null); setShowFallbackUI(false); startScanner(); }} style={ctaBtnStyle}>
                다시 스캔하기
              </button>
              <button onClick={() => { setParseError(null); setShowFallbackUI(true); }} style={{ ...subBtnStyle, background: "#F1F5F9", border: "none" }}>
                다른 방법으로 입력
              </button>
            </div>
          </div>
        ) : error && !showScanner ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <AlertCircle size={48} color="#EF4444" style={{ margin: "0 auto 20px" }} />
            <p style={{ color: "#1E293B", fontWeight: "900", fontSize: "1.1rem", marginBottom: "8px" }}>카메라를 사용할 수 없습니다</p>
            <p style={{ color: "#64748B", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "24px" }}>
              {error}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={() => { setError(""); startScanner(); }} style={ctaBtnStyle}>다시 시도하기</button>
              <button onClick={() => { setError(""); setShowFallbackUI(true); }} style={{ ...subBtnStyle, background: "#F1F5F9", border: "none" }}>대체 입력 방법 열기</button>
            </div>
          </div>
        ) : showFallbackUI ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.3s ease-out" }}>
            <div style={{ background: "#EEF2FF", borderRadius: 20, padding: "20px", border: "1px solid #C7D2FE" }}>
              <p style={{ fontWeight: 900, color: "#312E81", fontSize: "1rem", marginBottom: 16 }}>📱 당첨 확인 방법 안내</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Step n="1" text="복권의 QR 코드를 스캔하세요" />
                <Step n="2" text="인식이 안 되면 주소를 직접 입력하세요" />
                <Step n="3" text="사진 앨범에서 QR 이미지를 불러와도 됩니다" />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ color: "#64748B", fontSize: "0.85rem", fontWeight: "800", marginLeft: "4px" }}>대체 입력 방법</p>
              
              <button onClick={handlePaste} style={{ ...subBtnStyle, background: "#fff", height: "56px" }}>
                <Clipboard size={20} color="#2563EB" /> 복사한 주소 붙여넣기
              </button>

              <label style={{ ...subBtnStyle, height: "56px", cursor: "pointer" }}>
                <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
                <ImageIcon size={20} color="#10B981" /> 사진 불러오기
              </label>

              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="주소 직접 입력"
                  style={inputStyle}
                />
                <button onClick={handleSubmit} style={okBtnStyle}>확인</button>
              </div>

              <button 
                onClick={() => { setShowFallbackUI(false); startScanner(); }}
                style={{ ...subBtnStyle, marginTop: "20px", border: "none", background: "#EFF6FF", color: "#2563EB" }}
              >
                <Camera size={18} /> 다시 카메라 켜기
              </button>
            </div>
          </div>
        ) : null}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const Step = ({ n, text }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#4F46E5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.75rem", flexShrink: 0 }}>{n}</div>
    <p style={{ color: "#4338CA", fontSize: "0.85rem", fontWeight: 700 }}>{text}</p>
  </div>
);

const circleBtnStyle = {
  width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none",
  display: "flex", alignItems: "center", justifyContent: "center"
};

const ctaBtnStyle = {
  width: "100%", height: "56px", borderRadius: "16px", border: "none",
  background: "#2563EB", color: "#fff", fontWeight: 900, fontSize: "1rem",
  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)", display: "flex", alignItems: "center", justifyContent: "center"
};

const subBtnStyle = {
  width: "100%", borderRadius: "16px", border: "1px solid #E2E8F0",
  background: "#fff", color: "#475569", fontWeight: 800, fontSize: "0.95rem",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10
};

const inputStyle = {
  flex: 1, height: "56px", padding: "0 16px", borderRadius: "16px", border: "1px solid #E2E8F0",
  fontSize: "0.95rem", background: "#fff", fontWeight: "700", outline: "none"
};

const okBtnStyle = {
  padding: "0 24px", height: "56px", borderRadius: "16px", border: "none",
  background: "#1E293B", color: "#fff", fontWeight: 800, fontSize: "0.95rem"
};

export default QRScannerPage;
