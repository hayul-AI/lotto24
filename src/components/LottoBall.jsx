import React from 'react';

const LottoBall = ({ number, size = '48px' }) => {
  const getBallColor = (n) => {
    if (n >= 1 && n <= 10) return 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'; // Yellow
    if (n >= 11 && n <= 20) return 'linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)'; // Blue
    if (n >= 21 && n <= 30) return 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)'; // Red
    if (n >= 31 && n <= 40) return 'linear-gradient(135deg, #9ca3af 0%, #4b5563 100%)'; // Gray
    return 'linear-gradient(135deg, #4ade80 0%, #15803d 100%)'; // Green
  };

  return (
    <div 
      className="lotto-ball" 
      style={{ 
        background: getBallColor(number),
        width: size,
        height: size,
        fontSize: `calc(${size} * 0.44)`,
        fontWeight: '900',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        boxShadow: '0 4px 10px rgba(0,0,0,0.2), inset -2px -2px 4px rgba(0,0,0,0.3), inset 2px 2px 4px rgba(255,255,255,0.4)',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        flexShrink: 0
      }}
    >
      {number}
    </div>
  );
};


export default LottoBall;
