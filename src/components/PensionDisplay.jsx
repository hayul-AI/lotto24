import React from 'react';

/**
 * 연금복권 번호 표시 컴포넌트
 * @param {Object} props.data - { group: string, numbers: number[] }
 */
const PensionDisplay = ({ data }) => {
  if (!data || !data.group || !Array.isArray(data.numbers)) {
    return (
      <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B95A1' }}>
        번호 정보 없음
      </div>
    );
  }

  // 연한 녹색 테마
  const bgColor = '#E8F5E9'; // Light Green
  const textColor = '#2E7D32'; // Dark Green

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '48px', height: '52px', borderRadius: '12px',
        backgroundColor: '#1B5E20', color: 'white',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontWeight: '900', fontSize: '1.2rem'
      }}>
        {data.group}
        <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>조</span>
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

export default PensionDisplay;
