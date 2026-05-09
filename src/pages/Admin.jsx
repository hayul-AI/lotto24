import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Database, Trash2, RefreshCw, CheckCircle2, 
  UploadCloud, AlertCircle, Activity, Layers, Zap, DatabaseZap, 
  Info, Terminal, BarChart3, Link, FileJson, Download, FileText, Upload
} from 'lucide-react';
import { 
  getAllLottoResults, getAllPensionResults, cleanPlaceholderData,
  isValidLotto, isValidPension 
} from '../services/lottoService';
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';

const Admin = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [stats, setStats] = useState({ 
    lotto: 0, pension: 0, 
    lottoLatest: 0, pensionLatest: 0, 
    lottoMissing: [], pensionMissing: [],
    lottoPrizeMissing: [], lottoWinnerMissing: [],
    lottoExistingSet: new Set(), pensionExistingSet: new Set()
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  const [externalUrl, setExternalUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [diag, setDiag] = useState(null);
  const [importAnalysis, setImportAnalysis] = useState(null);
  const [validatedData, setValidatedData] = useState(null); // { type, items: [] }

  const loadStats = async () => {
    setLoading(true);
    // 강제 동기화(캐시 우회)
    const [lRes, pRes] = await Promise.all([getAllLottoResults(true), getAllPensionResults(true)]);
    const lottoData = lRes.data || [];
    const pensionData = pRes.data || [];

    const analyzeMissing = (data) => {
      if (data.length === 0) return { missing: [], set: new Set(), prizeMissing: [], winnerMissing: [] };
      const drawNos = data.map(d => Number(d.drawNo));
      const max = Math.max(...drawNos);
      const existingSet = new Set(drawNos);
      const missing = [];
      for (let i = 1; i <= max; i++) {
        if (!existingSet.has(i)) missing.push(i);
      }
      const prizeMissing = data.filter(d => !d.firstPrizeAmount || d.firstPrizeAmount <= 0).map(d => d.drawNo);
      const winnerMissing = data.filter(d => !d.firstWinnerCount || d.firstWinnerCount <= 0).map(d => d.drawNo);
      return { missing, set: existingSet, prizeMissing, winnerMissing };
    };

    const lAnalysis = analyzeMissing(lottoData);
    const pAnalysis = analyzeMissing(pensionData);

    setStats({ 
      lotto: lottoData.length, 
      pension: pensionData.length,
      lottoLatest: lottoData[0]?.drawNo || 0,
      pensionLatest: pensionData[0]?.drawNo || 0,
      lottoMissing: lAnalysis.missing,
      pensionMissing: pAnalysis.missing,
      lottoPrizeMissing: lAnalysis.prizeMissing,
      lottoWinnerMissing: lAnalysis.winnerMissing,
      lottoExistingSet: lAnalysis.set,
      pensionExistingSet: pAnalysis.set
    });
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] ? values[i].trim() : '';
      });
      return obj;
    });
  };

  const intelligentNormalize = (raw, type, sourceStr = 'external_github_import') => {
    if (type === 'pension') {
      let drawNo = Number(raw.drawNo || raw.drwNo || 0);
      if (!drawNo) return null;
      let drawDate = raw.drawDate || raw.drwNoDate || raw.date || "";

      let normalized = { ...raw, drawNo, drawDate };

      // CSV 구조 대응 (firstPrizeGroup, firstPrizeNumber)
      if (raw.firstPrizeGroup && raw.firstPrizeNumber && typeof raw.firstPrizeNumber === 'string') {
         normalized.firstPrizeNumber = {
           group: String(raw.firstPrizeGroup).replace(/[^0-9]/g, ''),
           numbers: raw.firstPrizeNumber.replace(/[^0-9]/g, '').split('').map(Number)
         };
         normalized.firstPrizeGroup = raw.firstPrizeGroup;
         normalized.fullFirstPrizeNumber = raw.firstPrizeNumber;
      } 
      // 기존 JSON 구조 대응
      else if (!normalized.firstPrizeNumber && normalized.prizeNumbers) {
        if (Array.isArray(normalized.prizeNumbers) && normalized.prizeNumbers.length >= 7) {
          normalized.firstPrizeNumber = { group: String(normalized.prizeNumbers[0]), numbers: normalized.prizeNumbers.slice(1).map(Number) };
        } else if (typeof normalized.prizeNumbers === 'object') {
          const pn = normalized.prizeNumbers;
          normalized.firstPrizeNumber = { group: String(pn.grade ?? pn.group ?? '?'), numbers: pn.winning ?? pn.numbers ?? [] };
        }
      }

      normalized.firstPrizeAmount = Number(raw.firstPrizeAmount || raw.firstWinamnt || 0);
      normalized.firstWinnerCount = Number(raw.firstWinnerCount || raw.firstPrzwnerCo || 0);
      normalized.source = sourceStr;
      return normalized;
    } 

    const drawNo = Number(raw.drawNo || raw.drwNo || raw.round || raw['회차'] || raw.draw_no || 0);
    if (!drawNo) return null;

    const drawDate = raw.drawDate || raw.drwNoDate || raw.date || raw.draw_date || "";

    let numbers = raw.numbers || raw.nums;
    // CSV 구조 대응 (n1 ~ n6)
    if (raw.n1 && raw.n2 && raw.n3 && raw.n4 && raw.n5 && raw.n6) {
      numbers = [raw.n1, raw.n2, raw.n3, raw.n4, raw.n5, raw.n6].map(Number);
    }
    if (!numbers && raw.drwtNo1) {
      numbers = [raw.drwtNo1, raw.drwtNo2, raw.drwtNo3, raw.drwtNo4, raw.drwtNo5, raw.drwtNo6].map(Number);
    }

    if (!Array.isArray(numbers) || numbers.length !== 6) return null;

    const bonusNo = Number(raw.bonusNo || raw.bnusNo || raw.bonus || raw.bonus_no || 0);
    const firstPrizeAmount = Number(raw.firstPrizeAmount || raw.firstWinamnt || raw.firstPrize || 0);
    const firstWinnerCount = Number(raw.firstWinnerCount || raw.firstPrzwnerCo || 0);
    const totalPrizeAmount = Number(raw.totalPrizeAmount || raw.firstAccumamnt || raw.totSellamnt || 0);

    return {
      drawNo, drawDate, numbers: numbers.sort((a,b)=>Number(a)-Number(b)), bonusNo,
      firstPrizeAmount, firstWinnerCount, totalPrizeAmount,
      verified: true, source: sourceStr
    };
  };

  const executeValidation = (items, type, sourceStr) => {
    const missingSet = new Set(type === 'lotto' ? stats.lottoMissing.map(Number) : stats.pensionMissing.map(Number));
    
    const validNormalizedItems = items
      .map(raw => intelligentNormalize(raw, type, sourceStr))
      .filter(item => {
        if (!item) return false;
        // 금액 정보가 없더라도 회차/번호가 맞으면 수용 (대신 '금액 정보 누락'으로 앱에서 표시됨)
        if (type === 'lotto' && !isValidLotto(item)) return false;
        if (type === 'pension' && !isValidPension(item)) return false;
        return true;
      });
    
    const matched = validNormalizedItems.filter(item => missingSet.has(Number(item.drawNo)));
    const unmatchedMissing = [...missingSet].filter(no => !validNormalizedItems.some(item => Number(item.drawNo) === no));
    const drawNos = validNormalizedItems.map(i => Number(i.drawNo));
    
    setImportAnalysis({
      totalInJson: items.length,
      recognized: validNormalizedItems.length,
      rejected: items.length - validNormalizedItems.length,
      minDrawNo: drawNos.length > 0 ? Math.min(...drawNos) : 0,
      maxDrawNo: drawNos.length > 0 ? Math.max(...drawNos) : 0,
      firstDataPreview: validNormalizedItems.length > 0 ? JSON.stringify(validNormalizedItems[0]).substring(0, 60) + '...' : '없음',
      lastDataPreview: validNormalizedItems.length > 0 ? JSON.stringify(validNormalizedItems[validNormalizedItems.length - 1]).substring(0, 60) + '...' : '없음',
      missingInApp: missingSet.size,
      matchedCount: matched.length,
      unmatchedMissing: unmatchedMissing.sort((a,b)=>b-a)
    });

    if (validNormalizedItems.length === 0) {
      throw new Error("모든 데이터가 검증에 실패했거나, 가져올 수 있는 유효한 데이터가 없습니다.");
    }

    setValidatedData({ type, items: validNormalizedItems, matchedCount: matched.length });
    setMessage(`✅ 검증 완료! 총 ${items.length}건 중 ${validNormalizedItems.length}건 통과 (불량/가짜/누락 ${items.length - validNormalizedItems.length}건 제외)`);
  };

  // 1. 외부 URL 검증
  const handleUrlValidate = async (type) => {
    if (!externalUrl || !externalUrl.startsWith('http')) {
      alert("올바른 외부 URL을 입력해주세요.");
      return;
    }
    
    let fetchPath = externalUrl;
    if (fetchPath.includes('github.com') && fetchPath.includes('/blob/')) {
      fetchPath = fetchPath.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    setLoading(true);
    setMessage(`외부 데이터 구조 진단 및 검증 중...`);
    setDiag(null);
    setImportAnalysis(null);
    setValidatedData(null);
    
    try {
      const res = await fetch(fetchPath, { cache: 'no-store' });
      if (!res.ok) throw new Error(`파일 로드 실패 (${res.status})`);
      
      const text = await res.text();
      setDiag({ path: fetchPath, status: res.status, contentType: res.headers.get('content-type'), preview: text.substring(0, 80) });

      if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
        throw new Error('Raw URL이 아닙니다. GitHub 파일 화면의 Raw 버튼 주소를 사용하세요.');
      }

      let json;
      try { json = JSON.parse(text); } catch (e) { throw new Error('올바른 JSON 형식이 아닙니다.'); }

      const items = Array.isArray(json) ? json : (json.results || json.items || json.data || []);
      executeValidation(items, type, 'external_github_import');
      
    } catch (err) {
      setMessage(`❌ 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. 로컬 파일 업로드 검증
  const handleFileUpload = async (type) => {
    if (!selectedFile) {
      alert("파일을 먼저 선택해주세요.");
      return;
    }
    
    setLoading(true);
    setMessage(`로컬 파일 읽는 중...`);
    setDiag(null);
    setImportAnalysis(null);
    setValidatedData(null);

    try {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("파일 읽기 실패"));
        reader.readAsText(selectedFile);
      });

      const isJson = selectedFile.name.toLowerCase().endsWith('.json');
      const isCsv = selectedFile.name.toLowerCase().endsWith('.csv');
      let items = [];

      if (isJson) {
        let json;
        try { json = JSON.parse(text); } catch (e) { throw new Error('JSON 파싱에 실패했습니다.'); }
        items = Array.isArray(json) ? json : (json.results || json.items || json.data || []);
      } else if (isCsv) {
        items = parseCSV(text);
      } else {
        throw new Error("지원하지 않는 파일 형식입니다. (.json 또는 .csv만 가능)");
      }

      const sourceName = isCsv ? 'manual_csv_import' : 'manual_json_import';
      executeValidation(items, type, sourceName);
      
    } catch (err) {
      setMessage(`❌ 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // 3. Firestore 업로드
  const handleUpload = async (onlyMissing) => {
    if (!validatedData) return;
    const { type, items } = validatedData;
    const missingSet = new Set(type === 'lotto' ? stats.lottoMissing.map(Number) : stats.pensionMissing.map(Number));
    
    const targetItems = onlyMissing ? items.filter(item => missingSet.has(Number(item.drawNo))) : items;
    
    if (targetItems.length === 0) {
      alert("업로드할 대상(누락된 회차)이 없습니다.");
      return;
    }

    if (!window.confirm(`검증된 데이터 중 ${targetItems.length}건을 Firestore에 업로드하시겠습니까?`)) return;

    setLoading(true);
    setProgress({ current: 0, total: targetItems.length });
    
    try {
      let batch = writeBatch(db);
      let count = 0;
      let successCount = 0;

      for (const item of targetItems) {
        const collectionName = type === 'lotto' ? 'lotto_results' : 'pension_results';
        const docRef = doc(db, collectionName, String(item.drawNo));
        batch.set(docRef, { ...item, verified: true, updatedAt: new Date().toISOString() }, { merge: true });

        count++;
        successCount++;
        if (count === 400) { 
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
          setProgress(prev => ({ ...prev, current: successCount }));
        }
      }

      if (count > 0) await batch.commit();
      
      await loadStats();
      setMessage(`✅ 업로드 성공! (${successCount}건) | 데이터베이스가 최신 상태로 동기화되었습니다.`);
      setValidatedData(null);
    } catch (err) {
      setMessage(`❌ 업로드 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. JSON 다운로드 (Export)
  const handleDownload = () => {
    if (!validatedData) return;
    const fileName = validatedData.type === 'lotto' ? 'lotto645_full.json' : 'pension720_full.json';
    const jsonStr = JSON.stringify(validatedData.items, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage(`✅ ${fileName} 내보내기 완료!`);
  };

  return (
    <div className="container page-transition" style={{ paddingBottom: '120px' }}>
      <header className="flex-between mb-24">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate("/")} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><ChevronLeft size={24} /></button>
          <h1 className="title-md">데이터 마스터 파이프라인</h1>
        </div>
        <button onClick={loadStats} disabled={loading} className="btn-sub"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
      </header>

      {/* 분석 대시보드 */}
      <div className="card mb-24" style={{ backgroundColor: '#F8FAFC' }}>
        <h3 className="title-sm mb-16" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={18} /> 데이터 상태 분석</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AnalysisBox 
            label="로또 6/45" count={stats.lotto} latest={stats.lottoLatest} missing={stats.lottoMissing} 
            prizeMissing={stats.lottoPrizeMissing} winnerMissing={stats.lottoWinnerMissing} color="var(--primary-blue)" 
          />
          <AnalysisBox label="연금복권 720+" count={stats.pension} latest={stats.pensionLatest} missing={stats.pensionMissing} color="#E11D48" />
        </div>
      </div>

      {/* 오프라인 파일 업로드 */}
      <div className="card mb-24" style={{ border: '2px solid #6366F1', backgroundColor: '#EEF2FF' }}>
        <h3 className="title-sm mb-12" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4338CA' }}>
          <FileText size={18} /> 오프라인 수동 업로드 (CSV / JSON)
        </h3>
        <p className="text-caption mb-16" style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
          동행복권 엑셀 다운로드가 불가능할 때 관리자가 직접 작성한 CSV 파일이나 백업 JSON 파일을 첨부하여 Firestore에 덮어씁니다.
        </p>

        <div style={{ marginBottom: '16px' }}>
          <input 
            type="file" 
            accept=".csv, .json" 
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button 
            className="btn-sub" 
            onClick={() => fileInputRef.current.click()}
            style={{ width: '100%', padding: '16px', border: '2px dashed #818CF8', backgroundColor: 'white', color: '#4338CA', display: 'flex', justifyContent: 'center', gap: '8px' }}
          >
            <Upload size={20} /> {selectedFile ? selectedFile.name : 'PC에서 파일 선택하기 (.csv, .json)'}
          </button>
        </div>

        <div className="grid-2">
          <button className="btn-cta" onClick={() => handleFileUpload('lotto')} disabled={loading || !selectedFile} style={{ backgroundColor: '#4F46E5', fontSize: '0.8rem', padding: '12px' }}>
            로또 데이터로 검증
          </button>
          <button className="btn-cta" onClick={() => handleFileUpload('pension')} disabled={loading || !selectedFile} style={{ backgroundColor: '#4F46E5', fontSize: '0.8rem', padding: '12px' }}>
            연금 데이터로 검증
          </button>
        </div>
      </div>

      {/* 외부 데이터 검증 입력부 */}
      <div className="card mb-24" style={{ border: '2px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
        <h3 className="title-sm mb-12" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
          <Link size={18} /> 외부 URL 파이프라인
        </h3>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input 
            type="text" 
            placeholder="외부 GitHub Raw JSON URL 입력..." 
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            style={{ width: '100%', padding: '12px 12px 12px 12px', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
          />
        </div>

        <div className="grid-2">
          <button className="btn-cta" onClick={() => handleUrlValidate('lotto')} disabled={loading || !externalUrl} style={{ backgroundColor: '#64748B', fontSize: '0.8rem', padding: '12px' }}>
            로또 가져오기
          </button>
          <button className="btn-cta" onClick={() => handleUrlValidate('pension')} disabled={loading || !externalUrl} style={{ backgroundColor: '#64748B', fontSize: '0.8rem', padding: '12px' }}>
            연금 가져오기
          </button>
        </div>
      </div>

      {/* 2. 검증 완료 패널 및 액션 */}
      {validatedData && importAnalysis && (
        <div className="card mb-24" style={{ backgroundColor: '#F0FDF4', border: '2px solid #86EFAC', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', backgroundColor: '#22C55E' }} />
          <h3 className="title-sm mb-12" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', marginTop: '8px' }}>
            <CheckCircle2 size={18} /> 데이터 검증 통과
          </h3>
          
          <div className="grid-2" style={{ gap: '12px', fontSize: '0.8rem', marginBottom: '16px', color: '#166534' }}>
            <div>• 소스 원본: <b>{importAnalysis.totalInJson}건</b></div>
            <div>• 검증 통과: <b style={{ fontSize: '1.1em', color: '#15803D' }}>{importAnalysis.recognized}건</b></div>
            <div>• 불량 제외: <b style={{ color: '#DC2626' }}>{importAnalysis.rejected}건</b></div>
            <div>• 누락 매칭: <b style={{ color: '#0369A1' }}>{importAnalysis.matchedCount}건</b></div>
          </div>
          
          <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '8px', fontSize: '0.7rem', color: '#166534', marginBottom: '16px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            <div style={{ marginBottom: '6px' }}><strong style={{ color: '#14532D' }}>[첫 데이터 샘플]</strong> {importAnalysis.firstDataPreview}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn-cta" onClick={() => handleUpload(false)} disabled={loading} style={{ backgroundColor: '#059669', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <UploadCloud size={18} /> 전체 통과 데이터 Firestore 덮어쓰기 ({importAnalysis.recognized}건)
            </button>
            <button className="btn-cta" onClick={() => handleUpload(true)} disabled={loading} style={{ backgroundColor: '#0284C7', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <Zap size={18} /> 앱 누락분만 Firestore 업로드 ({importAnalysis.matchedCount}건)
            </button>
            <button className="btn-cta" onClick={handleDownload} disabled={loading} style={{ backgroundColor: '#4F46E5', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <Download size={18} /> 정규화된 JSON 내보내기 (백업용)
            </button>
          </div>
        </div>
      )}

      {/* 상태 메시지 및 진단 도구 */}
      {diag && !validatedData && (
        <div className="card mb-24" style={{ backgroundColor: '#1e293b', color: '#f8fafc', padding: '16px', fontSize: '0.7rem', fontFamily: 'monospace' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#94a3b8' }}><Terminal size={12} /><span>HTTP DIAGNOSTICS</span></div>
          <div>[Path] {diag.path}</div>
          <div>[Status] {diag.status} | [Type] {diag.contentType}</div>
        </div>
      )}

      {message && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
          <Info size={20} color="var(--primary-blue)" style={{ minWidth: '20px' }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.85rem', fontWeight: '700', lineHeight: '1.4' }}>{message}</p>
            {progress.total > 0 && (
              <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', backgroundColor: 'var(--primary-blue)', transition: 'width 0.3s' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AnalysisBox = ({ label, count, latest, missing, prizeMissing = [], winnerMissing = [], color }) => (
  <div style={{ padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: `1px solid #E2E8F0` }}>
    <div className="flex-between mb-8"><span style={{ fontWeight: '800', color }}>{label}</span><span className="text-caption">최신: {latest}회</span></div>
    <div className="flex-between">
      <p style={{ fontSize: '1.4rem', fontWeight: '900' }}>{count}<span style={{ fontSize: '0.8rem', color: '#94A3B8', marginLeft: '4px' }}>건</span></p>
      <div style={{ textAlign: 'right' }}>
        {missing.length > 0 && <p style={{ fontSize: '0.65rem', color: '#E11D48', fontWeight: '800' }}>누락 {missing.length}건</p>}
        {prizeMissing.length > 0 && <p style={{ fontSize: '0.65rem', color: '#F59E0B', fontWeight: '800' }}>금액누락 {prizeMissing.length}건</p>}
        {winnerMissing.length > 0 && <p style={{ fontSize: '0.65rem', color: '#D97706', fontWeight: '800' }}>당첨자누락 {winnerMissing.length}건</p>}
        {missing.length === 0 && prizeMissing.length === 0 && winnerMissing.length === 0 && <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: '800' }}>완벽 ✅</span>}
      </div>
    </div>
  </div>
);

export default Admin;
