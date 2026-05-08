import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, AlertTriangle } from 'lucide-react';
import { getAllLottoResults, getAllPensionResults } from '../services/lottoService';
import LottoBall from '../components/LottoBall';
import { formatDate, formatCurrencyKRW, formatDrawNo } from '../utils/formatters';

const DrawResults = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('LOTTO');
  const [allData, setAllData] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async (t) => {
    setLoading(true);
    setError(null);
    setCurrentIdx(0);
    setSearchInput('');
    const { data, error: err } = t === 'LOTTO' ? await getAllLottoResults() : await getAllPensionResults();
    if (err) setError(err);
    setAllData(data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(tab); }, [tab]);

  const current = allData[currentIdx] || null;
  const goPrev = () => { if (currentIdx < allData.length - 1) setCurrentIdx(currentIdx + 1); };
  const goNext = () => { if (currentIdx > 0) setCurrentIdx(currentIdx - 1); };

  const handleSearch = () => {
    const no = parseInt(searchInput);
    if (isNaN(no)) return;
    const idx = allData.findIndex(d => d.drawNo === no);
    if (idx >= 0) setCurrentIdx(idx);
    else alert(`${no}회차 데이터가 없습니다.`);
  };

  return (
    <div className="container page-transition" style={{ paddingBottom: '140px' }}>
      <header className="flex-between mb-24">
        <button onClick={() => navigate(-1)} style={circleBtn}><ChevronLeft size={24} /></button>
        <h1 className="title-md">회차별 당첨 결과</h1>
        <div style={{ width: 48 }} />
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '6px', borderRadius: '16px', marginBottom: '24px' }}>
        <TabBtn label="로또 6/45" active={tab === 'LOTTO'} onClick={() => setTab('LOTTO')} />
        <TabBtn label="연금복권 720+" active={tab === 'PENSION'} onClick={() => setTab('PENSION')} />
      </div>

      {/* Search */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', marginBottom: '24px' }}>
        <Search size={18} color="var(--text-muted)" />
        <input
          type="number"
          placeholder="회차 번호 입력"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1, border: 'none', outline: 'none', fontWeight: '700', fontSize: '1rem' }}
        />
        <button onClick={handleSearch} className="btn-sub" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>검색</button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="skeleton" style={{ height: '240px', borderRadius: '24px' }} />
      ) : error === 'NO_DATA' || allData.length === 0 ? (
        <NoDataCard />
      ) : current ? (
        <div>
          {/* Navigation */}
          <div className="flex-between mb-16" style={{ padding: '0 4px' }}>
            <button onClick={goPrev} disabled={currentIdx >= allData.length - 1} style={navBtn(currentIdx >= allData.length - 1)}>
              <ChevronLeft size={16} /> 이전회차
            </button>
            <span style={{ fontWeight: '900', fontSize: '1.1rem' }}>{formatDrawNo(current.drawNo)}</span>
            <button onClick={goNext} disabled={currentIdx <= 0} style={navBtn(currentIdx <= 0)}>
              다음회차 <ChevronRight size={16} />
            </button>
          </div>

          {/* Detail Card */}
          <div className="card" style={{ padding: '28px' }}>
            <p className="text-caption mb-16" style={{ fontWeight: '700' }}>{formatDate(current.drawDate)}</p>

            {tab === 'LOTTO' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                  {current.numbers?.map((n, i) => <LottoBall key={i} number={n} size="40px" />)}
                  <span style={{ color: '#E5E8EB', fontWeight: '900', fontSize: '1.2rem', alignSelf: 'center' }}>+</span>
                  <LottoBall number={current.bonusNo} size="40px" />
                </div>
                <div style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', padding: '16px' }}>
                  <div className="flex-between mb-8">
                    <span className="text-caption" style={{ fontWeight: '700' }}>1등 당첨금</span>
                    <span style={{ fontWeight: '900', color: '#E74C3C' }}>{formatCurrencyKRW(current.firstPrizeAmount)}</span>
                  </div>
                  <div className="flex-between">
                    <span className="text-caption" style={{ fontWeight: '700' }}>당첨자 수</span>
                    <span style={{ fontWeight: '800' }}>{current.firstWinnerCount ?? '-'}명</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <PensionDetail data={current.firstPrizeNumber} />
                <div style={{ backgroundColor: '#FFF1F2', borderRadius: '14px', padding: '16px', marginTop: '20px' }}>
                  <div className="flex-between">
                    <span className="text-caption" style={{ fontWeight: '700', color: '#E11D48' }}>1등 당첨금</span>
                    <span style={{ fontWeight: '900', color: '#E11D48' }}>월 700만원 × 20년</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dropdown list */}
          <h3 className="title-md mb-16" style={{ marginTop: '32px', paddingLeft: '4px' }}>전체 회차 목록</h3>
          {allData.map((item, idx) => (
            <div
              key={item.id}
              className="card card-clickable"
              onClick={() => setCurrentIdx(idx)}
              style={{
                padding: '16px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: idx === currentIdx ? '2px solid var(--primary-blue)' : undefined
              }}
            >
              <span style={{ fontWeight: '800' }}>{formatDrawNo(item.drawNo)}</span>
              <span className="text-caption">{formatDate(item.drawDate)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const PensionDetail = ({ data }) => {
  if (!data?.group || !Array.isArray(data?.numbers)) return <p className="text-caption">번호 정보 없음</p>;
  
  // 연한 녹색 테마
  const bgColor = '#E8F5E9'; // Light Green
  const textColor = '#2E7D32'; // Dark Green

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <div style={{ width: '48px', height: '52px', borderRadius: '12px', backgroundColor: '#1B5E20', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.2rem' }}>
        {data.group}<span style={{ fontSize: '0.6rem', opacity: 0.7 }}>조</span>
      </div>
      <div style={{ width: '2px', height: '30px', backgroundColor: '#E2E8F0' }} />
      {data.numbers.map((n, i) => (
        <div key={i} style={{ 
          width: '38px', height: '52px', borderRadius: '10px', 
          backgroundColor: bgColor, color: textColor, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          fontWeight: '900', fontSize: '1.2rem', 
          boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.05)',
          border: '1px solid #C8E6C9'
        }}>
          {n}
        </div>
      ))}
    </div>
  );
};

const NoDataCard = () => (
  <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
    <AlertTriangle size={40} color="#F5B700" style={{ marginBottom: '16px' }} />
    <p style={{ fontWeight: '800', marginBottom: '8px' }}>Firestore 데이터가 없습니다</p>
    <code style={{ display: 'block', marginTop: '12px', padding: '12px', backgroundColor: '#F1F5F9', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#1E3A8A' }}>npm run seed:full</code>
  </div>
);

const TabBtn = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer',
    backgroundColor: active ? 'white' : 'transparent', color: active ? 'var(--primary-blue)' : 'var(--text-muted)',
    fontWeight: '800', fontSize: '0.85rem', boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
  }}>{label}</button>
);

const circleBtn = { width: 48, height: 48, borderRadius: '50%', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-card)' };
const navBtn = (disabled) => ({ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', fontWeight: '700', fontSize: '0.85rem', color: disabled ? '#D1D5DB' : 'var(--primary-blue)', cursor: disabled ? 'default' : 'pointer' });

export default DrawResults;
