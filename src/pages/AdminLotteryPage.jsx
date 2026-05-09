import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Save, AlertCircle, CheckCircle2, Database, 
  Info, LogOut, Lock, Mail, RefreshCw, Zap, Settings, ChevronDown, ChevronUp 
} from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

// [중요] 관리자 이메일 설정
const ADMIN_EMAIL = "medicalassistant9111@gmail.com";

const AdminLotteryPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lotto');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showManual, setShowManual] = useState(false); // 수동 보정 영역 접힘 상태
  
  // 인증 관련 상태
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  
  // 상태 정보
  const [syncStatus, setSyncStatus] = useState({ lotto: null, pension: null });

  // 로또 입력 필드
  const [lottoForm, setLottoForm] = useState({
    drawNo: '', drawDate: '',
    num1: '', num2: '', num3: '', num4: '', num5: '', num6: '',
    bonusNo: '', firstPrizeAmount: '', firstWinnerCount: ''
  });

  // 연금복권 입력 필드
  const [pensionForm, setPensionForm] = useState({
    drawNo: '', drawDate: '', group: '',
    numbers: ['', '', '', '', '', ''],
    firstPrizeAmount: '', firstWinnerCount: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email === ADMIN_EMAIL) {
        setUser(currentUser);
        fetchSyncStatus();
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const [lSnap, pSnap] = await Promise.all([
        getDoc(doc(db, 'sync_status', 'lotto')),
        getDoc(doc(db, 'sync_status', 'pension'))
      ]);
      setSyncStatus({
        lotto: lSnap.exists() ? lSnap.data() : null,
        pension: pSnap.exists() ? pSnap.data() : null
      });
    } catch (e) { console.error(e); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (loginForm.email !== ADMIN_EMAIL) {
        throw new Error("허가되지 않은 이메일입니다.");
      }
      await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      setMessage({ type: 'success', text: '로그인 성공' });
    } catch (err) {
      setMessage({ type: 'error', text: `로그인 실패: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  // [자동 갱신] 로또 최신 회차 가져오기
  const autoSyncLotto = async () => {
    if (!window.confirm("동행복권 API를 통해 최신 로또 회차를 자동으로 가져오시겠습니까?")) return;
    
    setLoading(true);
    setMessage({ type: 'info', text: '로또 최신 회차 확인 중...' });
    
    try {
      let lastNo = syncStatus.lotto?.lastSuccessDrawNo || 0;
      const targetNo = (Number(lastNo) || 1100) + 1;
      const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${targetNo}`;
      
      const response = await fetch(url).catch(() => null);
      if (!response) throw new Error("API 접근 실패 (네트워크 또는 CORS)");
      
      const data = await response.json();
      if (data.returnValue !== 'success') {
        throw new Error(`새로운 회차가 아직 발표되지 않았거나 가져올 수 없습니다. (현재: ${lastNo}회)`);
      }

      const numbers = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].map(Number);
      const lottoData = {
        drawNo: Number(data.drwNo),
        drawDate: data.drwNoDate,
        numbers: numbers.sort((a, b) => a - b),
        bonusNo: Number(data.bnusNo),
        firstPrizeAmount: Number(data.firstWinamnt || 0),
        firstWinnerCount: Number(data.firstPrzwnerCo || 0),
        totalPrizeAmount: Number(data.firstAccumamnt || 0),
        verified: true,
        source: "admin_auto_sync",
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'lotto_results', String(lottoData.drawNo)), lottoData, { merge: true });
      await setDoc(doc(db, 'sync_status', 'lotto'), {
        target: "lotto",
        lastStatus: "success",
        lastSuccessDrawNo: lottoData.drawNo,
        lastRunAt: serverTimestamp(),
        source: "admin_auto_sync"
      }, { merge: true });

      setMessage({ type: 'success', text: `로또 ${lottoData.drawNo}회차 자동 갱신 완료!` });
      fetchSyncStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const autoSyncPension = async () => {
    setMessage({ type: 'info', text: '연금복권은 현재 공식 JSON API가 제공되지 않습니다. 하단의 수동 보정을 이용해 주세요.' });
    setShowManual(true);
    setActiveTab('pension');
  };

  // [수동 저장] 로또
  const saveLottoManual = async (e) => {
    e.preventDefault();
    
    // 1. 권한 확인
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
      setMessage({ type: 'error', text: '관리자 권한이 없습니다. 다시 로그인해 주세요.' });
      return;
    }

    if (!window.confirm(`${lottoForm.drawNo}회차 로또 결과를 수동으로 저장하시겠습니까?`)) return;

    setLoading(true);
    const drawNo = Number(lottoForm.drawNo);

    try {
      const numbers = [
        Number(lottoForm.num1), Number(lottoForm.num2), Number(lottoForm.num3),
        Number(lottoForm.num4), Number(lottoForm.num5), Number(lottoForm.num6)
      ].sort((a, b) => a - b);

      const data = {
        drawNo,
        numbers,
        bonusNo: Number(lottoForm.bonusNo),
        drawDate: lottoForm.drawDate,
        firstPrizeAmount: Number(lottoForm.firstPrizeAmount || 0),
        firstWinnerCount: Number(lottoForm.firstWinnerCount || 0),
        verified: true,
        source: "admin_manual",
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'lotto_results', String(drawNo)), data, { merge: true });
      await setDoc(doc(db, 'sync_status', 'lotto'), {
        target: "lotto",
        lastStatus: "manual_success",
        lastSuccessDrawNo: drawNo,
        lastRunAt: serverTimestamp(),
        source: "admin_manual"
      }, { merge: true });

      setMessage({ type: 'success', text: `${drawNo}회차 로또 저장 완료!` });
      fetchSyncStatus();
    } catch (err) {
      console.error("Lotto Save Error Log:", {
        user: auth.currentUser?.email,
        collection: "lotto_results",
        drawNo: drawNo,
        error: err.message
      });
      setMessage({ type: 'error', text: `저장 실패: ${err.message}` });
    } finally { setLoading(false); }
  };

  // [수동 저장] 연금복권
  const savePensionManual = async (e) => {
    e.preventDefault();

    // 1. 권한 확인
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
      setMessage({ type: 'error', text: '관리자 권한이 없습니다. 다시 로그인해 주세요.' });
      return;
    }

    if (!window.confirm(`${pensionForm.drawNo}회차 연금복권 결과를 수동으로 저장하시겠습니까?`)) return;

    setLoading(true);
    const drawNo = Number(pensionForm.drawNo);

    try {
      const numbers = pensionForm.numbers.map(Number);
      const data = {
        drawNo,
        drawDate: pensionForm.drawDate,
        firstPrizeAmount: Number(pensionForm.firstPrizeAmount || 0),
        firstPrizeGroup: pensionForm.group,
        firstPrizeNumber: {
          group: pensionForm.group,
          numbers: numbers
        },
        firstWinnerCount: Number(pensionForm.firstWinnerCount || 0),
        verified: true,
        source: "admin_manual",
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'pension_results', String(drawNo)), data, { merge: true });
      await setDoc(doc(db, 'sync_status', 'pension'), {
        target: "pension",
        lastStatus: "manual_success",
        lastSuccessDrawNo: drawNo,
        lastRunAt: serverTimestamp(),
        source: "admin_manual"
      }, { merge: true });

      setMessage({ type: 'success', text: `${drawNo}회차 연금복권 저장 완료!` });
      fetchSyncStatus();
    } catch (err) {
      console.error("Pension Save Error Log:", {
        user: auth.currentUser?.email,
        collection: "pension_results",
        drawNo: drawNo,
        error: err.message
      });
      setMessage({ type: 'error', text: `저장 실패: ${err.message}` });
    } finally { setLoading(false); }
  };

  if (authLoading) {
    return <div className="container flex-center" style={{ minHeight: '80vh' }}><RefreshCw className="animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div className="container page-transition" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="card" style={{ maxWidth: '360px', width: '100%', padding: '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', backgroundColor: '#F1F5F9', borderRadius: '16px', marginBottom: '16px' }}>
              <Lock size={32} color="var(--primary-blue)" />
            </div>
            <h2 className="title-md">관리자 인증</h2>
          </div>
          <form onSubmit={handleLogin}>
            <input 
              type="email" className="input-field mb-12" placeholder="이메일" required
              value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})}
            />
            <input 
              type="password" className="input-field mb-20" placeholder="비밀번호" required
              value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})}
            />
            <button type="submit" disabled={loading} className="btn-cta w-full">로그인</button>
          </form>
          {message.text && <p style={{ marginTop: '16px', textAlign: 'center', color: '#EF4444', fontSize: '0.85rem' }}>{message.text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="container page-transition" style={{ paddingBottom: '120px' }}>
      <header className="flex-between mb-24">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><ChevronLeft size={24} /></button>
          <h1 className="title-md">데이터 관리 센터</h1>
        </div>
        <button onClick={handleLogout} style={{ border: 'none', background: '#F1F5F9', color: '#64748B', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800' }}>
          로그아웃
        </button>
      </header>

      <div className="grid-2 mb-24">
        <StatusCard title="로또 6/45" no={syncStatus.lotto?.lastSuccessDrawNo} color="var(--primary-blue)" />
        <StatusCard title="연금 720+" no={syncStatus.pension?.lastSuccessDrawNo} color="#E11D48" />
      </div>

      <section className="mb-24">
        <h3 className="title-sm mb-12" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={18} color="#F59E0B" fill="#F59E0B" /> 원터치 자동 갱신</h3>
        <div className="card" style={{ padding: '20px', border: '2px solid #FEF3C7', backgroundColor: '#FFFBEB' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={autoSyncLotto} 
              disabled={loading} 
              className="btn-cta" 
              style={{ width: '100%', backgroundColor: 'var(--primary-blue)', display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px' }}
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : <Database size={20} />}
              로또 지금 갱신 (자동 수집)
            </button>
            <button 
              onClick={autoSyncPension} 
              disabled={loading} 
              className="btn-cta" 
              style={{ width: '100%', backgroundColor: '#E11D48', display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px' }}
            >
              <RefreshCw size={20} />
              연금복권 지금 갱신 (상태 체크)
            </button>
          </div>
        </div>
      </section>

      <section>
        <button 
          onClick={() => setShowManual(!showManual)}
          style={{ 
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '16px', backgroundColor: '#F1F5F9', borderRadius: '16px', border: 'none',
            cursor: 'pointer', marginBottom: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#475569' }}>
            <Settings size={18} /> 고급 수동 데이터 보정
          </div>
          {showManual ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>

        {showManual && (
          <div className="page-transition">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <TabBtn active={activeTab === 'lotto'} color="var(--primary-blue)" onClick={() => setActiveTab('lotto')}>로또 수동</TabBtn>
              <TabBtn active={activeTab === 'pension'} color="#E11D48" onClick={() => setActiveTab('pension')}>연금 수동</TabBtn>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              {activeTab === 'lotto' ? (
                <form onSubmit={saveLottoManual}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ flex: '1 1 120px' }}>
                      <Input label="회차" value={lottoForm.drawNo} onChange={v => setLottoForm({...lottoForm, drawNo: v})} />
                    </div>
                    <div style={{ flex: '1 1 180px' }}>
                      <Input label="추첨일" type="date" value={lottoForm.drawDate} onChange={v => setLottoForm({...lottoForm, drawDate: v})} />
                    </div>
                  </div>
                  
                  <div className="mb-16">
                    <label className="text-caption mb-8 block font-bold" style={{ fontSize: '0.9rem', color: '#1E293B' }}>당첨번호 (1~45)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#94A3B8', fontWeight: '900' }}>#{i}</span>
                          <input type="number" className="input-field" style={{ padding: '12px 12px 12px 30px', textAlign: 'center', fontSize: '1.1rem', fontWeight: '900' }} required
                                 value={lottoForm[`num${i}`]} onChange={e => setLottoForm({...lottoForm, [`num${i}`]: e.target.value})} />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
                      <div style={{ flex: '1 1 80px' }}>
                        <Input label="보너스" value={lottoForm.bonusNo} onChange={v => setLottoForm({...lottoForm, bonusNo: v})} />
                      </div>
                      <div style={{ flex: '2 1 150px' }}>
                        <Input label="1등 총 당첨금 (원)" value={lottoForm.firstPrizeAmount} onChange={v => setLottoForm({...lottoForm, firstPrizeAmount: v})} />
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <Input label="당첨자 수" value={lottoForm.firstWinnerCount} onChange={v => setLottoForm({...lottoForm, firstWinnerCount: v})} />
                      </div>
                    </div>
                  <button type="submit" disabled={loading} className="btn-cta w-full">수동 저장</button>
                </form>
              ) : (
                <form onSubmit={savePensionManual}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ flex: '1 1 120px' }}>
                      <Input label="회차" value={pensionForm.drawNo} onChange={v => setPensionForm({...pensionForm, drawNo: v})} />
                    </div>
                    <div style={{ flex: '1 1 180px' }}>
                      <Input label="추첨일" type="date" value={pensionForm.drawDate} onChange={v => setPensionForm({...pensionForm, drawDate: v})} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ flex: '1 1 70px' }}>
                      <Input label="조" value={pensionForm.group} onChange={v => setPensionForm({...pensionForm, group: v})} />
                    </div>
                    <div style={{ flex: '4 1 200px', minWidth: 0 }}>
                      <label className="text-caption mb-8 block font-bold" style={{ fontSize: '0.9rem', color: '#1E293B' }}>6자리 번호</label>
                      <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                        {pensionForm.numbers.map((n, i) => (
                          <input key={i} type="number" className="input-field" 
                                 style={{ padding: '12px 0', textAlign: 'center', fontSize: '1rem', fontWeight: '900', flex: 1, minWidth: 0 }} 
                                 required
                                 value={n} onChange={e => {
                                   const newNums = [...pensionForm.numbers];
                                   newNums[i] = e.target.value.slice(-1);
                                   setPensionForm({...pensionForm, numbers: newNums});
                                 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <Input label="1등 금액 (월)" value={pensionForm.firstPrizeAmount} onChange={v => setPensionForm({...pensionForm, firstPrizeAmount: v})} />
                    </div>
                    <div style={{ flex: '1 1 100px' }}>
                      <Input label="당첨자 수" value={pensionForm.firstWinnerCount} onChange={v => setPensionForm({...pensionForm, firstWinnerCount: v})} />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-cta w-full" style={{ backgroundColor: '#E11D48' }}>수동 저장</button>
                </form>
              )}
            </div>
          </div>
        )}
      </section>

      {message.text && (
        <div className="card mt-20" style={{ 
          display: 'flex', alignItems: 'center', gap: '12px', 
          backgroundColor: message.type === 'error' ? '#FEF2F2' : message.type === 'info' ? '#EFF6FF' : '#F0FDF4',
          border: `1px solid ${message.type === 'error' ? '#FEE2E2' : message.type === 'info' ? '#DBEAFE' : '#DCFCE7'}`
        }}>
          {message.type === 'error' ? <AlertCircle color="#EF4444" /> : message.type === 'info' ? <Info color="#3B82F6" /> : <CheckCircle2 color="#10B981" />}
          <p style={{ fontSize: '0.85rem', fontWeight: '700', color: message.type === 'error' ? '#991B1B' : message.type === 'info' ? '#1E40AF' : '#166534' }}>{message.text}</p>
        </div>
      )}
    </div>
  );
};

const StatusCard = ({ title, no, color }) => (
  <div className="card" style={{ padding: '16px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
    <p className="text-caption mb-4">{title} 최신</p>
    <p style={{ fontWeight: '900', color, fontSize: '1.2rem' }}>{no || '-'}회</p>
  </div>
);

const TabBtn = ({ active, color, onClick, children }) => (
  <button onClick={onClick} style={{ 
    flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
    backgroundColor: active ? color : '#F1F5F9', color: active ? 'white' : '#64748B',
    fontWeight: '800', fontSize: '0.8rem', transition: '0.2s'
  }}>{children}</button>
);

const Input = ({ label, type = "number", value, onChange }) => (
  <div style={{ width: '100%' }}>
    <label className="text-caption mb-8 block font-bold" style={{ fontSize: '0.9rem', color: '#1E293B' }}>{label}</label>
    <input 
      type={type} 
      className="input-field" 
      style={{ padding: '14px', fontSize: '1rem', fontWeight: '800' }} 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      required 
    />
  </div>
);

export default AdminLotteryPage;
