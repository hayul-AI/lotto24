import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#F8FAFC', minHeight: '100vh' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ fontWeight: '900', color: '#1E293B', marginBottom: '12px' }}>화면을 불러오는 중 오류가 발생했습니다</h2>
          <p style={{ color: '#64748B', marginBottom: '24px', fontSize: '0.9rem' }}>일시적인 오류일 수 있으니 앱을 다시 실행해 주세요.</p>
          <button 
            onClick={() => window.location.href = '/'}
            style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: '800' }}
          >
            홈으로 이동
          </button>
          <div style={{ marginTop: '40px', textAlign: 'left', fontSize: '0.7rem', color: '#CBD5E1', borderTop: '1px solid #E2E8F0', paddingTop: '20px', overflowX: 'auto' }}>
            <p>Error: {this.state.error?.message}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
