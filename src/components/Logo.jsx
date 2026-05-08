import React from 'react';

const Logo = ({ size = 48 }) => {
  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginRight: '-4px' // 텍스트와 더 밀착되도록 음수 마진 추가
    }}>
      {/* 중앙 메인 써클: 숫자 24 */}
      <div style={{
        position: 'absolute',
        width: '72%',
        height: '72%',
        backgroundColor: '#2563EB',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
        zIndex: 10,
        border: '2px solid white'
      }}>
        <span style={{
          color: 'white',
          fontSize: size * 0.35,
          fontWeight: '950',
          letterSpacing: '-1px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>24</span>
      </div>

      {/* 날아다니는 로또볼들: orbit 애니메이션 적용 */}
      <OrbitBall color="#FBBF24" size={size * 0.22} duration="4s" delay="0s" radius={size * 0.45} />
      <OrbitBall color="#3B82F6" size={size * 0.18} duration="5s" delay="-1s" radius={size * 0.42} />
      <OrbitBall color="#EF4444" size={size * 0.2} duration="3.5s" delay="-2s" radius={size * 0.48} />
      <OrbitBall color="#10B981" size={size * 0.16} duration="6s" delay="-3s" radius={size * 0.4} />

      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(var(--orbit-radius)) rotate(0deg); }
          to { transform: rotate(360deg) translateX(var(--orbit-radius)) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
};

const OrbitBall = ({ color, size, duration, delay, radius }) => {
  return (
    <div style={{
      position: 'absolute',
      width: size,
      height: size,
      backgroundColor: color,
      borderRadius: '50%',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      zIndex: 5,
      border: '1.5px solid white',
      '--orbit-radius': `${radius}px`,
      animation: `orbit ${duration} linear ${delay} infinite`
    }} />
  );
};

export default Logo;
