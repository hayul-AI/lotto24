import React from 'react';

const PensionNumbers = ({ group, numbers, size = 'medium' }) => {
  if (!group || !Array.isArray(numbers)) {
    return <p style={{ fontSize: '0.85rem', color: '#94A3B8' }}>번호 정보 없음</p>;
  }

  // 조별 고유 색상 정의 (연금복권 공식 테마 기반)
  const getGroupStyles = (g) => {
    const groupNum = parseInt(g);
    switch (groupNum) {
      case 1: return { bg: '#FFEBEE', text: '#D32F2F', border: '#FFCDD2', labelBg: '#D32F2F' }; // 1조: 레드
      case 2: return { bg: '#FFF3E0', text: '#E65100', border: '#FFE0B2', labelBg: '#EF6C00' }; // 2조: 오렌지
      case 3: return { bg: '#F1F8E9', text: '#33691E', border: '#DCEDC8', labelBg: '#558B2F' }; // 3조: 그린
      case 4: return { bg: '#E3F2FD', text: '#0D47A1', border: '#BBDEFB', labelBg: '#1976D2' }; // 4조: 블루
      case 5: return { bg: '#F3E5F5', text: '#4A148C', border: '#E1BEE7', labelBg: '#7B1FA2' }; // 5조: 퍼플
      default: return { bg: '#F5F5F5', text: '#616161', border: '#E0E0E0', labelBg: '#757575' };
    }
  };

  const styles = getGroupStyles(group);
  const isSmall = size === 'small';
  
  const containerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: isSmall ? '2px' : 'clamp(3px, 1.2vw, 6px)',
    padding: isSmall ? '4px 0' : '10px 0',
    width: '100%',
    overflow: 'hidden'
  };

  const groupCardStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: isSmall ? '36px' : 'clamp(44px, 12vw, 54px)',
    height: isSmall ? '44px' : 'clamp(56px, 15vw, 68px)',
    borderRadius: isSmall ? '10px' : '14px',
    backgroundColor: styles.labelBg,
    color: 'white',
    boxShadow: isSmall ? '0 2px 4px rgba(0,0,0,0.1)' : '0 4px 10px rgba(0,0,0,0.1)',
    marginRight: isSmall ? '1px' : '2px',
    flexShrink: 0
  };

  const numberCardStyle = (n) => ({
    width: isSmall ? '28px' : 'clamp(36px, 9.5vw, 44px)',
    height: isSmall ? '44px' : 'clamp(56px, 15vw, 68px)',
    borderRadius: isSmall ? '8px' : '12px',
    backgroundColor: styles.bg,
    color: styles.text,
    border: `1px solid ${styles.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: isSmall ? '1.1rem' : 'clamp(1.2rem, 4.5vw, 1.7rem)',
    fontWeight: '900',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
    textShadow: '0 1px 0 rgba(255,255,255,0.8)',
    flexShrink: 0
  });

  return (
    <div style={containerStyle}>
      {/* 조 표시 섹션 */}
      <div style={groupCardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: isSmall ? '1.2rem' : '1.8rem', fontWeight: '900' }}>{group}</span>
          <span style={{ fontSize: isSmall ? '0.65rem' : '0.85rem', fontWeight: '800', marginLeft: '2px' }}>조</span>
        </div>
      </div>

      <div style={{ width: '1px', height: isSmall ? '30px' : '40px', backgroundColor: '#E2E8F0', margin: isSmall ? '0 2px' : '0 4px' }} />

      {/* 번호 표시 섹션 */}
      <div style={{ display: 'flex', gap: isSmall ? '3px' : '4px' }}>
        {numbers.map((n, i) => (
          <div key={i} style={numberCardStyle(n)}>
            {n}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PensionNumbers;
