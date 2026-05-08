import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, ChevronRight, AlertTriangle, Info, X } from 'lucide-react';
import { getAllLottoResults, getAllPensionResults } from '../services/lottoService';
import LottoBall from '../components/LottoBall';
import PensionNumbers from '../components/PensionNumbers';
import Logo from '../components/Logo';
import { formatDate, formatCurrencyKRW, formatDrawNo } from '../utils/formatters';

import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const Home = () => {
  const navigate = useNavigate();
  const [lotto, setLotto] = useState(null);
  const [pension, setPension] = useState(null);
  const [lottoList, setLottoList] = useState([]);
  const [pensionList, setPensionList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lottoError, setLottoError] = useState(null);
  const [pensionError, setPensionError] = useState(null);
  const [showLottoGuide, setShowLottoGuide] = useState(false);
  const [showPensionGuide, setShowPensionGuide] = useState(false);

  useEffect(() => {
    // 1. 로또 실시간 리스너 (최신순 100개 목록 + 최신 1개 상세)
    const lottoQuery = query(collection(db, "lotto_results"), orderBy("drawNo", "desc"), limit(100));
    const unsubscribeLotto = onSnapshot(lottoQuery, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (results.length > 0) {
        setLottoList(results);
        setLotto(results[0]);
      }
      setLoading(false);
    }, (err) => {
      console.error("Lotto sync error:", err);
      setLottoError(err.message);
      setLoading(false);
    });

    // 2. 연금복권 실시간 리스너
    const pensionQuery = query(collection(db, "pension_results"), orderBy("drawNo", "desc"), limit(100));
    const unsubscribePension = onSnapshot(pensionQuery, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (results.length > 0) {
        setPensionList(results);
        setPension(results[0]);
      }
    }, (err) => {
      console.error("Pension sync error:", err);
      setPensionError(err.message);
    });

    return () => {
      unsubscribeLotto();
      unsubscribePension();
    };
  }, []);

  // 관리자 모드 진입을 위한 숨겨진 터치 상태
  const [adminTouchCount, setAdminTouchCount] = useState(0);
  const [lastTouchTime, setLastTouchTime] = useState(0);

  const handleAdminSecretTouch = () => {
    const now = Date.now();
    // 3초 이상 멈추면 초기화
    if (now - lastTouchTime > 3000) {
      setAdminTouchCount(1);
    } else {
      const newCount = adminTouchCount + 1;
      if (newCount >= 7) {
        setAdminTouchCount(0);
        navigate('/admin-lottery');
        return;
      }
      setAdminTouchCount(newCount);
    }
    setLastTouchTime(now);
  };

  return (
    <div className="container page-transition" style={{ paddingBottom: '120px', paddingTop: '16px' }}>
      <header className="flex-between mb-24" style={{ padding: '4px 0' }}>
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          onClick={handleAdminSecretTouch}
        >
          <Logo size={40} />
          <h1 className="title-xl" style={{ lineHeight: 1, fontSize: '1.5rem', marginBottom: 0 }}>복권24</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => navigate('/stores')}
            style={topBtnStyle}
          >
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--primary-blue)' }} />
            판매점
          </button>
          <button 
            onClick={() => navigate('/guide')}
            style={topBtnStyle}
          >
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--primary-blue)' }} />
            가이드
          </button>
        </div>
      </header>

      <div
        className="card card-clickable"
        onClick={() => navigate('/scanner')}
        style={{
          backgroundColor: 'var(--primary-blue)',
          color: 'white',
          border: 'none',
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 20px rgba(30,58,138,0.12)',
          marginBottom: '24px',
          borderRadius: '18px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '8px', borderRadius: '12px' }}>
            <QrCode size={20} />
          </div>
          <div>
            <h2 className="title-md" style={{ color: 'white', fontSize: '1.05rem', marginBottom: '2px' }}>당첨 확인하기</h2>
            <p style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: '600' }}>QR 코드 스캔 바로가기</p>
          </div>
        </div>
        <ChevronRight size={22} style={{ opacity: 0.6 }} />
      </div>

      <section className="mb-20">
        <div className="flex-between mb-12" style={{ padding: '0 4px' }}>
          <h3 className="title-md">로또 6/45</h3>
          <button 
            onClick={() => setShowLottoGuide(true)}
            style={{ ...guideBtnStyle }}
          >
            게임정보
          </button>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          {loading ? (
            <div className="skeleton" style={{ height: '180px', borderRadius: '16px' }} />
          ) : lottoError ? (
            <NoDataNotice />
          ) : lotto ? (
            <div>
              <div className="flex-between mb-16">
                <select 
                  value={lotto.drawNo} 
                  onChange={(e) => setLotto(lottoList.find(d => Number(d.drawNo) === Number(e.target.value)))}
                  style={{
                    fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary-blue)',
                    border: 'none', backgroundColor: 'transparent', outline: 'none',
                    cursor: 'pointer', appearance: 'none', paddingRight: '20px',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'18\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%231E3A8A\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right center'
                  }}
                >
                  {lottoList.map(d => (
                    <option key={d.drawNo} value={d.drawNo}>
                      {formatDrawNo(d.drawNo)} ({d.drawDate})
                    </option>
                  ))}
                </select>
                <span className="text-caption">{formatDate(lotto.drawDate)}</span>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: 'clamp(4px, 1.5vw, 8px)', 
                marginBottom: '16px', 
                padding: '4px 0',
                flexWrap: 'nowrap',
                overflowX: 'visible'
              }}>
                {lotto.numbers?.map((n, i) => <LottoBall key={i} number={n} size="clamp(32px, 9vw, 44px)" />)}
                <span style={{ fontSize: 'clamp(1rem, 4vw, 1.4rem)', fontWeight: '900', color: '#E5E8EB', margin: '0 2px' }}>+</span>
                <LottoBall number={lotto.bonusNo} size="clamp(32px, 9vw, 44px)" />
              </div>

              <div style={{ backgroundColor: '#F8FAFC', borderRadius: '16px', padding: '16px' }}>
                <div className="flex-between mb-8">
                  <span className="text-caption" style={{ fontWeight: '700' }}>1등 당첨금</span>
                  <span style={{ fontWeight: '900', color: lotto.firstPrizeAmount > 0 ? 'var(--primary-blue)' : '#94A3B8', fontSize: '1.1rem' }}>
                    {lotto.firstPrizeAmount > 0 ? formatCurrencyKRW(lotto.firstPrizeAmount) : '당첨금 정보 없음'}
                  </span>
                </div>
                <div className="flex-between">
                  <span className="text-caption" style={{ fontWeight: '700' }}>1등 당첨자 수</span>
                  <span style={{ fontWeight: '800' }}>
                    {lotto.firstWinnerCount > 0 ? `${lotto.firstWinnerCount}명` : '정보 없음'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mb-20">
        <div className="flex-between mb-12" style={{ padding: '0 4px' }}>
          <h3 className="title-md">연금복권 720+</h3>
          <button 
            onClick={() => setShowPensionGuide(true)}
            style={{ ...guideBtnStyle }}
          >
            게임정보
          </button>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          {loading ? (
            <div className="skeleton" style={{ height: '140px', borderRadius: '16px' }} />
          ) : pensionError ? (
            <NoDataNotice />
          ) : pension ? (
            <div>
              <div className="flex-between mb-16">
                <select 
                  value={pension.drawNo} 
                  onChange={(e) => setPension(pensionList.find(d => Number(d.drawNo) === Number(e.target.value)))}
                  style={{
                    fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary-blue)',
                    border: 'none', backgroundColor: 'transparent', outline: 'none',
                    cursor: 'pointer', appearance: 'none', paddingRight: '20px',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'18\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%231E3A8A\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right center'
                  }}
                >
                  {pensionList.map(d => (
                    <option key={d.drawNo} value={d.drawNo}>
                      {formatDrawNo(d.drawNo)} ({d.drawDate})
                    </option>
                  ))}
                </select>
                <span className="text-caption">{formatDate(pension.drawDate)}</span>
              </div>

              <PensionNumbers 
                group={pension.firstPrizeNumber.group} 
                numbers={pension.firstPrizeNumber.numbers} 
              />

              <div style={{ backgroundColor: '#F8FAFC', borderRadius: '16px', padding: '16px', marginTop: '20px' }}>
                <div className="flex-between">
                  <span className="text-caption" style={{ fontWeight: '700' }}>1등 당첨금</span>
                  <span style={{ fontWeight: '900', color: 'var(--primary-blue)' }}>월 700만원 × 20년</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {/* 게임방법 모달들 */}
      {showLottoGuide && (
        <div style={modalOverlayStyle} onClick={() => setShowLottoGuide(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontWeight: '900', fontSize: '1.2rem', color: 'var(--primary-blue)' }}>로또 6/45 게임정보</h4>
              <button onClick={() => setShowLottoGuide(false)} style={{ background: 'none', border: 'none', color: '#94A3B8' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>
              <p>• 1게임 1,000원</p>
              <p>• 1부터 45까지의 숫자 중 6개를 선택합니다.</p>
              <p>• 추첨된 당첨번호와 일치한 개수에 따라 당첨 여부가 결정됩니다.</p>
              <p>• 판매처: 전국 로또복권 판매점, 동행복권 홈페이지</p>
              <p>• 추첨시간: 매주 토요일 20:35경</p>
              <p>• 당첨금 지급률: 판매액의 50%</p>
              <p>• 1등 당첨확률: 1/8,145,060</p>
              <p>• 전체 당첨확률: 약 1/42</p>
            </div>
          </div>
        </div>
      )}

      {showPensionGuide && (
        <div style={modalOverlayStyle} onClick={() => setShowPensionGuide(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontWeight: '900', fontSize: '1.2rem', color: 'var(--primary-blue)' }}>연금복권720+ 게임정보</h4>
              <button onClick={() => setShowPensionGuide(false)} style={{ background: 'none', border: 'none', color: '#94A3B8' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>
              <p>• 1게임 1,000원</p>
              <p>• 1조 000000부터 5조 999999까지의 번호 중 선택합니다.</p>
              <p>• 추첨번호와 끝자리부터 연속으로 일치하는 개수에 따라 당첨 여부가 결정됩니다.</p>
              <p>• 1등 당첨금: 월 700만 원 × 20년</p>
              <p>• 세트 구매 시 1등과 2등 동시 당첨 가능</p>
              <p>• 판매처: 전국 연금복권720+ 판매점, 동행복권 홈페이지</p>
              <p>• 추첨시간: 매주 목요일 19:05경</p>
              <p>• 당첨금 지급률: 판매액의 75%</p>
              <p>• 1등 당첨확률: 1/5,000,000</p>
              <p>• 전체 당첨확률: 약 1/10</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NoDataNotice = () => (
  <div style={{ textAlign: 'center', padding: '32px 16px' }}>
    <AlertTriangle size={40} color="var(--accent-gold)" style={{ marginBottom: '16px' }} />
    <p style={{ fontWeight: '800', marginBottom: '8px' }}>Firestore 데이터가 없습니다</p>
    <p className="text-caption">터미널에서 아래 명령을 실행해주세요:</p>
    <code style={{
      display: 'block', marginTop: '12px', padding: '12px',
      backgroundColor: '#F1F5F9', borderRadius: '8px',
      fontSize: '0.85rem', fontWeight: '700', color: '#1E3A8A'
    }}>npm run seed:full</code>
  </div>
);

const topBtnStyle = {
  padding: '6px 12px',
  borderRadius: '12px',
  backgroundColor: '#F1F5F9',
  color: 'var(--primary-blue)',
  border: 'none',
  fontWeight: '800',
  fontSize: '0.85rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
};

const guideBtnStyle = {
  padding: '4px 10px',
  borderRadius: '8px',
  backgroundColor: '#EEF2FF',
  color: 'var(--primary-blue)',
  border: 'none',
  fontWeight: '800',
  fontSize: '0.75rem',
  cursor: 'pointer'
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 3000,
  padding: '20px'
};

const modalContentStyle = {
  backgroundColor: 'white',
  padding: '24px',
  borderRadius: '24px',
  width: '100%',
  maxWidth: '340px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
};

export default Home;
