import React, { useEffect, useState } from 'react';
import { getWinningStores } from '../services/lottoService';
import { Award, MapPin, Trophy, ChevronLeft, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WinningStores = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      const { data } = await getWinningStores();
      const sorted = (data || []).sort((a, b) => (b.winCount || 0) - (a.winCount || 0));
      setStores(sorted);
      setLoading(false);
    };
    fetchStores();
  }, []);

  if (loading) return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--primary-indigo)', borderTopColor: 'transparent', borderRadius: '50%' }} />
    </div>
  );

  return (
    <div className="container fade-in" style={{ padding: '24px 20px 140px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="title-lg" style={{ flex: 1, textAlign: 'center', marginRight: '24px' }}>1등 배출 명당</h2>
      </div>
      
      {stores.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Star size={48} color="#CBD5E1" style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-muted)', fontWeight: '700' }}>등록된 명당 정보가 없습니다.</p>
        </div>
      ) : (
        stores.map((store, index) => (
          <div key={index} className="card" style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '20px' }}>
            {/* Rank/Count Badge */}
            <div style={{ 
              background: index < 3 ? 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)' : '#F8FAFC', 
              width: '60px', 
              height: '64px', 
              borderRadius: '18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: index < 3 ? '1px solid #F59E0B' : '1px solid var(--glass-border)',
              boxShadow: index < 3 ? '0 4px 10px rgba(245, 158, 11, 0.2)' : 'none'
            }}>
              <Trophy size={18} color={index < 3 ? '#F59E0B' : '#94A3B8'} style={{ marginBottom: '2px' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: '900', color: index < 3 ? '#92400E' : 'var(--text-sub)' }}>{store.winCount}회</span>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)' }}>{store.storeName}</h4>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '800',
                  color: 'var(--primary-indigo)', 
                  backgroundColor: '#EEF2FF', 
                  padding: '4px 10px', 
                  borderRadius: '10px' 
                }}>
                  {store.region}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: '1.4' }}>
                <MapPin size={14} color="#94A3B8" />
                {store.address}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default WinningStores;
