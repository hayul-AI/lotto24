import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, AlertCircle, CheckCircle2, Database, Info, LogOut, Lock, Mail, RefreshCw } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

// [중요] 관리자 이메일 설정
const ADMIN_EMAIL = "medicalassistant9111@gmail.com";

const AdminLotteryPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lotto');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // 인증 관련 상태
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  
  // 상태 정보
  const [syncStatus, setSyncStatus] = useState({ lotto: null, pension: null });

  // 로또 입력 필드
  const [lottoForm, setLottoForm] = useState({
    drawNo: '', drawDate: '',
    num1: '', num2: '', num3: '', num4: '', num5: '', num6: '',
    bonusNo: '', firstPrizeAmount: ''
  });

  // 연금복권 입력 필드
  const [pensionForm, setPensionForm] = useState({
    drawNo: '', drawDate: '', group: '',
    numbers: ['', '', '', '', '', ''],
    firstPrizeAmount: '7000000', firstWinnerCount: '2'
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

  const saveLotto = async (e) => {
    e.preventDefault();
    if (!window.confirm(`${lottoForm.drawNo}회차 로또 결과를 저장하시겠습니까?`)) return;

    setLoading(true);
    try {
      const drawNo = Number(lottoForm.drawNo);
      const numbers = [
        Number(lottoForm.num1), Number(lottoForm.num2), Number(lottoForm.num3),
        Number(lottoForm.num4), Number(lottoForm.num5), Number(lottoForm.num6)
      ].sort((a, b) => a - b);

      const data = {
        drawNo, drawDate: lottoForm.drawDate, numbers,
        bonusNo: Number(lottoForm.bonusNo),
        firstPrizeAmount: Number(lottoForm.firstPrizeAmount || 0),
        verified: true, source: "admin_manual", updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'lotto_results', String(drawNo)), data, { merge: true });
      await setDoc(doc(db, 'sync_status', 'lotto'), {
        target: "lotto", lastStatus: "manual_success", lastSuccessDrawNo: drawNo,
        lastRunAt: serverTimestamp(), source: "admin_manual"
      }, { merge: true });

      setMessage({ type: 'success', text: `${drawNo}회차 로또 저장 완료!` });
      fetchSyncStatus();
    } catch (err) {
      setMessage({ type: 'error', text: `저장 실패: ${err.message}` });
    } finally { setLoading(false); }
  };

  const savePension = async (e) => {
    e.preventDefault();
    if (!window.confirm(`${pensionForm.drawNo}회차 연금복권 결과를 저장하시겠습니까?`)) return;

    setLoading(true);
    try {
      const drawNo = Number(pensionForm.drawNo);
      const numbers = pensionForm.numbers.map(Number);
      const data = {
        drawNo, drawDate: pensionForm.drawDate,
        firstPrizeAmount: Number(pensionForm.firstPrizeAmount),
        firstPrizeGroup: pensionForm.group,
        firstPrizeNumber: { group: pensionForm.group, numbers: numbers },
        firstWinnerCount: Number(pensionForm.firstWinnerCount),
        verified: true, source: "admin_manual", updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'pension_results', String(drawNo)), data, { merge: true });
      await setDoc(doc(db, 'sync_status', 'pension'), {
        target: "pension", lastStatus: "manual_success", lastSuccessDrawNo: drawNo,
        lastRunAt: serverTimestamp(), source: "admin_manual"
      }, { merge: true });

      setMessage({ type: 'success', text: `${drawNo}회차 연금복권 저장 완료!` });
      fetchSyncStatus();
    } catch (err) {
      setMessage({ type: 'error', text: `저장 실패: ${err.message}` });
    } finally { setLoading(false); }
  };

  if (authLoading) {
    return <div className="container flex-center" style={{ minHeight: '80vh' }}><RefreshCw className="animate-spin" /></div>;
  }

  // 로그인 화면
  if (!user) {
    return (
      <div className="container page-transition" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="card" style={{ maxWidth: '360px', width: '100%', padding: '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', backgroundColor: '#F1F5F9', borderRadius: '16px', marginBottom: '16px' }}>
              <Lock size={32} color="var(--primary-blue)" />
            </div>
            <h2 className="title-md">관리자 시스템</h2>
            <p className="text-caption">인증된 관리자 계정으로 로그인하세요.</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="mb-16">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Mail size={14} color="#64748B" /><span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>이메일</span>
              </div>
              <input 
                type="email" className="input-field" placeholder="admin@example.com" required
                value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})}
              />
            </div>
            <div className="mb-24">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Lock size={14} color="#64748B" /><span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B' }}>비밀번호</span>
              </div>
              <input 
                type="password" className="input-field" placeholder="••••••••" required
                value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-cta w-full">
              {loading ? <RefreshCw className="animate-spin" size={20} /> : '로그인'}
            </button>
          </form>
          {message.text && (
            <div style={{ marginTop: '16px', color: message.type === 'error' ? '#EF4444' : '#10B981', fontSize: '0.8rem', textAlign: 'center', fontWeight: '700' }}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 관리자 대시보드
  return (
    <div className="container page-transition" style={{ paddingBottom: '120px' }}>
      <header className="flex-between mb-24">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><ChevronLeft size={24} /></button>
          <h1 className="title-md">결과 수동 보정</h1>
        </div>
        <button onClick={handleLogout} style={{ border: 'none', background: '#F1F5F9', color: '#64748B', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '800' }}>
          <LogOut size={14} /> 로그아웃
        </button>
      </header>

      {/* 상태 정보 요약 */}
      <div className="card mb-24" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <p className="text-caption mb-4">로또 최신</p>
            <p style={{ fontWeight: '900', color: 'var(--primary-blue)' }}>{syncStatus.lotto?.lastSuccessDrawNo || '-'}회</p>
          </div>
          <div style={{ width: '1px', backgroundColor: '#E2E8F0' }} />
          <div>
            <p className="text-caption mb-4">연금 최신</p>
            <p style={{ fontWeight: '900', color: '#E11D48' }}>{syncStatus.pension?.lastSuccessDrawNo || '-'}회</p>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('lotto')}
          style={{ 
            flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
            backgroundColor: activeTab === 'lotto' ? 'var(--primary-blue)' : '#F1F5F9',
            color: activeTab === 'lotto' ? 'white' : '#64748B',
            fontWeight: '800', transition: '0.2s'
          }}
        >
          로또 6/45
        </button>
        <button 
          onClick={() => setActiveTab('pension')}
          style={{ 
            flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
            backgroundColor: activeTab === 'pension' ? '#E11D48' : '#F1F5F9',
            color: activeTab === 'pension' ? 'white' : '#64748B',
            fontWeight: '800', transition: '0.2s'
          }}
        >
          연금 720+
        </button>
      </div>

      {/* 입력 폼 */}
      <div className="card">
        {activeTab === 'lotto' ? (
          <form onSubmit={saveLotto}>
            <div className="grid-2 mb-16">
              <div>
                <label className="text-caption mb-4 block font-bold">회차 번호</label>
                <input 
                  type="number" className="input-field" placeholder="예: 1118" required
                  value={lottoForm.drawNo} onChange={e => setLottoForm({...lottoForm, drawNo: e.target.value})}
                />
              </div>
              <div>
                <label className="text-caption mb-4 block font-bold">추첨일</label>
                <input 
                  type="date" className="input-field" required
                  value={lottoForm.drawDate} onChange={e => setLottoForm({...lottoForm, drawDate: e.target.value})}
                />
              </div>
            </div>

            <label className="text-caption mb-8 block font-bold">당첨 번호 (6개)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '16px' }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <input 
                  key={i} type="number" className="input-field" style={{ padding: '8px', textAlign: 'center' }} required
                  value={lottoForm[`num${i}`]} onChange={e => setLottoForm({...lottoForm, [`num${i}`]: e.target.value})}
                />
              ))}
            </div>

            <div className="grid-2 mb-20">
              <div>
                <label className="text-caption mb-4 block font-bold">보너스 번호</label>
                <input 
                  type="number" className="input-field" placeholder="보너스" required
                  value={lottoForm.bonusNo} onChange={e => setLottoForm({...lottoForm, bonusNo: e.target.value})}
                />
              </div>
              <div>
                <label className="text-caption mb-4 block font-bold">1등 당첨금 (원)</label>
                <input 
                  type="number" className="input-field" placeholder="숫자만 입력"
                  value={lottoForm.firstPrizeAmount} onChange={e => setLottoForm({...lottoForm, firstPrizeAmount: e.target.value})}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-cta w-full" style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
              로또 결과 저장하기
            </button>
          </form>
        ) : (
          <form onSubmit={savePension}>
             <div className="grid-2 mb-16">
              <div>
                <label className="text-caption mb-4 block font-bold">회차 번호</label>
                <input 
                  type="number" className="input-field" placeholder="예: 210" required
                  value={pensionForm.drawNo} onChange={e => setPensionForm({...pensionForm, drawNo: e.target.value})}
                />
              </div>
              <div>
                <label className="text-caption mb-4 block font-bold">추첨일</label>
                <input 
                  type="date" className="input-field" required
                  value={pensionForm.drawDate} onChange={e => setPensionForm({...pensionForm, drawDate: e.target.value})}
                />
              </div>
            </div>

            <div className="grid-2 mb-16">
              <div>
                <label className="text-caption mb-4 block font-bold">1등 당첨 조</label>
                <select 
                  className="input-field" required
                  value={pensionForm.group} onChange={e => setPensionForm({...pensionForm, group: e.target.value})}
                >
                  <option value="">선택</option>
                  {[1, 2, 3, 4, 5].map(g => <option key={g} value={String(g)}>{g}조</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="text-caption mb-4 block font-bold">당첨 번호 (6자리)</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {pensionForm.numbers.map((num, i) => (
                    <input 
                      key={i} type="number" maxLength="1" className="input-field" style={{ padding: '8px', textAlign: 'center' }} required
                      value={num} 
                      onChange={e => {
                        const newNums = [...pensionForm.numbers];
                        newNums[i] = e.target.value.slice(-1);
                        setPensionForm({...pensionForm, numbers: newNums});
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid-2 mb-20">
              <div>
                <label className="text-caption mb-4 block font-bold">1등 당첨금 (월액)</label>
                <input type="text" className="input-field" disabled value="700만원 x 20년" />
              </div>
              <div>
                <label className="text-caption mb-4 block font-bold">1등 당첨자 수</label>
                <input 
                  type="number" className="input-field" required
                  value={pensionForm.firstWinnerCount} onChange={e => setPensionForm({...pensionForm, firstWinnerCount: e.target.value})}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-cta w-full" style={{ backgroundColor: '#E11D48', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
              연금복권 결과 저장하기
            </button>
          </form>
        )}
      </div>

      {message.text && (
        <div className="card mt-20" style={{ 
          display: 'flex', alignItems: 'center', gap: '12px', 
          backgroundColor: message.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${message.type === 'error' ? '#FEE2E2' : '#DCFCE7'}`
        }}>
          {message.type === 'error' ? <AlertCircle color="#EF4444" /> : <CheckCircle2 color="#10B981" />}
          <p style={{ fontSize: '0.85rem', fontWeight: '700', color: message.type === 'error' ? '#991B1B' : '#166534' }}>{message.text}</p>
        </div>
      )}
    </div>
  );
};

export default AdminLotteryPage;
