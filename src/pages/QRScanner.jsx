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
  const [lastFailedQr, setLastFailedQr] = useState("");

  // 개발 디버그 모드 (출시 전 false로 변경하거나 환경변수 처리 가능)
  const DEV_MODE = true;
  
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
    const init = async () => {
      // 네이티브 앱인 경우 즉시 스캔 실행
      if (isNative) {
        const timer = setTimeout(() => {
          startScanner();
        }, 800);

        // 5초 후에도 여전히 로딩 중이면 강제 취소/홈 이동 (행 방지)
        const timeoutTimer = setTimeout(() => {
          if (isStartingRef.current) {
            console.warn("Native scanner initialization timed out.");
            navigate("/", { replace: true });
          }
        }, 5500);

        return () => {
          clearTimeout(timer);
          clearTimeout(timeoutTimer);
        };
      } else {
        // 웹 환경에서도 즉시 실시간 스캔 시작 시도
        startScanner();
      }

      // 웹 환경에서는 클립보드 자동 감지
      if (!isNative) {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.includes("dhlottery.co.kr")) {
            setUrlInput(text);
          }
        } catch {}
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
    // 1. 무조건 로그 먼저 출력
    console.log("[QR SCAN RAW]", rawText);
    console.log("[QR SCAN RAW TYPE]", typeof rawText);
    console.log("[QR SCAN RAW LENGTH]", rawText?.length);

    // 2. 유효성 체크
    if (!rawText || typeof rawText !== "string") {
      alert("QR 주소를 읽을 수 없습니다.");
      isDecodedRef.current = false;
      if (!isNative) startScanner();
      return;
    }

    // 3. 파싱 시도
    const parsed = parseLotteryQr(rawText);
    console.log("[QR PARSED RESULT]", parsed);

    // 4. 결과에 따른 분기
    if (parsed && parsed.type !== "unknown") {
      localStorage.setItem("bokgwon24_last_qr_raw", rawText);
      setDebug(prev => ({ ...prev, lastText: rawText }));
      setLastFailedQr(""); // 성공 시 초기화
      
      if (navigator.vibrate) navigator.vibrate(100);
      
      // 로또 또는 연금복권 결과 페이지로 이동
      navigate("/qr-result", { state: { rawQr: rawText, parsed }, replace: true });
    } else {
      // 5. 실패 로그 (unknown 처리)
      console.warn("[QR UNKNOWN FORMAT]", {
        rawText,
        parsed,
        includesDhlottery: rawText.includes("dhlottery"),
        includesQrDomain: rawText.includes("qr.dhlottery"),
        includes720: rawText.includes("720"),
        includesPension: rawText.toLowerCase().includes("pension"),
        includesLotto: rawText.toLowerCase().includes("lotto")
      });

      // 디버그용으로 원문 저장
      setLastFailedQr(rawText);

      // 6. 에러 메시지 처리
      let errorMsg = "지원하지 않는 QR 형식입니다.";
      if (parsed?.reason === "연금복권 번호를 읽을 수 없습니다.") {
        errorMsg = "연금복권 번호를 읽을 수 없습니다.";
      }
      
      alert(errorMsg);

      // 다시 스캔할 수 있도록 상태 초기화
      isDecodedRef.current = false;
      if (!isNative) {
        startScanner();
      }
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
        navigate("/", { replace: true });
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
      
      setTimeout(async () => {
        if (!videoRef.current) {
          setError("카메라 초기화 실패");
          setShowScanner(false);
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
        } catch (err) {
          console.error("Web scanner start error:", err);
          setError("카메라 권한이 필요합니다. 설정에서 허용해주세요.");
          setShowScanner(false);
        }
      }, 100);
    } catch (err) {
      setError("스캐너 준비 중 오류가 발생했습니다.");
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

      {/* 네이티브 스캐너 실행 중 overlay */}
      {isNative && (isStartingRef.current || isScanningRef.current) && (
        <div className="full-flex-center" style={{ 
          position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(255,255,255,0.95)",
          flexDirection: "column", gap: "20px", padding: "20px" 
        }}>
          <Loader2 className="animate-spin" size={48} color="var(--primary-blue)" />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: "900", fontSize: "1.2rem", color: "#1E293B", marginBottom: "8px" }}>네이티브 스캐너를 여는 중...</p>
            <p style={{ color: "#64748B", fontSize: "0.9rem" }}>스캐너가 열리면 카메라를 QR에 대주세요.</p>
          </div>
          <button 
            onClick={() => navigate("/", { replace: true })}
            style={{ 
              marginTop: "20px", padding: "12px 24px", borderRadius: "12px", border: "1px solid #E2E8F0",
              backgroundColor: "white", color: "#64748B", fontWeight: "800", fontSize: "0.9rem"
            }}
          >
            취소하고 돌아가기
          </button>
        </div>
      )}

      <header style={{ background: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", borderBottom: "1px solid #E2E8F0" }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", fontSize: 24, color: "#64748B" }}>
          <ChevronLeft size={28} />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", fontSize: "1.1rem", fontWeight: 800, color: "#1E293B", marginRight: 28 }}>QR 당첨 확인</h1>
      </header>

      <main style={{ flex: 1, padding: "24px 20px", display: "flex", flexDirection: "column" }}>
        {error ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <AlertCircle size={48} color="#EF4444" style={{ margin: "0 auto 20px" }} />
            <p style={{ color: "#1E293B", fontWeight: "900", fontSize: "1.1rem", marginBottom: "8px" }}>카메라 연결 오류</p>
            <p style={{ color: "#64748B", fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "24px" }}>
              {error}
            </p>
            <button onClick={() => { setError(""); startScanner(); }} style={ctaBtnStyle}>카메라 다시 켜기</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", opacity: 0.6 }}>
            <div style={{ background: "#EEF2FF", borderRadius: 20, padding: "20px", border: "1px solid #C7D2FE" }}>
              <p style={{ fontWeight: 900, color: "#312E81", fontSize: "1rem", marginBottom: 12 }}>📱 당첨 확인 방법</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Step n="1" text="휴대폰 카메라로 복권 QR을 찍으세요" />
                <Step n="2" text="주소를 복사하거나 직접 스캔하세요" />
                <Step n="3" text='[붙여넣기] 또는 [실시간 스캔] 이용' />
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: "auto" }}>
          {/* 개발용 디버그 출력 */}
          {DEV_MODE && lastFailedQr && (
            <div style={{ 
              marginBottom: "20px", padding: "12px", background: "#FEF2F2", border: "1px solid #FECACA", 
              borderRadius: "12px", fontSize: "0.75rem", color: "#991B1B", wordBreak: "break-all" 
            }}>
              <p style={{ fontWeight: "900", marginBottom: "4px" }}>⚠️ 디버그: 인식 실패 QR 원문</p>
              <code style={{ display: "block", background: "#fff", padding: "8px", borderRadius: "6px", border: "1px solid #FEE2E2" }}>
                {lastFailedQr}
              </code>
              <p style={{ marginTop: "6px", fontSize: "0.7rem", color: "#B91C1C" }}>* 위 텍스트를 개발자에게 알려주세요.</p>
            </div>
          )}

          <p style={{ textAlign: "center", color: "#94A3B8", fontSize: "0.8rem", fontWeight: "700", marginBottom: "16px" }}>
            카메라 인식이 안 될 경우 아래 방법을 이용하세요
          </p>
          
          <button onClick={handlePaste} style={{ ...subBtnStyle, marginBottom: "12px", background: "#F8FAFC" }}>
            <Clipboard size={18} /> 복사한 주소 붙여넣기
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ ...subBtnStyle, flex: 1 }}>
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
              <ImageIcon size={18} /> 사진 불러오기
            </label>
            <div style={{ flex: 1, display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="주소 직접 입력"
                style={{ ...inputStyle, padding: "10px" }}
              />
              <button onClick={handleSubmit} style={okBtnStyle}>확인</button>
            </div>
          </div>
        </div>
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

const circleBtnStyle = {
  width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none",
  display: "flex", alignItems: "center", justifyContent: "center"
};

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
