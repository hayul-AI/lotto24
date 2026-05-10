import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Trophy, AlertCircle, CheckCircle2, Info, Loader2, Heart } from 'lucide-react';
import { getLottoResultByDrawNo, getPensionResultByDrawNo, getPensionResultsDebug, getPensionDocStatus } from '../services/lottoService';
import LottoBall from '../components/LottoBall';
import { parseLotteryQr } from '../utils/qrParser';
import { checkLottoWinning } from '../utils/checkLottoResult';
import { checkPensionRank } from '../utils/checkPensionResult';
import { normalizeHistoryItem } from '../services/localTicketService';
import { nanoid } from 'nanoid';

const formatWon = (amount) => {
  if (amount == null || amount === 0) return "";
  return `${Number(amount).toLocaleString("ko-KR")}원`;
};

const PENSION_PRIZE_LABELS = {
  "1등": "매월 700만원 x 20년",
  "2등": "매월 100만원 x 10년",
  "보너스": "매월 100만원 x 10년",
  "3등": "1,000,000원",
  "4등": "100,000원",
  "5등": "50,000원",
  "6등": "5,000원",
  "7등": "1,000원"
};

const CheckResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [winningInfo, setWinningInfo] = useState(null);
  const [results, setResults] = useState([]);
  const [topRank, setTopRank] = useState(0);
  const [totalPrize, setTotalPrize] = useState({ amount: 0, label: "", hasUnknown: false, winCount: 0 });
  const [debugInfo, setDebugInfo] = useState(null);
  const [duplicateModal, setDuplicateModal] = useState({ show: false, data: null });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const SHOW_DEBUG = import.meta.env.DEV || location.search.includes('debug=true');

  useEffect(() => {
    initCheck();
  }, [location.state]);

  const initCheck = async () => {
    setLoading(true);
    setError("");
    setIsPending(false);

    try {
      const state = location.state || {};
      let parsed = state.parsed;
      const rawQr = state.rawQr || localStorage.getItem("bokgwon24_last_qr_raw");

      if (!parsed && rawQr) {
        parsed = parseLotteryQr(rawQr);
      }

      if (!parsed || parsed.type === "unknown") {
        setError("지원하지 않는 QR 형식입니다.");
        setParsedData({ rawQr });
        setLoading(false);
        return;
      }

      setParsedData(parsed);

      if (parsed.type === "lotto645") {
        await handleLottoCheck(parsed);
      } else if (parsed.type === "pension720") {
        await handlePensionCheck(parsed);
      } else {
        setError("지원하지 않는 QR 형식입니다.");
      }

    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      const msg = err.message;
      
      if (msg.includes("데이터가 아직 없습니다") || msg.includes("등록되지 않았습니다")) {
        setIsPending(true);
        // 추첨 전 복권도 중복 확인 및 저장 시도 (확인목록에서 온 것이 아닐 때만)
        if (!state.fromHistory && (parsedData || state.parsed)) {
          const target = parsedData || state.parsed;
          saveToHistory(target, null, [], 0, null, { result: "추첨전", resultStatus: "pending" });
        }
      } else if (msg.includes("번호를 읽을 수 없습니다") || 
                 msg.includes("회차/조 정보를 해석할 수 없습니다") ||
                 msg.includes("해석 규칙이 필요합니다")) {
        setError(msg);
      } else {
        setError("결과를 확인하는 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLottoCheck = async (parsed) => {
    const { data: winInfo, error: fetchErr } = await getLottoResultByDrawNo(parsed.drawNo);
    
    if (fetchErr || !winInfo) {
      if (import.meta.env.DEV) {
        console.log("[LOTTO QR PENDING]", {
          drawNo: parsed.drawNo,
          firestorePath: `lotto_results/${parsed.drawNo}`
        });
      }
      throw new Error(`제${parsed.drawNo}회 당첨번호 데이터가 아직 없습니다.`);
    }
    
    setWinningInfo(winInfo);
    
    let hasUnknown = false;
    let winCount = 0;
    const gameResults = parsed.games.map(game => {
      const win = checkLottoWinning(game, winInfo);
      let prizeAmount = 0;
      let prizeLabel = "";

      if (win.rank === 5) {
        prizeAmount = 5000;
        prizeLabel = "5,000원";
      } else if (win.rank === 4) {
        prizeAmount = 50000;
        prizeLabel = "50,000원";
      } else if (win.rank === 3) {
        prizeAmount = winInfo.thirdPrizeAmount || 0;
        prizeLabel = prizeAmount > 0 ? formatWon(prizeAmount) : "당첨금 확인 필요";
        if (!prizeAmount) hasUnknown = true;
      } else if (win.rank === 2) {
        prizeAmount = winInfo.secondPrizeAmount || 0;
        prizeLabel = prizeAmount > 0 ? formatWon(prizeAmount) : "당첨금 확인 필요";
        if (!prizeAmount) hasUnknown = true;
      } else if (win.rank === 1) {
        prizeAmount = winInfo.firstPrizeAmount || 0;
        prizeLabel = prizeAmount > 0 ? formatWon(prizeAmount) : "당첨금 확인 필요";
        if (!prizeAmount) hasUnknown = true;
      }

      if (win.rank > 0) winCount++;

      return { ...game, ...win, prizeAmount, prizeLabel };
    });

    const totalAmt = gameResults.reduce((sum, g) => sum + (g.prizeAmount || 0), 0);
    const totalLabel = totalAmt > 0 ? formatWon(totalAmt) : (winCount > 0 ? "당첨금 확인 필요" : "");

    const validRanks = gameResults.filter(r => r.rank > 0).map(r => r.rank);
    const bestRank = validRanks.length > 0 ? Math.min(...validRanks) : 0;
    
    setResults(gameResults);
    setTopRank(bestRank);
    setTotalPrize({ amount: totalAmt, label: totalLabel, hasUnknown, winCount });

    if (!location.state?.fromHistory) {
      saveToHistory(parsed, winInfo, gameResults, bestRank, { amount: totalAmt, label: totalLabel, hasUnknown, winCount });
    }
  };

  const handlePensionCheck = async (parsed) => {
    const diagnostics = {
      rawText: parsed.rawText,
      qrValue: parsed.qrValue,
      leftPart: parsed.leftPart,
      numberText: parsed.numberText || (parsed.numbers ? parsed.numbers.join("") : ""),
      candidates: [],
      latestDocs: []
    };

    const candidates = [];
    
    if (parsed.reason === "pension_pd120_format") {
      candidates.push({
        drawNo: parsed.drawNo,
        group: parsed.group,
        rule: `pd120 + ${parsed.drawNo} + ${parsed.group}`,
        isValid: true
      });
    } else if (parsed.leftPart) {
      const lp = parsed.leftPart;
      if (lp.length === 7 && lp.startsWith("120")) {
        const d3 = Number(lp.substring(3, 6));
        const g1 = lp.substring(6, 7);
        const g1Num = Number(g1);
        candidates.push({ 
          drawNo: d3, 
          group: g1, 
          rule: `pd120 + ${d3} + ${g1}`,
          isValid: g1Num >= 1 && g1Num <= 5
        });

        const d2 = Number(lp.substring(3, 5));
        const g2 = lp.substring(5, 7);
        const g2Num = Number(g2);
        candidates.push({ 
          drawNo: d2, 
          group: g2, 
          rule: `pd120 + ${d2} + ${g2}`,
          isValid: g2Num >= 1 && g2Num <= 5
        });
      }
    }

    if (parsed.drawNo && !candidates.some(c => c.drawNo === parsed.drawNo)) {
      const gNum = Number(parsed.group);
      candidates.push({ 
        drawNo: parsed.drawNo, 
        group: parsed.group, 
        rule: "기존 파서 규칙",
        isValid: gNum >= 1 && gNum <= 5
      });
    }

    for (const c of candidates) {
      if (c.isValid) {
        const status = await getPensionDocStatus(c.drawNo);
        c.exists = status.exists;
        c.data = status.data;
      } else {
        c.exists = false;
        c.data = null;
      }
    }
    diagnostics.candidates = candidates;

    const latest = await getPensionResultsDebug(5);
    diagnostics.latestDocs = latest.data || [];
    setDebugInfo(diagnostics);

    const winnerCandidate = candidates.find(c => c.isValid && c.exists);

    if (!winnerCandidate) {
      const validButNoDoc = candidates.find(c => c.isValid);
      if (validButNoDoc) {
        if (import.meta.env.DEV) {
          console.log("[PENSION QR PENDING]", {
            drawNo: validButNoDoc.drawNo,
            group: validButNoDoc.group,
            numberText: diagnostics.numberText,
            firestorePath: `pension_results/${validButNoDoc.drawNo}`
          });
        }
        throw new Error(`제${validButNoDoc.drawNo}회 연금복권 결과가 아직 등록되지 않았습니다.`);
      }
      throw new Error(`유효한 회차/조 정보를 해석할 수 없습니다.`);
    }

    try {
      const winInfo = winnerCandidate.data;
      const ticketNumbers = parsed.numbers;

      if (!winInfo || !ticketNumbers || ticketNumbers.length !== 6) {
        throw new Error("연금복권 당첨 정보를 확인할 수 없습니다.");
      }

      setWinningInfo(winInfo);

      const winGroup = String(winInfo.firstPrizeNumber?.group ?? "0");
      const winNumbers = Array.isArray(winInfo.firstPrizeNumber?.numbers) 
        ? winInfo.firstPrizeNumber.numbers.map(String) 
        : [];

      const myGroup = String(winnerCandidate.group);
      const myNumbers = ticketNumbers.map(String);

      const winResult = checkPensionRank(
        { grade: Number(myGroup), numbers: myNumbers.map(Number) }, 
        { grade: Number(winGroup), winning: winNumbers.map(Number) }
      );
      
      let prizeAmount = 0;
      let prizeLabel = winResult.prize || "";
      let hasUnknown = false;

      // 연금복권 금액 추출 (예: "1,000원" -> 1000)
      if (winResult.rank >= 3) {
        prizeAmount = Number(prizeLabel.replace(/[^0-9]/g, '')) || 0;
      } else if (winResult.rank > 0) {
        // 1, 2등은 매월 지급이므로 금액 합산에서 제외하거나 0으로 처리 (유저 요청에 따름)
        prizeAmount = 0;
        hasUnknown = true; 
      }

      const gameResults = [{
        label: "A",
        numbers: ticketNumbers,
        group: myGroup,
        rank: winResult.rank,
        prizeAmount: prizeAmount,
        prizeLabel: prizeLabel,
        resultLabel: winResult.label
      }];

      const totalLabel = winResult.rank > 0 ? prizeLabel : (winResult.rank === 0 ? "낙첨" : "추첨전");

      const pensionResultData = {
        lotteryType: "pension720",
        drawNo: parsed.drawNo,
        resultStatus: winResult.rank > 0 ? "win" : (winResult.rank === 0 ? "lose" : "pending"),
        rank: winResult.rank > 0 ? `${winResult.rank}등` : (winResult.rank === 0 ? "낙첨" : "추첨전"),
        result: winResult.rank > 0 ? `${winResult.rank}등` : (winResult.rank === 0 ? "낙첨" : "추첨전"),
        group: myGroup,
        numberText: diagnostics.numberText,
        numbers: ticketNumbers,
        prizeAmount: prizeAmount,
        prizeLabel: prizeLabel,
        totalPrizeAmount: prizeAmount,
        totalPrizeLabel: totalLabel,
        isBonusMatch: winResult.isBonusMatch || false,
        matchCount: winResult.matchCount || 0
      };

      setResults(gameResults);
      setTopRank(winResult.rank);
      setTotalPrize({ amount: prizeAmount, label: totalLabel, hasUnknown, winCount: winResult.rank > 0 ? 1 : 0 });
      
      if (!location.state?.fromHistory) {
        saveToHistory(parsed, winInfo, gameResults, winResult.rank, { amount: prizeAmount, label: totalLabel, hasUnknown, winCount: winResult.rank > 0 ? 1 : 0 }, pensionResultData);
      }
    } catch (checkErr) {
      if (import.meta.env.DEV) console.error("[PENSION CHECK ERROR]", checkErr);
      throw checkErr;
    }
  };

  const saveToHistory = (parsed, winInfo, gameResults, bestRank, prizeSummary, extraData = null, force = false) => {
    try {
      const storageKey = "bokgwon24_qr_history";
      const historyRaw = localStorage.getItem(storageKey) || "[]";
      let history = JSON.parse(historyRaw);
      if (!Array.isArray(history)) history = [];

      const recordToSave = {
        id: nanoid(),
        type: parsed.type,
        drawNo: parsed.drawNo,
        drawDate: winInfo?.drawDate || "",
        rawQr: parsed.rawQr,
        games: parsed.games || [],
        winningNumbers: winInfo?.numbers || [],
        bonusNo: winInfo?.bonusNo,
        results: gameResults || [],
        topRank: bestRank || 0,
        totalPrizeAmount: prizeSummary?.amount || 0,
        totalPrizeLabel: prizeSummary?.label || "",
        hasUnknownPrizeAmount: prizeSummary?.hasUnknown || false,
        winCount: prizeSummary?.winCount || 0,
        checkedAt: new Date().toISOString(),
        ...(extraData || {})
      };

      const newRecord = normalizeHistoryItem(recordToSave);
      if (!newRecord) return;

      // 중복 확인
      if (!force) {
        const isDuplicate = history.some(h => {
          if (h.duplicateKey && newRecord.duplicateKey) {
            return h.duplicateKey === newRecord.duplicateKey;
          }
          // duplicateKey가 없는 기존 데이터와 비교 (lotteryType, drawNo, group, numberText 등 기준)
          const hType = h.type || h.lotteryType;
          if (hType !== newRecord.type) return false;
          if (h.drawNo !== newRecord.drawNo) return false;
          
          if (hType === "pension720") {
            const hGroup = h.group || h.pensionGroup || h.selectedGroup;
            const nGroup = newRecord.group || newRecord.pensionGroup || newRecord.selectedGroup;
            const hNum = h.numberText || h.scannedNumberText || (Array.isArray(h.numbers) ? h.numbers.join("") : "");
            const nNum = newRecord.numberText || newRecord.scannedNumberText || (Array.isArray(newRecord.numbers) ? newRecord.numbers.join("") : "");
            return hGroup === nGroup && hNum === nNum;
          } else {
            // 로또는 rawQr 또는 게임 번호 조합 비교
            if (h.rawQr && newRecord.rawQr && h.rawQr === newRecord.rawQr) return true;
            const hGamesStr = (h.games || []).map(g => (g.numbers || []).join(",")).sort().join("|");
            const nGamesStr = (newRecord.games || []).map(g => (g.numbers || []).join(",")).sort().join("|");
            return hGamesStr === nGamesStr;
          }
        });

        if (isDuplicate) {
          setDuplicateModal({ show: true, data: { parsed, winInfo, gameResults, bestRank, prizeSummary, extraData, record: newRecord } });
          return;
        }
      }

      history.unshift(newRecord);
      localStorage.setItem(storageKey, JSON.stringify(history.slice(0, 50)));
      
      if (force) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error("History save error:", e);
    }
  };

  const getBallColor = (num) => {
    if (num <= 10) return '#fbc400';
    if (num <= 20) return '#69c8f2';
    if (num <= 30) return '#ff7272';
    if (num <= 40) return '#aaa';
    return '#b0d840';
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <Loader2 className="animate-spin" size={48} color="#2563EB" />
      <h2 style={{ marginTop: '24px', fontSize: '1.2rem', fontWeight: '800', color: '#1E293B' }}>당첨 결과를 분석하고 있습니다</h2>
    </div>
  );

  if (isPending && parsedData) {
    const isPension = parsedData.type === 'pension720';
    const drawTime = isPension 
      ? '연금복권720+는 매주 목요일 오후 7시 5분 경 추첨됩니다.'
      : '로또 6/45는 매주 토요일 오후 8시 35분 경 추첨됩니다.';

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F1F5F9', padding: '20px' }}>
        <header style={{ padding: '12px 0', marginBottom: '16px' }}>
          <button onClick={() => location.state?.fromHistory ? navigate("/my-tickets") : navigate("/")} style={backBtnStyle}>
            <ChevronLeft size={24} />
          </button>
        </header>
        <div style={{ backgroundColor: 'white', borderRadius: '28px', padding: '32px 20px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#1E293B', marginBottom: '16px' }}>추첨전입니다</h2>
          
          <p style={{ color: '#64748B', lineHeight: '1.6', marginBottom: '32px', fontSize: '1rem', fontWeight: '600' }}>
            {drawTime}<br />추첨 후 다시 확인해주세요.
          </p>

          <div style={{ background: '#F8FAFC', borderRadius: '20px', padding: '24px', border: '1px solid #E2E8F0', marginBottom: '32px' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: '800', color: '#94A3B8', marginBottom: '16px', letterSpacing: '0.05em' }}>스캔한 복권 정보</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748B', fontWeight: '700' }}>회차</span>
                <span style={{ color: '#1E293B', fontWeight: '900', fontSize: '1.1rem' }}>{parsedData.drawNo}회</span>
              </div>
              {isPension && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748B', fontWeight: '700' }}>조</span>
                    <span style={{ color: '#1E293B', fontWeight: '900', fontSize: '1.1rem' }}>{parsedData.group}조</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748B', fontWeight: '700' }}>번호</span>
                    <span style={{ color: '#2563EB', fontWeight: '900', fontSize: '1.1rem', letterSpacing: '2px' }}>{parsedData.numberText || (parsedData.numbers ? parsedData.numbers.join("") : "")}</span>
                  </div>
                </>
              )}
              {!isPension && parsedData.games && parsedData.games.length > 0 && (
                <div style={{ marginTop: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                    {parsedData.games[0].numbers.map((n, idx) => (
                      <LottoBall key={idx} number={n} size="32px" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={() => navigate('/scanner')} style={{ width: '100%', padding: '18px', borderRadius: '16px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: '900', fontSize: '1rem' }}>
              다른 복권 스캔
            </button>
            <button onClick={() => navigate('/')} style={{ width: '100%', padding: '18px', borderRadius: '16px', border: '1px solid #E2E8F0', backgroundColor: 'white', color: '#64748B', fontWeight: '800', fontSize: '1rem' }}>
              홈으로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', padding: '20px' }}>
      <header style={{ padding: '12px 0', marginBottom: '16px' }}>
        <button onClick={() => location.state?.fromHistory ? navigate("/my-tickets") : navigate("/")} style={backBtnStyle}>
          <ChevronLeft size={24} />
        </button>
      </header>
      <div style={{ backgroundColor: 'white', borderRadius: '28px', padding: '32px 20px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
        <AlertCircle size={56} color="#EF4444" style={{ margin: '0 auto 20px' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: '#1E293B', marginBottom: '12px' }}>확인 불가 안내</h2>
        <div style={{ color: '#64748B', lineHeight: '1.6', marginBottom: '24px', fontSize: '0.95rem', fontWeight: '600', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
        
        {SHOW_DEBUG && debugInfo && (
          <div style={{ textAlign: 'left', background: '#F8FAFC', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1E293B', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={16} color="#2563EB" /> 디버그 정보 (개발자용)
            </h3>
            <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><span style={{ fontWeight: '800' }}>QR 원문:</span> <span style={{ wordBreak: 'break-all' }}>{debugInfo.rawText}</span></div>
              <div><span style={{ fontWeight: '800' }}>v:</span> {debugInfo.qrValue}</div>
              <div><span style={{ fontWeight: '800' }}>leftPart:</span> {debugInfo.leftPart}</div>
              <div><span style={{ fontWeight: '800' }}>번호:</span> {debugInfo.numberText}</div>
              <div style={{ marginTop: '8px', borderTop: '1px dashed #CBD5E1', paddingTop: '8px' }}>
                <p style={{ fontWeight: '800', marginBottom: '6px' }}>파싱 후보 및 Firestore 확인:</p>
                {debugInfo.candidates.map((c, i) => (
                  <div key={i} style={{ padding: '6px', background: c.exists ? '#ECFDF5' : (c.isValid ? '#FFF1F2' : '#F1F5F9'), borderRadius: '6px', marginBottom: '4px', border: `1px solid ${c.exists ? '#10B981' : (c.isValid ? '#FECACA' : '#E2E8F0')}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800' }}>
                      <span>제 {c.drawNo}회 ({c.group || '?'}조)</span>
                      <span style={{ color: c.exists ? '#059669' : '#DC2626' }}>{c.exists ? '문서 있음' : '문서 없음'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <button onClick={() => navigate('/scanner')} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: '800', fontSize: '1rem' }}>다시 스캔하기</button>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#F1F5F9', minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ backgroundColor: 'white', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #E2E8F0' }}>
        <button onClick={() => location.state?.fromHistory ? navigate("/my-tickets") : navigate("/")} style={{ background: 'none', border: 'none', padding: '4px' }}>
          <ChevronLeft size={24} color="#1E293B" />
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h1 style={{ fontSize: '0.95rem', fontWeight: '900', color: '#1E293B' }}>
            {parsedData?.type === 'lotto645' ? '로또 6/45' : '연금복권 720+'}
          </h1>
          <p style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700' }}>제 {parsedData?.drawNo ?? '-'}회 ({winningInfo?.drawDate ?? '-'})</p>
        </div>
      </header>

      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '12px', border: '1px solid #E2E8F0' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: '900', color: '#64748B', marginBottom: '8px', textAlign: 'center' }}>당첨번호</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', alignItems: 'center' }}>
              {parsedData?.type === 'lotto645' ? (
                <>
                  {(winningInfo?.numbers || []).map((n, i) => (
                    <LottoBall key={i} number={n} size="30px" />
                  ))}
                  <span style={{ fontSize: '0.9rem', fontWeight: '900', color: '#CBD5E1' }}>+</span>
                  <LottoBall number={winningInfo?.bonusNo} size="30px" />
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: '900', color: '#1E293B' }}>{winningInfo?.firstPrizeNumber?.group}조</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(winningInfo?.firstPrizeNumber?.numbers || []).map((n, i) => (
                      <span key={i} style={{ width: '30px', height: '30px', borderRadius: '4px', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#1E293B' }}>{n}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ 
            backgroundColor: topRank > 0 ? '#FEF3C7' : 'white', 
            borderRadius: '16px', padding: '12px 16px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            border: topRank > 0 ? '2px solid #F59E0B' : '1px solid #E2E8F0'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {topRank > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: '950', color: '#92400E' }}>
                        {parsedData?.type === 'pension720' ? (results[0]?.resultLabel || `${topRank}등`) : `${topRank}등`} 당첨을 확인했습니다
                      </h2>
                      {parsedData?.type === 'lotto645' && totalPrize.winCount > 1 && (
                        <p style={{ fontSize: '0.8rem', color: '#B45309', fontWeight: '700' }}>총 {totalPrize.winCount}게임 당첨</p>
                      )}
                    </div>
                  </div>
                  
                  {totalPrize.label && (
                    <div style={{ 
                      marginTop: '8px', 
                      padding: '10px 20px', 
                      backgroundColor: 'rgba(245, 158, 11, 0.15)', 
                      borderRadius: '12px',
                      border: '1px solid rgba(245, 158, 11, 0.2)'
                    }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#B45309', marginBottom: '2px' }}>총 당첨금액</p>
                      <p style={{ fontSize: '1.2rem', fontWeight: '950', color: '#B45309' }}>
                        {totalPrize.label}
                        {totalPrize.hasUnknown && totalPrize.amount > 0 && <span style={{ fontSize: '0.85rem', marginLeft: '4px' }}>+ 미확인 당첨금</span>}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: '950', color: '#475569' }}>낙첨되었습니다</h2>
                </>
              )}
            </div>
          </div>

          <div style={{ backgroundColor: '#EEF2FF', padding: '8px 12px', borderRadius: '12px', display: 'flex', gap: '8px', border: '1px solid #E0E7FF' }}>
            <Heart size={14} color="#4F46E5" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '0.7rem', color: '#4338CA', fontWeight: '700', lineHeight: '1.3' }}>
              구매 금액의 40% 이상이 의미 있는 기부로 사용됩니다.
            </p>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0', marginTop: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr>
                  {parsedData?.type === 'pension720' ? (
                    <>
                      <th style={{ ...thStyle, width: '25%' }}>결과</th>
                      <th style={{ ...thStyle, width: '15%' }}>조</th>
                      <th style={{ ...thStyle, textAlign: 'left', width: '60%' }}>번호</th>
                    </>
                  ) : (
                    <>
                      <th style={{ ...thStyle, width: '20%' }}>게임</th>
                      <th style={{ ...thStyle, width: '20%' }}>결과</th>
                      <th style={{ ...thStyle, textAlign: 'left', width: '60%' }}>선택번호</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {React.useMemo(() => results.map((res, i) => {
                  const isPension = parsedData?.type === 'pension720';
                  
                  const LabelCell = (
                    <td key="label" style={{ ...tdStyle, fontWeight: '900', color: '#1E293B', fontSize: '0.9rem' }}>
                      {isPension ? `${res.group || "-"}조` : (res.label || '-')}
                    </td>
                  );

                  const ResultCell = (
                    <td key="result" style={{ ...tdStyle, color: res.rank > 0 ? '#2563EB' : '#94A3B8', fontWeight: '950', fontSize: '0.9rem' }}>
                      <div>{res.rank > 0 ? (res.resultLabel || res.label || `${res.rank}등`) : '낙첨'}</div>
                      {res.rank > 0 && res.prizeLabel && (
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', marginTop: '2px' }}>{res.prizeLabel}</div>
                      )}
                    </td>
                  );

                  const NumbersCell = (
                    <td key="numbers" style={{ ...tdStyle, textAlign: 'left', padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {isPension ? (
                          (res?.numbers || []).map((n, idx) => {
                            const winNums = winningInfo?.firstPrizeNumber?.numbers?.map(Number) || [];
                            let currentMatchCount = 0;
                            for (let k = 5; k >= 0; k--) {
                              if (res.numbers[k] === winNums[k]) currentMatchCount++;
                              else break;
                            }
                            const isMatch = idx >= (6 - currentMatchCount);
                            return (
                              <span key={idx} style={{ width: '28px', height: '28px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: '900', backgroundColor: isMatch ? '#2563EB' : 'transparent', color: isMatch ? 'white' : '#64748B', border: isMatch ? 'none' : '1.2px solid #E2E8F0' }}>
                                {n}
                              </span>
                            );
                          })
                        ) : (
                          (res?.numbers || []).map((n, idx) => {
                            const isMatch = (winningInfo?.numbers || []).includes(n);
                            const isBonusMatch = n === winningInfo?.bonusNo;
                            const ballBg = isMatch ? getBallColor(n) : (isBonusMatch ? '#F59E0B' : 'transparent');
                            return (
                              <span key={idx} style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: '900', backgroundColor: ballBg, color: (isMatch || isBonusMatch) ? 'white' : '#64748B', border: (isMatch || isBonusMatch) ? 'none' : '1.2px solid #E2E8F0' }}>
                                {n}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                  );

                  return (
                    <tr key={i} style={{ borderBottom: i === results.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                      {isPension ? (
                        <>
                          {ResultCell}
                          {LabelCell}
                          {NumbersCell}
                        </>
                      ) : (
                        <>
                          {LabelCell}
                          {ResultCell}
                          {NumbersCell}
                        </>
                      )}
                    </tr>
                  );
                }), [results, parsedData?.type, winningInfo])}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button onClick={() => navigate('/scanner', { replace: true })} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: 'white', color: '#1E293B', fontWeight: '800', fontSize: '0.9rem' }}>
              다른 복권 스캔
            </button>
            <button onClick={() => navigate('/')} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: '800', fontSize: '0.9rem' }}>
              홈으로 이동
            </button>
          </div>
        </div>
      </div>
      {/* 중복 확인 모달 */}
      {duplicateModal.show && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '320px', textAlign: 'center' }}>
            <div style={{ backgroundColor: '#FEF3C7', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Info size={24} color="#F59E0B" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#1E293B', marginBottom: '8px' }}>이미 확인된 복권입니다</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '600', marginBottom: '16px', lineHeight: '1.5' }}>
              {duplicateModal.data?.parsed?.type === 'lotto645' 
                ? `로또 6/45 제${duplicateModal.data.parsed.drawNo}회` 
                : `연금복권720+ 제${duplicateModal.data.parsed.drawNo}회 ${duplicateModal.data.parsed.group}조 ${duplicateModal.data.parsed.numberText}`}
              <br />확인목록에 다시 저장하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => {
                  setDuplicateModal({ show: false, data: null });
                  navigate("/", { replace: true });
                }}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: 'white', color: '#64748B', fontWeight: '800', fontSize: '0.9rem' }}
              >
                아니오
              </button>
              <button 
                onClick={() => {
                  const d = duplicateModal.data;
                  saveToHistory(d.parsed, d.winInfo, d.gameResults, d.bestRank, d.prizeSummary, d.extraData, true);
                  setDuplicateModal({ show: false, data: null });
                  navigate("/", { replace: true });
                }}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: '900', fontSize: '0.9rem' }}
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 완료 토스트 */}
      {saveSuccess && (
        <div style={{ position: 'fixed', bottom: '120px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1E293B', color: 'white', padding: '12px 24px', borderRadius: '30px', fontSize: '0.85rem', fontWeight: '800', zIndex: 3000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          확인목록에 저장되었습니다.
        </div>
      )}
    </div>
  );
};

const backBtnStyle = {
  width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'white', border: '1px solid #E2E8F0',
  display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
};

const thStyle = { padding: '10px 8px', fontSize: '0.7rem', fontWeight: '800', color: '#94A3B8', textAlign: 'center' };
const tdStyle = { padding: '12px 8px', fontSize: '0.8rem', textAlign: 'center' };

export default CheckResult;
