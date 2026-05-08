import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, RotateCcw, Sparkles, Save, Info, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import LottoBall from '../components/LottoBall';

const STORAGE_KEY = 'bokgwon24_manual_numbers';

const ManualNumbers = () => {
  const navigate = useNavigate();
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [latestDrawNo, setLatestDrawNo] = useState('1100'); // 기본값
  const [savedNumbers, setSavedNumbers] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  // 1. 초기 데이터 로드 및 최신 회차 조회
  useEffect(() => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      setSavedNumbers(JSON.parse(data));
    }

    // Firestore에서 가장 최신 회차 번호 가져오기
    const fetchLatestDraw = async () => {
      try {
        const q = query(collection(db, 'lotto_results'), orderBy('drawNo', 'desc'), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const latest = snap.docs[0].data().drawNo;
          setLatestDrawNo(latest.toString());
        }
      } catch (err) {
        console.error("Latest draw fetch failed:", err);
      }
    };
    fetchLatestDraw();
  }, []);

  // 2. 번호 선택 로직
  const toggleNumber = (num) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num).sort((a, b) => a - b));
    } else {
      if (selectedNumbers.length >= 6) {
        setStatusMessage('최대 6개까지만 선택할 수 있습니다.');
        return;
      }
      setSelectedNumbers(prev => [...prev, num].sort((a, b) => a - b));
      setStatusMessage('');
    }
  };

  const generateRandom = () => {
    const nums = [];
    while (nums.length < 6) {
      const r = Math.floor(Math.random() * 45) + 1;
      if (!nums.includes(r)) nums.push(r);
    }
    setSelectedNumbers(nums.sort((a, b) => a - b));
    setStatusMessage('행운의 번호가 생성되었습니다!');
  };

  const resetSelection = () => {
    setSelectedNumbers([]);
    setStatusMessage('선택이 초기화되었습니다.');
  };

  // 3. 저장 로직 (회차 번호와 메모 제외)
  const saveNumbers = () => {
    if (selectedNumbers.length !== 6) {
      setStatusMessage('6개의 번호를 모두 선택해야 저장할 수 있습니다.');
      return;
    }

    if (savedNumbers.length >= 10) {
      setStatusMessage('보관함이 가득 찼습니다 (최대 10개). 기존 번호를 삭제 후 저장해주세요.');
      return;
    }

    const newItem = {
      id: Date.now(),
      drawNo: latestDrawNo, // 자동으로 최신 회차 할당
      numbers: selectedNumbers,
      createdAt: new Date().toISOString(),
      checked: false,
      result: null
    };

    const updated = [newItem, ...savedNumbers];
    setSavedNumbers(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    resetSelection();
    setStatusMessage('수동번호가 저장되었습니다!');
  };

  // 4. 삭제 로직
  const deleteItem = (id) => {
    const updated = savedNumbers.filter(item => item.id !== id);
    setSavedNumbers(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setStatusMessage('번호가 삭제되었습니다.');
  };

  // 5. 당첨 확인 로직
  const checkWinning = async (item) => {
    try {
      setStatusMessage(`${item.drawNo}회 당첨번호를 확인 중...`);
      const docRef = doc(db, 'lotto_results', item.drawNo.toString());
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        setStatusMessage('아직 해당 회차의 당첨 데이터가 없습니다.');
        return;
      }

      const winData = snap.data();
      const winNums = winData.numbers;
      const bonus = winData.bonus;

      const matched = item.numbers.filter(n => winNums.includes(n)).length;
      const bonusMatched = item.numbers.includes(bonus);

      let rank = '낙첨';
      if (matched === 6) rank = '1등';
      else if (matched === 5 && bonusMatched) rank = '2등';
      else if (matched === 5) rank = '3등';
      else if (matched === 4) rank = '4등';
      else if (matched === 3) rank = '5등';

      const updated = savedNumbers.map(s => {
        if (s.id === item.id) {
          return { ...s, checked: true, result: rank, matchedCount: matched };
        }
        return s;
      });

      setSavedNumbers(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setStatusMessage(`${rank} 결과가 확인되었습니다!`);
    } catch (err) {
      console.error(err);
      setStatusMessage('당첨 확인 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="page-transition" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', paddingBottom: '120px' }}>
      <header style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', borderBottom: '1px solid #F1F5F9', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none' }}><ChevronLeft size={24} /></button>
        <h1 className="title-md">수동번호 보관함</h1>
      </header>

      <div className="container">
        {/* 안내 카드 */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: '#EEF2FF' }}>
          <Info size={24} color="var(--primary-blue)" />
          <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
            최대 10개까지 번호를 저장할 수 있습니다.<br/>저장된 번호의 당첨 여부를 간편하게 확인하세요.
          </p>
        </div>

        {/* 번호 선택 패널 */}
        <div className="card" style={{ padding: '24px', borderRadius: '28px' }}>
          <div className="flex-between mb-24">
             <h3 style={{ fontWeight: '800', fontSize: '1.1rem' }}>번호 선택</h3>
             <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={generateRandom} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: '800' }}>
                  <Sparkles size={16} /> 자동
                </button>
                <button onClick={resetSelection} style={{ background: 'none', border: 'none', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: '800' }}>
                  <RotateCcw size={16} /> 초기화
                </button>
             </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px', minHeight: '44px', flexWrap: 'nowrap' }}>
            {selectedNumbers.map(num => (
              <LottoBall key={num} number={num} size="44px" />
            ))}
            {[...Array(6 - selectedNumbers.length)].map((_, i) => (
              <div key={i} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', fontSize: '0.8rem', flexShrink: 0 }}>?</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '24px' }}>
            {[...Array(45)].map((_, i) => {
              const num = i + 1;
              const isSelected = selectedNumbers.includes(num);
              return (
                <button
                  key={num}
                  onClick={() => toggleNumber(num)}
                  style={{
                    height: '44px', borderRadius: '12px', border: 'none',
                    backgroundColor: isSelected ? 'var(--primary-blue)' : '#F1F5F9',
                    color: isSelected ? 'white' : '#64748B',
                    fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer'
                  }}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <button className="btn-cta" onClick={saveNumbers} style={{ height: '56px', backgroundColor: savedNumbers.length >= 10 ? '#E2E8F0' : 'var(--primary-blue)', cursor: savedNumbers.length >= 10 ? 'not-allowed' : 'pointer' }}>
            <Save size={20} /> 수동번호 저장하기
          </button>
          
          {statusMessage && (
            <p style={{ marginTop: '12px', textAlign: 'center', fontSize: '0.85rem', color: (statusMessage.includes('저장') || statusMessage.includes('결과')) ? 'var(--status-success)' : '#EF4444', fontWeight: '700' }}>
              {statusMessage}
            </p>
          )}
        </div>

        {/* 저장된 목록 */}
        <div style={{ marginTop: '32px' }}>
          <div className="flex-between mb-20">
            <h3 style={{ fontWeight: '900', fontSize: '1.2rem' }}>저장된 목록</h3>
            <span style={{ fontSize: '0.9rem', fontWeight: '800', color: savedNumbers.length >= 10 ? '#EF4444' : 'var(--primary-blue)', backgroundColor: 'white', padding: '4px 12px', borderRadius: '20px', border: '1px solid #F1F5F9' }}>
              {savedNumbers.length} / 10
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {savedNumbers.map(item => (
              <div key={item.id} className="card" style={{ padding: '24px' }}>
                <div className="flex-between mb-16">
                  <span style={{ backgroundColor: '#F1F5F9', color: '#64748B', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800' }}>
                    제 {item.drawNo}회 대상
                  </span>
                  <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#CBD5E1' }}>
                    <Trash2 size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'nowrap' }}>
                  {item.numbers.map(num => (
                    <LottoBall key={num} number={num} size="36px" />
                  ))}
                </div>

                <div className="flex-between" style={{ paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{new Date(item.createdAt).toLocaleDateString()} 저장</span>
                  
                  {item.checked ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: '900', color: item.result === '낙첨' ? '#94A3B8' : '#F59E0B' }}>
                        {item.result} {item.matchedCount > 0 && `(${item.matchedCount}개 일치)`}
                      </span>
                      <CheckCircle2 size={18} color={item.result === '낙첨' ? '#94A3B8' : '#F59E0B'} />
                    </div>
                  ) : (
                    <button onClick={() => checkWinning(item)} style={{ backgroundColor: '#F1F5F9', border: 'none', padding: '8px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Search size={16} /> 당첨 확인
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const getBallColor = (num) => {
  if (num <= 10) return '#facc15';
  if (num <= 20) return '#3b82f6';
  if (num <= 30) return '#ef4444';
  if (num <= 40) return '#94a3b8';
  return '#22c55e';
};

export default ManualNumbers;
