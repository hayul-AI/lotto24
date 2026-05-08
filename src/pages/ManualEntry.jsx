import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Hash } from 'lucide-react';

const ManualEntry = () => {
  const navigate = useNavigate();
  const [drawNo, setDrawNo] = useState('');
  const [numbers, setNumbers] = useState(['', '', '', '', '', '']);

  const handleNumberChange = (index, value) => {
    if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 45)) {
      const newNums = [...numbers];
      newNums[index] = value;
      setNumbers(newNums);
      
      // Auto focus next input
      if (value.length >= 2 && index < 5) {
        document.getElementById(`num-${index + 1}`).focus();
      }
    }
  };

  const handleCheck = () => {
    if (!drawNo) {
      alert('회차를 입력해 주세요.');
      return;
    }
    const numValues = numbers.map(n => parseInt(n)).filter(n => !isNaN(n));
    if (numValues.length < 6) {
      alert('6개의 번호를 모두 입력해 주세요.');
      return;
    }
    
    const uniqueNums = new Set(numValues);
    if (uniqueNums.size < 6) {
      alert('중복된 번호가 있습니다.');
      return;
    }

    const sortedNums = numValues.sort((a, b) => a - b);
    navigate(`/check/${drawNo}?nums=${sortedNums.join(',')}&type=lotto645`);
  };

  return (
    <div className="container fade-in" style={{ padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ flex: 1, textAlign: 'center', fontSize: '1.2rem', fontWeight: '900', marginRight: '24px' }}>수동 번호 입력</h2>
      </div>

      <div className="card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Hash size={18} color="var(--primary-indigo)" />
          <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>추첨 회차 선택</span>
        </div>
        <input 
          type="number" 
          className="input-premium"
          value={drawNo}
          onChange={(e) => setDrawNo(e.target.value)}
          placeholder="조회할 회차를 입력하세요 (예: 1122)"
          style={{ marginBottom: '8px' }}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>가장 최근 회차 정보를 기준으로 분석합니다.</p>
      </div>

      <div className="card" style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Check size={18} color="var(--primary-indigo)" />
          <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>나의 로또 번호 입력 (1~45)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {numbers.map((num, i) => (
            <input
              key={i}
              id={`num-${i}`}
              type="number"
              className="input-premium"
              value={num}
              onChange={(e) => handleNumberChange(i, e.target.value)}
              placeholder={`${i + 1}번`}
              style={{ 
                textAlign: 'center',
                fontSize: '1.25rem',
                fontWeight: '900',
                padding: '20px 10px'
              }}
            />
          ))}
        </div>
      </div>

      <button className="btn-main" onClick={handleCheck}>
        당첨 결과 분석하기
      </button>
    </div>
  );
};

export default ManualEntry;
