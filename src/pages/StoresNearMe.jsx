import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertCircle, MapPin, Search as SearchIcon, Navigation, Phone, Info, Map as MapIcon, ExternalLink, Plus } from 'lucide-react';
import { loadKakaoMap } from '../utils/loadKakaoMap';
import { REGIONS } from '../data/regions';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { isNativeApp as checkIsNative } from '../utils/platform';

const RADIUS_OPTIONS = [
  { label: '1km', value: 1000 },
  { label: '3km', value: 3000 },
  { label: '5km', value: 5000 },
  { label: '10km', value: 10000 },
];

const KEYWORD_TAGS = ['로또', '복권판매점', '연금복권'];

const StoresNearMe = () => {
  const navigate = useNavigate();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const storeMarkerRefs = useRef([]);
  const myLocationMarkerRef = useRef(null);
  const infoWindowRef = useRef(null);
  const isSearchingRef = useRef(false);
  const lastLocationRef = useRef(null);
  const lastLocationTimeRef = useRef(0);

  const isNative = checkIsNative();

  // 상태 관리
  const [searchTab, setSearchTab] = useState('NEARBY');
  const [allStores, setAllStores] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState(false);
  
  const [selectedRadius, setSelectedRadius] = useState(3000);
  const [selectedKeyword, setSelectedKeyword] = useState('로또');
  
  const [selectedSido, setSelectedSido] = useState('');
  const [selectedSigungu, setSelectedSigungu] = useState('');
  const [dongKeyword, setDongKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 1. 마커 제거 함수 (메모리 관리)
  const clearStoreMarkers = useCallback(() => {
    storeMarkerRefs.current.forEach((marker) => {
      if (marker && marker.setMap) marker.setMap(null);
    });
    storeMarkerRefs.current = [];
    if (infoWindowRef.current) infoWindowRef.current.close();
  }, []);

  // 2. 초기 지도 설정 (한 번만 실행)
  useEffect(() => {
    let isMounted = true;
    const initMap = async () => {
      try {
        const kakao = await loadKakaoMap();
        if (!isMounted || !mapContainerRef.current) return;

        kakao.maps.load(() => {
          if (!isMounted) return;
          try {
            const options = {
              center: new kakao.maps.LatLng(37.566826, 126.9786567),
              level: 4
            };
            const map = new kakao.maps.Map(mapContainerRef.current, options);
            mapInstanceRef.current = map;
            infoWindowRef.current = new kakao.maps.InfoWindow({ zIndex: 1000 });
          } catch (e) {
            setMapError(true);
          }
        });
      } catch (err) {
        setMapError(true);
      }
    };
    initMap();
    return () => { isMounted = false; };
  }, []);

  // 3. 위치 정보 조회 (최적화 옵션 적용)
  const getPosition = async () => {
    const now = Date.now();
    // 60초 이내면 기존 위치 재사용
    if (lastLocationRef.current && (now - lastLocationTimeRef.current < 60000)) {
      return lastLocationRef.current;
    }

    setLoadingText("현재 위치 확인 중...");
    if (isNative) {
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        await Geolocation.requestPermissions();
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      lastLocationRef.current = loc;
      lastLocationTimeRef.current = now;
      return loc;
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          lastLocationRef.current = loc;
          lastLocationTimeRef.current = now;
          resolve(loc);
        },
        reject,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  // 4. 검색 실행
  const executeSearch = async () => {
    if (isSearchingRef.current) return;
    isSearchingRef.current = true;
    setLoading(true);
    setError("");
    setAllStores([]);
    setVisibleCount(10);
    clearStoreMarkers();

    try {
      let kakao = window.kakao;
      if (!kakao || !kakao.maps) kakao = await loadKakaoMap();
      
      const ps = new kakao.maps.services.Places();
      let keyword = "";
      let loc = null;

      if (searchTab === 'NEARBY') {
        loc = await getPosition();
        keyword = selectedKeyword;
      } else if (searchTab === 'REGION') {
        if (!selectedSido) throw new Error("시/도를 선택해주세요.");
        keyword = `${selectedSido} ${selectedSigungu} ${dongKeyword} 로또`.trim();
      } else {
        if (!searchKeyword.trim()) throw new Error("검색어를 입력해주세요.");
        keyword = searchKeyword;
      }

      setLoadingText("판매점 검색 중...");
      
      const searchOptions = loc ? {
        location: new kakao.maps.LatLng(loc.lat, loc.lng),
        radius: selectedRadius,
        sort: kakao.maps.services.SortBy.DISTANCE
      } : {};

      ps.keywordSearch(keyword, (data, status) => {
        setLoading(false);
        isSearchingRef.current = false;
        
        if (status === kakao.maps.services.Status.OK) {
          const results = data.map(p => ({
            id: p.id,
            storeName: p.place_name,
            address: p.road_address_name || p.address_name,
            phone: p.phone,
            lat: Number(p.y),
            lng: Number(p.x),
            distance: Number(p.distance || 0)
          }));
          setAllStores(results);
          renderMarkers(results.slice(0, 10), loc);
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
          setError("검색 결과가 없습니다.");
        } else {
          setError("검색 중 오류가 발생했습니다.");
        }
      }, searchOptions);

    } catch (err) {
      setLoading(false);
      isSearchingRef.current = false;
      setError(err.message || "검색에 실패했습니다.");
    }
  };

  // 5. 마커 렌더링 (최적화)
  const renderMarkers = (storeList, centerLoc = null) => {
    if (!mapInstanceRef.current || mapError) return;
    const kakao = window.kakao;
    const bounds = new kakao.maps.LatLngBounds();

    if (centerLoc) {
      const center = new kakao.maps.LatLng(centerLoc.lat, centerLoc.lng);
      mapInstanceRef.current.setCenter(center);
      if (myLocationMarkerRef.current) myLocationMarkerRef.current.setMap(null);
      myLocationMarkerRef.current = new kakao.maps.Marker({
        position: center,
        map: mapInstanceRef.current,
        image: new kakao.maps.MarkerImage(
          'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
          new kakao.maps.Size(24, 35)
        )
      });
      bounds.extend(center);
    }

    storeList.forEach((store) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(store.lat, store.lng),
        map: mapInstanceRef.current
      });
      kakao.maps.event.addListener(marker, 'click', () => {
        infoWindowRef.current.setContent(`<div style="padding:10px;font-size:12px;font-weight:bold;">${store.storeName}</div>`);
        infoWindowRef.current.open(mapInstanceRef.current, marker);
      });
      storeMarkerRefs.current.push(marker);
      bounds.extend(marker.getPosition());
    });

    if (storeList.length > 0) mapInstanceRef.current.setBounds(bounds);
  };

  const handleShowMore = () => {
    const nextCount = visibleCount + 10;
    const nextItems = allStores.slice(visibleCount, nextCount);
    renderMarkers(nextItems);
    setVisibleCount(nextCount);
  };

  const visibleStores = allStores.slice(0, visibleCount);

  return (
    <div className="page-transition" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'white', borderBottom: '1px solid #F1F5F9', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none' }}><ChevronLeft size={24} /></button>
        <h1 className="title-md">판매점 찾기</h1>
      </header>

      <div className="container" style={{ flex: 1, paddingBottom: '140px' }}>
        <div style={{ display: 'flex', gap: '6px', padding: '16px 0', overflowX: 'auto' }}>
          {[
            { id: 'NEARBY', label: '내 주변', icon: <Navigation size={18} /> },
            { id: 'REGION', label: '지역 검색', icon: <MapPin size={18} /> },
            { id: 'KEYWORD', label: '상호 검색', icon: <SearchIcon size={18} /> }
          ].map(tab => (
            <button key={tab.id} onClick={() => { setSearchTab(tab.id); setAllStores([]); setError(""); }} style={{ flexShrink: 0, padding: '10px 16px', borderRadius: '40px', border: 'none', backgroundColor: searchTab === tab.id ? 'var(--primary-blue)' : 'white', color: searchTab === tab.id ? 'white' : '#64748B', fontWeight: '800', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: '20px', marginBottom: '16px', borderRadius: '24px' }}>
          {searchTab === 'NEARBY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {RADIUS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setSelectedRadius(opt.value)} style={{ padding: '8px 14px', borderRadius: '12px', border: selectedRadius === opt.value ? '2px solid var(--primary-blue)' : '1px solid #E2E8F0', backgroundColor: selectedRadius === opt.value ? '#EEF2FF' : 'white', color: selectedRadius === opt.value ? 'var(--primary-blue)' : '#64748B', fontWeight: '800', fontSize: '0.8rem' }}>{opt.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {KEYWORD_TAGS.map(tag => (
                  <button key={tag} onClick={() => setSelectedKeyword(tag)} style={{ padding: '6px 12px', borderRadius: '12px', border: selectedKeyword === tag ? '2px solid var(--primary-blue)' : '1px solid #E2E8F0', backgroundColor: selectedKeyword === tag ? '#EEF2FF' : 'white', color: selectedKeyword === tag ? 'var(--primary-blue)' : '#64748B', fontWeight: '800', fontSize: '0.8rem' }}>{tag}</button>
                ))}
              </div>
              <button className="btn-cta" onClick={executeSearch} disabled={loading} style={{ width: '100%', gap: '8px' }}>
                {loading ? <Loader2 className="animate-spin" /> : <Navigation size={20} />} 내 주변 판매점 찾기
              </button>
            </div>
          )}

          {searchTab === 'REGION' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={selectedSido} onChange={(e) => { setSelectedSido(e.target.value); setSelectedSigungu(''); }} style={selectStyle}>
                  <option value="">시/도</option>
                  {Object.keys(REGIONS).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={selectedSigungu} onChange={(e) => setSelectedSigungu(e.target.value)} disabled={!selectedSido} style={selectStyle}>
                  <option value="">구/군</option>
                  {(REGIONS[selectedSido] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <input type="text" placeholder="동 이름 (예: 역삼동)" value={dongKeyword} onChange={(e) => setDongKeyword(e.target.value)} style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && executeSearch()} />
              <button className="btn-cta" onClick={executeSearch} disabled={loading} style={{ width: '100%' }}>지역 검색</button>
            </div>
          )}

          {searchTab === 'KEYWORD' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="판매점명 또는 키워드" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && executeSearch()} />
              <button className="btn-cta" onClick={executeSearch} disabled={loading} style={{ width: '100%' }}>상호 검색</button>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', marginBottom: '24px' }}>
          {mapError ? (
            <div style={{ width: '100%', height: '200px', borderRadius: '24px', backgroundColor: '#F1F5F9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <MapIcon size={32} color="#94A3B8" />
              <p style={{ fontWeight: '800', color: '#64748B', fontSize: '0.85rem' }}>지도를 불러올 수 없습니다.</p>
            </div>
          ) : (
            <div ref={mapContainerRef} style={{ width: '100%', height: '300px', borderRadius: '24px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0' }} />
          )}
          {loading && (
             <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
               <Loader2 className="animate-spin" size={32} color="var(--primary-blue)" />
               <span style={{ marginTop: '12px', fontSize: '0.85rem', fontWeight: '800', color: '#475569' }}>{loadingText}</span>
             </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {error && <div className="card" style={{ padding: '30px 20px', textAlign: 'center', color: '#EF4444' }}><AlertCircle size={32} style={{ margin: '0 auto 12px' }} /><p style={{ fontWeight: '800' }}>{error}</p></div>}
          
          {visibleStores.map((store, idx) => (
            <div key={store.id} className="card" style={{ padding: '20px' }}>
              <div className="flex-between mb-8">
                <h4 style={{ fontWeight: '900', fontSize: '1.05rem' }}>{store.storeName}</h4>
                {store.distance > 0 && <span style={{ color: 'var(--primary-blue)', fontSize: '0.75rem', fontWeight: '900' }}>{store.distance < 1000 ? `${store.distance}m` : `${(store.distance / 1000).toFixed(1)}km`}</span>}
              </div>
              <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '12px' }}>{store.address}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => {
                  if (mapInstanceRef.current && !mapError) {
                    const pos = new kakao.maps.LatLng(store.lat, store.lng);
                    mapInstanceRef.current.panTo(pos);
                    infoWindowRef.current.setContent(`<div style="padding:10px;font-size:12px;font-weight:bold;">${store.storeName}</div>`);
                    infoWindowRef.current.open(mapInstanceRef.current, storeMarkerRefs.current[idx]);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    window.open(`https://map.kakao.com/link/search/${encodeURIComponent(store.address)}`, "_blank");
                  }
                }} className="btn-cta" style={{ flex: 1, height: '40px', fontSize: '0.85rem', backgroundColor: '#EEF2FF', color: 'var(--primary-blue)', border: 'none' }}>위치 확인</button>
                <button onClick={() => window.open(`https://map.kakao.com/link/search/${encodeURIComponent(store.address)}`, "_blank")} className="btn-cta" style={{ width: '40px', height: '40px', padding: 0, backgroundColor: '#F1F5F9', color: '#475569', border: 'none' }}><ExternalLink size={18} /></button>
              </div>
            </div>
          ))}

          {allStores.length > visibleCount && (
            <button onClick={handleShowMore} className="btn-cta" style={{ width: '100%', height: '54px', backgroundColor: 'white', color: '#475569', border: '1px solid #E2E8F0' }}><Plus size={20} /> 결과 더 보기</button>
          )}

          {allStores.length > 0 && (
            <div style={{ backgroundColor: '#EEF2FF', padding: '12px', borderRadius: '16px', display: 'flex', gap: '8px' }}>
              <Info size={14} color="var(--primary-blue)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '600' }}>실제 판매 여부는 방문 전 전화 등으로 확인 부탁드립니다.</p>
            </div>
          )}
        </div>
        
        {/* Production에서 진단 패널 숨김 (필요시 false로 변경) */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ marginTop: 30, padding: 10, backgroundColor: '#eee', borderRadius: 8, fontSize: '0.65rem', fontFamily: 'monospace' }}>
            [Debug] Stores: {allStores.length} | Visible: {visibleCount} | Map: {mapInstanceRef.current ? "Ready" : "None"}
          </div>
        )}
      </div>
    </div>
  );
};

const selectStyle = { flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: 'white', fontWeight: '800', fontSize: '0.85rem' };
const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0', fontWeight: '800', fontSize: '0.85rem' };

export default StoresNearMe;
