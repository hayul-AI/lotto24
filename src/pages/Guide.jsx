import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, QrCode, ExternalLink, AlertTriangle, ShieldCheck, CheckCircle2, Info, Banknote, CalendarClock, HandCoins } from 'lucide-react';

const Guide = () => {
  const navigate = useNavigate();

  return (
    <div className="page-transition" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', backgroundColor: 'white', borderBottom: '1px solid #F1F5F9', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '12px' }}>
          <ChevronLeft size={24} color="#0F172A" />
        </button>
        <h1 className="title-md">당첨자 가이드</h1>
      </header>

      <div className="container" style={{ paddingTop: '24px' }}>
        
        {/* 상단 타이틀 */}
        <div style={{ marginBottom: '32px', padding: '0 8px' }}>
          <h2 className="title-lg" style={{ color: '#0F172A', marginBottom: '8px' }}>당첨 확인부터<br/>수령까지 꼭 알아야 할 안내</h2>
          <p className="text-caption" style={{ fontSize: '0.9rem' }}>공식 동행복권 기준 안전한 당첨금 수령 가이드</p>
        </div>

        {/* 빠른 안내 카드 6개 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '32px' }}>
          <QuickCard icon={<CheckCircle2 size={20} color="#2563EB" />} text="당첨 확인" />
          <QuickCard icon={<ShieldCheck size={20} color="#059669" />} text="복권 보관" />
          <QuickCard icon={<CalendarClock size={20} color="#D97706" />} text="지급 기한" />
          <QuickCard icon={<Banknote size={20} color="#7C3AED" />} text="수령처" />
          <QuickCard icon={<HandCoins size={20} color="#DB2777" />} text="세금 안내" />
          <QuickCard icon={<AlertTriangle size={20} color="#DC2626" />} text="주의사항" />
        </div>

        {/* 섹션 1: 당첨 확인 방법 */}
        <section className="mb-32">
          <SectionTitle title="1. 당첨 확인 방법" />
          <div className="card" style={{ padding: '20px' }}>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: '#334155', lineHeight: '1.5' }}>
              <li>매주 토요일 생방송 추첨 방송으로 확인 가능합니다.</li>
              <li>동행복권 홈페이지에서 회차별 번호를 확인할 수 있습니다.</li>
              <li>복권에 인쇄된 <strong>QR코드</strong>로 간편하게 확인할 수 있습니다.</li>
              <li>동행복권 고객센터 또는 가까운 판매점에 방문하여 확인할 수 있습니다.</li>
            </ul>
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#EFF6FF', borderRadius: '12px', display: 'flex', gap: '12px' }}>
              <Info size={20} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.85rem', color: '#1E3A8A', fontWeight: '700', lineHeight: '1.4' }}>
                QR 당첨확인은 보조 수단입니다. 반드시 실물 복권의 번호와 다시 한번 대조하여 확인하세요.
              </p>
            </div>
          </div>
        </section>

        {/* 섹션 2: 당첨복권 보관 방법 */}
        <section className="mb-32">
          <SectionTitle title="2. 당첨복권 보관 방법" />
          <div className="card" style={{ padding: '20px' }}>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: '#334155', lineHeight: '1.5' }}>
              <li><strong>당첨 확인 즉시 복권 뒷면에 서명하세요.</strong> (소유권 증명)</li>
              <li>로또 용지는 감열지이므로 열과 물에 약합니다. 뜨거운 곳을 피해주세요.</li>
              <li>외출 시 구겨지거나 찢어지지 않도록 안전한 장소에 보관하세요.</li>
              <li>복권 원형이 심하게 훼손되어 바코드 인식이 불가하면 당첨금 지급이 어려울 수 있습니다.</li>
            </ul>
          </div>
        </section>

        {/* 섹션 3: 지급 기한 */}
        <section className="mb-32">
          <SectionTitle title="3. 당첨금 지급 기한" />
          <div className="card" style={{ padding: '24px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={24} color="#DC2626" />
              <h4 style={{ fontWeight: '900', color: '#991B1B', fontSize: '1.1rem' }}>지급기한은 단 1년</h4>
            </div>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: '#7F1D1D', lineHeight: '1.5' }}>
              <li>당첨금 지급기한은 <strong>해당 회차 지급개시일로부터 1년</strong>입니다.</li>
              <li>지급기한 종료일이 은행 영업일이 아니면 다음 영업일까지 청구 가능합니다.</li>
              <li>기한이 지나면 미수령 당첨금은 복권기금으로 전액 귀속됩니다.</li>
            </ul>
            <p style={{ marginTop: '16px', fontWeight: '800', color: '#B91C1C', textAlign: 'center', fontSize: '0.95rem' }}>
              당첨 확인 후 가능한 한 빨리 수령 절차를 진행하세요!
            </p>
          </div>
        </section>

        {/* 섹션 4: 로또6/45 당첨금 수령처 */}
        <section className="mb-32">
          <SectionTitle title="4. 로또 6/45 당첨금 수령처" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <PrizeCard 
              rank="1등" 
              location="NH농협은행 본점 (서울)" 
              requires="당첨복권, 신분증" 
              color="#F59E0B" 
            />
            <PrizeCard 
              rank="2등, 3등" 
              location="NH농협은행 전국지점" 
              requires="당첨복권, 신분증" 
              color="#3B82F6" 
            />
            <PrizeCard 
              rank="4등, 5등" 
              location="일반 로또복권 판매점" 
              requires="당첨복권" 
              color="#10B981" 
              desc="(3등 당첨금 중 200만원 이하일 경우에도 세금 공제 없이 수령 가능)"
            />
          </div>
        </section>

        {/* 섹션 5: 연금복권720+ 당첨금 수령처 */}
        <section className="mb-32">
          <SectionTitle title="5. 연금복권 720+ 당첨금 수령처" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <PrizeCard 
              rank="1등, 2등, 보너스" 
              location="(주)동행복권 본사" 
              requires="당첨복권, 신분증, 통장사본" 
              color="#8B5CF6" 
              desc="연금식 당첨금"
            />
            <PrizeCard 
              rank="3등, 4등" 
              location="NH농협은행 전국지점" 
              requires="당첨복권, 신분증" 
              color="#3B82F6" 
              desc="5만원 초과 당첨금 (일시불)"
            />
            <PrizeCard 
              rank="5등, 6등, 7등" 
              location="일반 연금복권 판매점" 
              requires="당첨복권" 
              color="#10B981" 
              desc="5만원 이하 당첨금"
            />
          </div>
        </section>

        {/* 섹션 6: 주의사항 */}
        <section className="mb-40">
          <SectionTitle title="6. 꼭 알아두세요 (주의사항)" />
          <div className="card" style={{ padding: '20px' }}>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>
              <li>비인가 업체나 불법 사이트에서 구매한 복권은 번호가 일치해도 당첨금이 지급되지 않습니다.</li>
              <li>판매점 단말기 오류가 발생할 수 있으므로, 단말기 확인 후 직접 육안으로 번호를 재확인하시기 바랍니다.</li>
              <li>당첨금은 <strong>당첨복권 실물 소지자</strong>에게 지급됩니다. 사진이나 복사본으로는 수령할 수 없습니다.</li>
              <li>본 앱(복권24)의 QR 확인 결과는 보조 확인용이며, 최종 당첨 판단은 동행복권 공식 시스템과 실물 복권에 따릅니다.</li>
            </ul>
          </div>
        </section>

        {/* 액션 버튼 그룹 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          <button className="btn-cta" onClick={() => navigate('/scanner')} style={{ width: '100%', gap: '8px' }}>
            <QrCode size={20} /> QR로 내 복권 당첨 확인하기
          </button>
          <button 
            onClick={() => window.open('https://www.dhlottery.co.kr/guide/wnrGuide', '_blank')}
            style={{ 
              width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #CBD5E1', 
              backgroundColor: 'white', color: '#334155', fontWeight: '800', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            동행복권 공식 가이드 보기 <ExternalLink size={18} />
          </button>
        </div>

        {/* 공통 안내문 */}
        <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center', lineHeight: '1.6', wordBreak: 'keep-all' }}>
          본 안내는 동행복권 당첨자 가이드 내용을 바탕으로 사용자가 쉽게 확인할 수 있도록 요약 정리한 정보입니다. 실제 당첨금 지급 및 수령 기준은 동행복권 공식 안내를 반드시 확인하시기 바랍니다.
        </p>

      </div>
    </div>
  );
};

const SectionTitle = ({ title }) => (
  <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0F172A', marginBottom: '16px', paddingLeft: '4px' }}>
    {title}
  </h3>
);

const QuickCard = ({ icon, text }) => (
  <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', border: '1px solid #F1F5F9' }}>
    <div style={{ padding: '8px', backgroundColor: '#F8FAFC', borderRadius: '50%' }}>
      {icon}
    </div>
    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155' }}>{text}</span>
  </div>
);

const PrizeCard = ({ rank, location, requires, color, desc }) => (
  <div className="card" style={{ padding: '20px', borderLeft: `6px solid ${color}` }}>
    <h4 style={{ fontSize: '1.1rem', fontWeight: '900', color: color, marginBottom: '12px' }}>{rank}</h4>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#334155' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <span style={{ fontWeight: '800', color: '#64748B', width: '45px' }}>수령처</span>
        <span style={{ fontWeight: '700' }}>{location}</span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <span style={{ fontWeight: '800', color: '#64748B', width: '45px' }}>준비물</span>
        <span style={{ fontWeight: '700' }}>{requires}</span>
      </div>
      {desc && <p style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '4px' }}>{desc}</p>}
    </div>
  </div>
);

export default Guide;
