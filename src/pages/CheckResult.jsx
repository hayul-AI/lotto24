import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Trophy, AlertCircle, CheckCircle2, Info, Loader2, ExternalLink, Heart } from 'lucide-react';
import { getLottoResultByDrawNo, getPensionResultByDrawNo, getPensionResultsDebug, getPensionDocStatus } from '../services/lottoService';
import LottoBall from '../components/LottoBall';
import { parseLotteryQr } from '../utils/qrParser';
import { checkLottoWinning } from '../utils/checkLottoResult';
import { checkPensionRank } from '../utils/checkPensionResult';
import { normalizeHistoryItem } from '../services/localTicketService';
import { nanoid } from 'nanoid';

const CheckResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [results, setResults] = useState([]);
  const [topRank, setTopRank] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    initCheck();
  }, [location.state]);

  const initCheck = async () => {
    setLoading(true);
    setError("");

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
      console.error(err);
      const msg = err.message;
      if (msg.includes("등록되지 않았습니다") || 
          msg.includes("번호를 읽을 수 없습니다") || 
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
      throw new Error(`제${parsed.drawNo}회 당첨번호 데이터가 아직 없습니다.`);
    }
    
    setWinningInfo(winInfo);
    
    const gameResults = parsed.games.map(game => {
      const win = checkLottoWinning(game, winInfo);
      return { ...game, ...win };
    });

    const validRanks = gameResults.filter(r => r.rank > 0).map(r => r.rank);
    const bestRank = validRanks.length > 0 ? Math.min(...validRanks) : 0;
    
    setResults(gameResults);
    setTopRank(bestRank);

    saveToHistory(parsed, winInfo, gameResults, bestRank);
  };

  const handlePensionCheck = async (parsed) => {
    // 디버그 정보 초기화
    const diagnostics = {
      rawText: parsed.rawText,
      qrValue: parsed.qrValue,
      leftPart: parsed.leftPart,
      numberText: parsed.numberText,
      candidates: [],
      latestDocs: []
    };

    // 후보군 생성 (사용자 요청 기반)
    const candidates = [];
    if (parsed.leftPart && parsed.leftPart.length === 7) {
      // 후보 A: pd120 + drawNo(3) + group(1)
      candidates.push({ 
        drawNo: Number(parsed.leftPart.substring(3, 6)), 
        group: parsed.leftPart.substring(6, 7),
        rule: "pd120 + 315 + 1"
      });
      // 후보 B: pd120 + drawNo(2) + group(2)
      candidates.push({ 
        drawNo: Number(parsed.leftPart.substring(3, 5)), 
        group: parsed.leftPart.substring(5, 7),
        rule: "pd120 + 31 + 51"
      });
      // 후보 C: pd1203 + drawNo(3)
      candidates.push({ 
        drawNo: Number(parsed.leftPart.substring(4, 7)), 
        group: null,
        rule: "pd1203 + 151"
      });
    }

    // 기존 파서 결과가 있다면 그것도 후보에 추가
    if (parsed.drawNo && !candidates.some(c => c.drawNo === parsed.drawNo)) {
      candidates.push({ drawNo: parsed.drawNo, group: parsed.group, rule: "default parser" });
    }

    // 각 후보에 대해 Firestore 존재 여부 확인
    for (const c of candidates) {
      const status = await getPensionDocStatus(c.drawNo);
      c.exists = status.exists;
      c.data = status.data;
    }
    diagnostics.candidates = candidates;

    // 최신 문서 5개 조회
    const latest = await getPensionResultsDebug(5);
    diagnostics.latestDocs = latest.data || [];

    setDebugInfo(diagnostics);

    console.log("[PENSION QR DEBUG]", diagnostics);

    // 1. 실제 존재하는 문서 찾기
    const winnerCandidate = candidates.find(c => c.exists);

    if (!winnerCandidate) {
      throw new Error(`연금복권 QR은 인식했지만 해당 회차 결과가 등록되어 있지 않습니다.\n(조회된 후보: ${candidates.map(c => c.drawNo).join(", ")})`);
    }

    const winInfo = winnerCandidate.data;
    setWinningInfo(winInfo);

    const ticketNumbers = parsed.numbers;
    if (!ticketNumbers || ticketNumbers.length !== 6) {
      throw new Error("연금복권 번호를 읽을 수 없습니다.");
    }

    const winGroup = Number(winInfo.firstPrizeNumber?.group ?? 0);
    const winNumbers = Array.isArray(winInfo.firstPrizeNumber?.numbers) 
      ? winInfo.firstPrizeNumber.numbers.map(Number) 
      : [];

    const winResult = checkPensionRank({ grade: Number(winnerCandidate.group), numbers: ticketNumbers }, { grade: winGroup, winning: winNumbers });
    
    const gameResults = [{
      label: "A",
      numbers: ticketNumbers,
      group: Number(winnerCandidate.group),
      rank: winResult.rank,
      prize: winResult.prize,
      resultLabel: winResult.label
    }];

    setResults(gameResults);
    setTopRank(winResult.rank);
    saveToHistory(parsed, winInfo, gameResults, winResult.rank);
  };

  const saveToHistory = (parsed, winInfo, gameResults, bestRank) => {
    try {
      const storageKey = "bokgwon24_qr_history";
      const historyRaw = localStorage.getItem(storageKey) || "[]";
      let history = JSON.parse(historyRaw);
      
      if (!Array.isArray(history)) history = [];

      // 중복 확인
      if (history.some(h => h.rawQr === parsed.rawQr)) return;

      const newRecord = normalizeHistoryItem({
        id: nanoid(),
        type: parsed.type,
        drawNo: parsed.drawNo,
        drawDate: winInfo?.drawDate || "",
        rawQr: parsed.rawQr,
        games: parsed.games,
        winningNumbers: winInfo?.numbers || [],
        bonusNo: winInfo?.bonusNo,
        results: gameResults,
        topRank: bestRank,
        checkedAt: new Date().toISOString()
      });

      if (!newRecord) {
        console.warn("Invalid record, skip saving", parsed);
        return;
      }

      history.unshift(newRecord);
      localStorage.setItem(storageKey, JSON.stringify(history.slice(0, 50)));
    } catch (e) {
      console.error("History save error:", e);
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

  if (error) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', padding: '20px' }}>
      <header style={{ padding: '12px 0', marginBottom: '16px' }}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}><ChevronLeft size={24} /></button>
      </header>
      <div style={{ backgroundColor: 'white', borderRadius: '28px', padding: '32px 20px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
        <AlertCircle size={56} color="#F59E0B" style={{ margin: '0 auto 20px' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: '#1E293B', marginBottom: '12px' }}>확인 불가 안내</h2>
        <div style={{ color: '#64748B', lineHeight: '1.6', marginBottom: '24px', fontSize: '0.95rem', fontWeight: '600', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
        
        {/* 디버그 진단 섹션 */}
        {debugInfo && (
          <div style={{ textAlign: 'left', background: '#F8FAFC', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1E293B', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={16} color="#2563EB" /> 연금복권 QR 분석 결과
            </h3>
            
            <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><span style={{ fontWeight: '800' }}>QR 원문:</span> <span style={{ wordBreak: 'break-all' }}>{debugInfo.rawText}</span></div>
              <div><span style={{ fontWeight: '800' }}>v:</span> {debugInfo.qrValue}</div>
              <div><span style={{ fontWeight: '800' }}>leftPart:</span> {debugInfo.leftPart}</div>
              <div><span style={{ fontWeight: '800' }}>번호:</span> {debugInfo.numberText}</div>
              
              <div style={{ marginTop: '8px', borderTop: '1px dashed #CBD5E1', paddingTop: '8px' }}>
                <p style={{ fontWeight: '800', marginBottom: '6px' }}>파싱 후보 및 Firestore 확인:</p>
                {debugInfo.candidates.map((c, i) => (
                  <div key={i} style={{ padding: '6px', background: c.exists ? '#ECFDF5' : '#FFF1F2', borderRadius: '6px', marginBottom: '4px', border: `1px solid ${c.exists ? '#10B981' : '#FECACA'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800' }}>
                      <span>제 {c.drawNo}회 ({c.group || '?'}조)</span>
                      <span style={{ color: c.exists ? '#059669' : '#DC2626' }}>{c.exists ? '문서 있음' : '문서 없음'}</span>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748B' }}>규칙: {c.rule}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '8px', borderTop: '1px dashed #CBD5E1', paddingTop: '8px' }}>
                <p style={{ fontWeight: '800', marginBottom: '6px' }}>Firestore 최신 회차 (pension_results):</p>
                {debugInfo.latestDocs.map((d, i) => (
                  <div key={i} style={{ fontSize: '0.7rem', color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                    <span>제 {d.drawNo}회 ({d.drawDate})</span>
                    <span>ID: {d.id}</span>
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
      {/* 1. 헤더 - 최소 높이로 축소 */}
      <header style={{ backgroundColor: 'white', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #E2E8F0' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: '4px' }}><ChevronLeft size={24} color="#1E293B" /></button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h1 style={{ fontSize: '0.95rem', fontWeight: '900', color: '#1E293B' }}>
            {parsedData?.type === 'lotto645' ? '로또 6/45' : '연금복권 720+'}
          </h1>
          <p style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '700' }}>제 {parsedData?.drawNo ?? '-'}회 ({winningInfo?.drawDate ?? '-'})</p>
        </div>
      </header>

      <div style={{ padding: '10px 12px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* 2. 당첨번호 카드 - 슬림화 */}
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
                      <span key={i} style={{ 
                        width: '30px', height: '30px', borderRadius: '4px', 
                        backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', 
                        justifyContent: 'center', fontWeight: '900', color: '#1E293B'
                      }}>{n}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. 추첨결과 카드 - 초슬림화 */}
          <div style={{ 
            backgroundColor: topRank > 0 ? '#FEF3C7' : 'white', 
            borderRadius: '16px', padding: '10px 16px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            border: topRank > 0 ? '2px solid #F59E0B' : '1px solid #E2E8F0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              {topRank > 0 ? (
                <>
                  <Trophy size={24} color="#F59E0B" />
                  <h2 style={{ fontSize: '1.05rem', fontWeight: '950', color: '#92400E' }}>{topRank}등 당첨! 축하합니다</h2>
                </>
              ) : (
                <>
                  <CheckCircle2 size={24} color="#94A3B8" />
                  <h2 style={{ fontSize: '1.05rem', fontWeight: '950', color: '#475569' }}>낙첨되었습니다</h2>
                </>
              )}
            </div>
          </div>

          {/* 4. 안내문 - 한 줄 압축 */}
          <div style={{ backgroundColor: '#EEF2FF', padding: '8px 12px', borderRadius: '12px', display: 'flex', gap: '8px', border: '1px solid #E0E7FF' }}>
            <Heart size={14} color="#4F46E5" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '0.7rem', color: '#4338CA', fontWeight: '700', lineHeight: '1.3' }}>
              구매 금액의 40% 이상이 의미 있는 기부로 사용됩니다.
            </p>
          </div>

          {/* 5. 선택번호 결과표 - 메인 영역 확대 */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0', marginTop: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr>
                  <th style={{ ...thStyle, width: '20%' }}>{parsedData?.type === 'lotto645' ? '게임' : '조'}</th>
                  <th style={{ ...thStyle, width: '20%' }}>결과</th>
                  <th style={{ ...thStyle, textAlign: 'left', width: '60%' }}>선택번호</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res, i) => (
                  <tr key={i} style={{ borderBottom: i === results.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                    <td style={{ ...tdStyle, fontWeight: '900', color: '#1E293B', fontSize: '0.9rem' }}>
                      {parsedData?.type === 'lotto645' ? res.label : `${res.group}조`}
                    </td>
                    <td style={{ ...tdStyle, color: res.rank > 0 ? '#2563EB' : '#94A3B8', fontWeight: '950', fontSize: '0.9rem' }}>
                      {res.rank > 0 ? (res.resultLabel || res.label || `${res.rank}등`) : '낙첨'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left', padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {parsedData?.type === 'lotto645' ? (
                          (res?.numbers || []).map((n, idx) => {
                            const isMatch = (winningInfo?.numbers || []).includes(n);
                            const isBonusMatch = n === winningInfo?.bonusNo;
                            const ballBg = isMatch ? getBallColor(n) : (isBonusMatch ? '#F59E0B' : 'transparent');
                            
                            return (
                              <span key={idx} style={{ 
                                width: '28px', height: '28px', borderRadius: '50%', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.85rem', fontWeight: '900',
                                backgroundColor: ballBg,
                                color: (isMatch || isBonusMatch) ? 'white' : '#64748B',
                                border: (isMatch || isBonusMatch) ? 'none' : '1.2px solid #E2E8F0'
                              }}>
                                {n}
                              </span>
                            );
                          })
                        ) : (
                          (res?.numbers || []).map((n, idx) => {
                            const winNums = winningInfo?.firstPrizeNumber?.numbers?.map(Number) || [];
                            // 뒤에서부터 일치 여부 확인 (연금복권 특성)
                            const matchLen = 6 - idx; // 현재 위치 포함 뒤로 남은 길이
                            // 실제 로직: 뒤에서부터 m개가 일치하는지 확인
                            // 여기서는 시각적으로 뒤에서부터 일치하는 숫자를 강조
                            const winAtIdx = winNums[idx];
                            
                            // 연금복권은 뒤에서부터 일치해야 하므로 간단히 체크
                            let isMatch = false;
                            const myNums = res.numbers;
                            let currentMatchCount = 0;
                            for (let k = 5; k >= 0; k--) {
                              if (myNums[k] === winNums[k]) currentMatchCount++;
                              else break;
                            }
                            
                            // 현재 위치가 일치하는 범위 내에 있는지 확인
                            if (idx >= (6 - currentMatchCount)) {
                                isMatch = true;
                            }

                            return (
                              <span key={idx} style={{ 
                                width: '28px', height: '28px', borderRadius: '4px', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.9rem', fontWeight: '900',
                                backgroundColor: isMatch ? '#2563EB' : 'transparent',
                                color: isMatch ? 'white' : '#64748B',
                                border: isMatch ? 'none' : '1.2px solid #E2E8F0'
                              }}>
                                {n}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 하단 보조 버튼 */}
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button onClick={() => navigate('/scanner')} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: 'white', color: '#1E293B', fontWeight: '800', fontSize: '0.9rem' }}>
              다른 복권 스캔
            </button>
            <button onClick={() => navigate('/')} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: '800', fontSize: '0.9rem' }}>
              홈으로 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const backBtnStyle = {
  width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'white', border: '1px solid #E2E8F0',
  display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
};

const thStyle = {
  padding: '10px 8px', fontSize: '0.7rem', fontWeight: '800', color: '#94A3B8', textAlign: 'center'
};

const tdStyle = {
  padding: '12px 8px', fontSize: '0.8rem', textAlign: 'center'
};

export default CheckResult;
