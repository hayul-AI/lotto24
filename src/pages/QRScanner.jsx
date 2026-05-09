import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QrScanner from "qr-scanner";
import { Capacitor } from "@capacitor/core";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { parseLotteryQr } from "../utils/qrParser";
import { isNativeApp as checkIsNative } from "../utils/platform";
import { scanNativeQrCode } from "../services/nativeQrScanner";
import { Loader2, Camera, ChevronLeft, AlertCircle } from "lucide-react";

const QRScannerPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const isDecodedRef = useRef(false);

  // 네이티브 스캔 상태 관리 Ref
  const isStartingRef = useRef(false);
  const isScanningRef = useRef(false);
  const isScannedRef = useRef(false);

  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [parseError, setParseError] = useState(null);

  const isNative = checkIsNative();

  // ── 초기화 및 자동 스캔 ──
  useEffect(() => {
    const init = async () => {
      setError("");
      setParseError(null);
      isDecodedRef.current = false;

      // 네이티브 앱인 경우 즉시 스캔 실행
      if (isNative) {
        startScanner();
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
  }, [location.key]);

  // ── 결과 페이지 이동 ──
  const goToResult = (rawText) => {
    console.log("[QR SCAN RAW]", rawText);
    setParseError(null);

    if (!rawText || typeof rawText !== "string") {
      setParseError({ title: "QR 주소를 읽을 수 없습니다.", raw: rawText });
      isDecodedRef.current = false;
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
      if (!isNative) stopScanner();
    }
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
          // 취소한 경우 에러 메시지 표시 (안내 화면 대신)
          setError("스캔이 취소되었습니다.");
        }
      } catch (err) {
        console.warn("Native scan error:", err);
        setError("카메라를 실행할 수 없습니다. 권한 설정을 확인해주세요.");
      } finally {
        isStartingRef.current = false;
        isScanningRef.current = false;
      }
      return;
    }

    if (scannerRef.current) return;
    setError("");
    isDecodedRef.current = false;

    try {
      setShowScanner(true);
      
      // 즉시 비디오 엘리먼트 확인 및 스캐너 시작
      if (!videoRef.current) {
        // 비디오 엘리먼트가 렌더링될 때까지 아주 짧게 대기
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (!videoRef.current) {
        setError("카메라를 시작할 수 없습니다. 카메라 권한을 확인한 뒤 다시 시도해주세요.");
        setShowScanner(false);
        return;
      }

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
      console.error("Scanner error:", err);
      setError("카메라를 시작할 수 없습니다. 카메라 권한을 확인한 뒤 다시 시도해주세요.");
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

  const goHome = () => navigate("/");

  return (
    <div style={{ backgroundColor: isNative && (isScanningRef.current || showScanner) ? "transparent" : "#F8FAFC", minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
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

      <header style={{ background: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", borderBottom: "1px solid #E2E8F0", position: "relative", zIndex: 5 }}>
        <button onClick={goHome} style={{ background: "none", border: "none", fontSize: 24, color: "#64748B" }}>
          <ChevronLeft size={28} />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", fontSize: "1.1rem", fontWeight: 800, color: "#1E293B", marginRight: 28 }}>QR 당첨 확인</h1>
      </header>

      <main style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", paddingBottom: "120px" }}>
        {parseError ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <AlertCircle size={48} color="#EF4444" style={{ margin: "0 auto 16px" }} />
            <h2 style={{ color: "#1E293B", fontWeight: "900", fontSize: "1.2rem", marginBottom: "12px" }}>{parseError.title}</h2>
            
            <p style={{ color: "#64748B", fontSize: "0.9rem", marginBottom: "24px" }}>
              유효하지 않은 QR 코드이거나 네트워크 오류일 수 있습니다.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button onClick={() => { setParseError(null); startScanner(); }} style={ctaBtnStyle}>
                다시 스캔하기
              </button>
              <button onClick={goHome} style={subBtnStyle}>
                홈으로 이동
              </button>
            </div>
          </div>
        ) : error && !showScanner ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <AlertCircle size={48} color="#EF4444" style={{ margin: "0 auto 20px" }} />
            <p style={{ color: "#1E293B", fontWeight: "900", fontSize: "1.1rem", marginBottom: "8px" }}>카메라를 시작할 수 없습니다</p>
            <p style={{ color: "#64748B", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "24px" }}>
              카메라 권한을 확인한 뒤 다시 시도해주세요.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button onClick={() => { setError(""); startScanner(); }} style={ctaBtnStyle}>다시 시도하기</button>
              <button onClick={goHome} style={subBtnStyle}>홈으로 이동</button>
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
  width: "100%", height: "56px", borderRadius: "16px", border: "1px solid #E2E8F0",
  background: "#fff", color: "#475569", fontWeight: 800, fontSize: "1rem",
  display: "flex", alignItems: "center", justifyContent: "center"
};

export default QRScannerPage;
