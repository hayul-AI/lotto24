import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQrHistory, deleteQrRecord, clearQrHistory, normalizeHistoryItem } from '../services/localTicketService';
import { Trash2, ChevronLeft, Calendar, Trophy, History, ExternalLink, Filter, ArrowUpDown } from 'lucide-react';

const MyTickets = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [sortFilter, setSortFilter] = useState('latest'); // latest, drawNo
  const [typeFilter, setTypeFilter] = useState('all'); // all, lotto, pension

  useEffect(() => {
    loadHistory();
  }, [sortFilter, typeFilter]);

  const loadHistory = () => {
    try {
      let data = getQrHistory();
      console.log(`[MyTickets] Raw history loaded: ${data.length} items`);

      // 1. 종류 필터링
      if (typeFilter === 'lotto') {
        data = data.filter(item => item.type === 'lotto645');
      } else if (typeFilter === 'pension') {
        data = data.filter(item => item.type === 'pension720');
      }

      // 2. 정렬 필터링
      if (sortFilter === 'drawNo') {
        data.sort((a, b) => (b?.drawNo ?? 0) - (a?.drawNo ?? 0));
      } else {
        data.sort((a, b) => new Date(b?.checkedAt || 0) - new Date(a?.checkedAt || 0));
      }
      setHistory(data);
    } catch (e) {
      console.error("[MyTickets] Error loading history:", e);
      setHistory([]);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('이 확인 기록을 삭제할까요?')) {
      deleteQrRecord(id);
      loadHistory();
    }
  };

  const handleClear = () => {
    if (window.confirm('모든 기록을 삭제하시겠습니까?')) {
      clearQrHistory();
      setHistory([]);
    }
  };

  const getBallColor = (num) => {
    if (num <= 10) return '#fbc400'; // 노랑
    if (num <= 20) return '#69c8f2'; // 파랑
    if (num <= 30) return '#ff7272'; // 빨강
    if (num <= 40) return '#aaa';    // 회색
    return '#b0d840';                // 초록
  };

  const renderGameRow = (game, record) => {
    if (!game || !record) return null;
    const isPension = record.type === 'pension720';
    const gameResult = record.results?.find(r => r?.label === game?.label);
    const winNums = record.winningNumbers || [];
    const bonusNo = record.bonusNo;

    return (
      <tr key={game.label} style={{ borderBottom: '1px solid #F1F5F9' }}>
        <td style={{ ...tdStyle, fontWeight: '900', color: '#1E293B', fontSize: '1rem' }}>
          {isPension ? `${game?.group || '?'}조` : (game?.label || '-')}
        </td>
        <td style={{ ...tdStyle, color: (gameResult?.rank > 0) ? '#2563EB' : '#94A3B8', fontWeight: '950', fontSize: '1rem' }}>
          <div>{gameResult?.rank > 0 ? `${gameResult.rank}등` : '낙첨'}</div>
          {gameResult?.rank > 0 && gameResult.prizeLabel && (
            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748B', marginTop: '2px' }}>{gameResult.prizeLabel}</div>
          )}
        </td>
        <td style={{ ...tdStyle, textAlign: 'left', padding: '12px 8px' }}>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {(game?.numbers || []).map((n, i) => {
              // 연금복권은 인덱스별 비교, 로또는 포함 여부 비교
              const isMatch = isPension 
                ? (winNums[i] === n)
                : winNums.includes(n);
              
              const isBonusMatch = !isPension && n === bonusNo;
              
              const ballBg = isMatch 
                ? (isPension ? '#2563EB' : getBallColor(n)) 
                : (isBonusMatch ? '#F59E0B' : 'transparent');
              
              return (
                <span key={i} style={{
                  width: '28px', height: '28px', borderRadius: isPension ? '4px' : '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', fontWeight: '900',
                  backgroundColor: ballBg,
                  color: (isMatch || isBonusMatch) ? 'white' : '#64748B',
                  border: (isMatch || isBonusMatch) ? 'none' : '1.2px solid #E2E8F0'
                }}>
                  {n}
                </span>
              );
            })}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', paddingBottom: '100px' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: 'white', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => navigate("/")} 
            style={{ background: 'none', border: 'none', color: '#1E293B', padding: '4px' }}
          >
            <ChevronLeft size={24} />
          </button>
          <h1 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1E293B' }}>확인 목록</h1>
        </div>
        {history.length > 0 && (
          <button onClick={handleClear} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '0.85rem', fontWeight: '800' }}>
            전체 비우기
          </button>
        )}
      </header>

      {/* 필터 및 정렬 영역 */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #F1F5F9' }}>
        {/* 종류 필터 */}
        <div style={{ padding: '12px 20px 6px', display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <button 
            onClick={() => setTypeFilter('all')}
            style={{ ...filterBtnStyle, backgroundColor: typeFilter === 'all' ? '#1E293B' : '#F1F5F9', color: typeFilter === 'all' ? 'white' : '#64748B' }}
          >
            전체
          </button>
          <button 
            onClick={() => setTypeFilter('lotto')}
            style={{ ...filterBtnStyle, backgroundColor: typeFilter === 'lotto' ? '#2563EB' : '#F1F5F9', color: typeFilter === 'lotto' ? 'white' : '#64748B' }}
          >
            로또 6/45
          </button>
          <button 
            onClick={() => setTypeFilter('pension')}
            style={{ ...filterBtnStyle, backgroundColor: typeFilter === 'pension' ? '#10B981' : '#F1F5F9', color: typeFilter === 'pension' ? 'white' : '#64748B' }}
          >
            연금복권 720+
          </button>
        </div>

        {/* 정렬 필터 */}
        <div style={{ padding: '6px 20px 12px', display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setSortFilter('latest')}
            style={{ ...sortBtnStyle, color: sortFilter === 'latest' ? '#1E293B' : '#94A3B8', fontWeight: sortFilter === 'latest' ? '900' : '700' }}
          >
            <ArrowUpDown size={14} /> 최신순
          </button>
          <button 
            onClick={() => setSortFilter('drawNo')}
            style={{ ...sortBtnStyle, color: sortFilter === 'drawNo' ? '#1E293B' : '#94A3B8', fontWeight: sortFilter === 'drawNo' ? '900' : '700' }}
          >
            <Filter size={14} /> 회차순
          </button>
        </div>
      </div>

      <div style={{ padding: '12px' }}>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: '80px', height: '80px', backgroundColor: '#F1F5F9', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <History size={40} color="#CBD5E1" />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1E293B', marginBottom: '8px' }}>저장된 기록이 없습니다</h2>
            <button onClick={() => navigate('/scanner')} style={{ marginTop: '20px', padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: '800' }}>스캔하러 가기</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {history.map((rawItem) => {
              // 1. 렌더링 직전 다시 한 번 정규화 (절대적 안정성)
              const record = normalizeHistoryItem(rawItem);
              if (!record) return null;
              
              const drawNo = record.drawNo;
              const recordId = record.id;
              
              return (
                <div key={recordId} style={{ backgroundColor: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}>
                  {/* 카드 상단 정보 */}
                  <div style={{ padding: '14px 18px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ 
                        backgroundColor: record.type === 'pension720' ? '#ECFDF5' : '#EFF6FF', 
                        color: record.type === 'pension720' ? '#059669' : '#2563EB', 
                        fontSize: '0.75rem', fontWeight: '900', padding: '2px 8px', borderRadius: '6px' 
                      }}>
                        {record.type === 'pension720' ? '연금복권 720+' : '로또 6/45'}
                      </span>
                      <span style={{ fontSize: '1.15rem', fontWeight: '950', color: '#1E293B' }}>
                         제 {drawNo}회
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: '700' }}>
                        {record?.checkedAt ? new Date(record.checkedAt).toLocaleDateString().replace(/\./g, '/').slice(0, -1) : '-'}
                      </span>
                      {(record?.topRank ?? 0) > 0 && (
                        <span style={{ backgroundColor: '#FEF3C7', color: '#B45309', fontSize: '0.8rem', fontWeight: '900', padding: '3px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Trophy size={14} /> {record.topRank}등
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (record?.id) handleDelete(record.id);
                      }}
                      style={{ background: 'none', border: 'none', color: '#FDA4AF', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* 당첨 요약 바 */}
                  {record.topRank > 0 && (
                    <div style={{ padding: '10px 18px', backgroundColor: '#FFFBEB', borderBottom: '1px solid #FEF3C7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#B45309' }}>
                        {record.type === 'lotto645' ? `${record.games.length}게임 중 ${record.winCount}게임 당첨` : '당첨'}
                      </span>
                      {record.totalPrizeLabel && (
                        <span style={{ fontSize: '0.9rem', fontWeight: '950', color: '#92400E' }}>
                          총 {record.totalPrizeLabel}{record.hasUnknownPrizeAmount && record.totalPrizeAmount > 0 ? ' + 미확인 당첨금' : ''}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 메인 결과표 영역 */}
                  <div 
                    style={{ padding: '0', cursor: 'pointer' }} 
                    onClick={() => {
                      if (record && (record.rawQr || record.drawNo)) {
                        navigate('/qr-result', { state: { rawQr: record.rawQr, parsed: record } });
                      }
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#FBFCFE', borderBottom: '1.5px solid #F1F5F9' }}>
                          <th style={{ ...thStyle, width: '15%' }}>게임</th>
                          <th style={{ ...thStyle, width: '20%' }}>결과</th>
                          <th style={{ ...thStyle, textAlign: 'left', width: '65%' }}>번호</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(record?.games && Array.isArray(record.games) && record.games.length > 0) ? record.games.map((game, gIdx) => (
                          <React.Fragment key={game?.label || gIdx}>
                            {renderGameRow(game, record)}
                          </React.Fragment>
                        )) : (
                          <tr>
                            <td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem' }}>
                              게임 데이터 정보가 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const filterBtnStyle = {
  padding: '10px 16px', borderRadius: '20px', border: 'none', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0
};

const thStyle = {
  padding: '12px 8px', fontSize: '0.85rem', fontWeight: '900', color: '#94A3B8', textAlign: 'center'
};

const sortBtnStyle = {
  background: 'none', border: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0'
};

const tdStyle = {
  padding: '14px 8px', textAlign: 'center', fontSize: '0.9rem'
};

export default MyTickets;
