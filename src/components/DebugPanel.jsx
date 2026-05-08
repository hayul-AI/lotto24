import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Activity, X } from 'lucide-react';

const DebugPanel = () => {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState({
    firebase: 'checking...',
    lotto: '-',
    pension: '-',
    stores: '-',
    winners: '-',
    kakaoKey: '-',
    kakaoSdk: '-',
    origin: '-',
    location: '-',
    lastError: 'none'
  });

  const refresh = async () => {
    const result = { ...info };
    try {
      const [l, p, s, w] = await Promise.all([
        getDocs(collection(db, "lotto_results")),
        getDocs(collection(db, "pension_results")),
        getDocs(collection(db, "lottery_stores")),
        getDocs(collection(db, "winning_stores")),
      ]);
      result.firebase = 'Connected ✅';
      result.lotto = `${l.size} docs`;
      result.pension = `${p.size} docs`;
      result.stores = `${s.size} docs`;
      result.winners = `${w.size} docs`;
    } catch (err) {
      result.firebase = 'Error ❌';
      result.lastError = err.message;
    }

    result.kakaoKey = import.meta.env.VITE_KAKAO_MAP_KEY ? 'exists ✅' : 'MISSING ❌';
    result.kakaoSdk = (window.kakao && window.kakao.maps) ? 'Loaded ✅' : 'Not loaded ❌';
    result.origin = window.location.origin;

    navigator.geolocation.getCurrentPosition(
      pos => { result.location = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`; setInfo({ ...result }); },
      () => { result.location = 'Denied / Unavailable'; setInfo({ ...result }); }
    );

    setInfo(result);
  };

  useEffect(() => { if (open) refresh(); }, [open]);

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{
      position: 'fixed', bottom: '110px', right: '16px', zIndex: 9999,
      background: '#1A1F27', color: 'white', border: 'none',
      width: '40px', height: '40px', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer'
    }}><Activity size={18} /></button>
  );

  const rows = [
    ['Firebase', info.firebase],
    ['lotto_results', info.lotto],
    ['pension_results', info.pension],
    ['lottery_stores', info.stores],
    ['winning_stores', info.winners],
    ['Kakao Map Key', info.kakaoKey],
    ['Kakao SDK', info.kakaoSdk],
    ['Origin', info.origin],
    ['Location', info.location],
    ['Last Error', info.lastError],
  ];

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 9999,
      background: '#1A1F27', color: '#E5E8EB', padding: '20px',
      borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
      boxShadow: '0 -8px 30px rgba(0,0,0,0.4)', fontFamily: 'monospace', fontSize: '0.75rem',
      maxHeight: '60vh', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontWeight: '900', color: '#3182F6' }}>🛠 Debug Panel</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#8B95A1', cursor: 'pointer' }}><X size={18} /></button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '1px solid #2A2F3A' }}>
              <td style={{ padding: '8px 4px', color: '#8B95A1', fontWeight: '700' }}>{k}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: '700', wordBreak: 'break-all' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={refresh} style={{ marginTop: '12px', width: '100%', padding: '10px', background: '#2A2F3A', border: 'none', color: 'white', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Refresh</button>
    </div>
  );
};

export default DebugPanel;
