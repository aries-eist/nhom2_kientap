'use client'
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import '@/app/layout-styles.css';

const statusStyleConfig: Record<string, { label: string; text: string; bg: string; border: string }> = {
  New: { label: 'Mới', text: '#CDA000', bg: '#FFFDE6', border: '#FFF9B3' },
  RequestInfo: { label: 'Yêu cầu bổ sung', text: '#B02BB8', bg: '#F9E6FA', border: '#F3B3F5' },
  Approved: { label: 'Đã phê duyệt', text: '#2F80ED', bg: '#EBF3FF', border: '#B3D4FF' },
  Rejected: { label: 'Đã hủy', text: '#F2994A', bg: '#FFF0E6', border: '#FFD1B3' },
  Closed: { label: 'Đã đóng', text: '#27AE60', bg: '#E6F9ED', border: '#B3F5CC' },
};

function ViewPendingEvaluationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id') || 'REP-0005';

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    async function fetchReportDetail() {
      setLoading(true);
      try {
        const response = await fetch(`/api/reports/detail?id=${reportId}`);
        if (!response.ok) throw new Error('Lỗi tải dữ liệu');
        const data = await response.json();
        if (data) setReport(data);
        else setReport(getMockDetail());
      } catch (error) {
        setReport(getMockDetail());
      } finally {
        setLoading(false);
      }
    }
    fetchReportDetail();
  }, [reportId]);

  function getMockDetail() {
    return {
      report_id: reportId,
      status: 'New',
      incident_type_id: 'Unsafe Condition',
      location: 'Khu đường ống',
      description: 'Phát hiện có mùi khí lạ gần van số 03.',
      image_url: '/pipe-incident.JPEG',
      created_at: '12/04/2026',
      created_by: 'Nguyen Van A'
    };
  }

  const handleAction = async (actionType: 'Approved' | 'Rejected' | 'RequestInfo') => {
    try {
      await fetch(`/api/risks/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, action: actionType, note: note })
      });
      alert(`Đã thực hiện: ${statusStyleConfig[actionType]?.label}`);
      router.push('/risks/pending-evaluations');
    } catch (error) {
      router.push('/risks/pending-evaluations');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải...</div>;
  const badge = statusStyleConfig[report?.status] || { label: report?.status, text: '#000', bg: '#FFF', border: '#FFF' };

  return (
    <main className='main-content'>
      
      {/* TOPBAR HEADER */}
      <header className='topbar'>
        <div className='bell'>🔔<span className='notice-number'>1</span></div>
        <div className='user-profile'>
          <div className='avatar-box'><img src="/avatar-pink.JPEG" alt="avatar" className='avatar-img'/></div>
          <div className='user-info'>
            <div className='user-name'>Họ và tên</div>
            <div className='user-role'>Vị trí</div>
          </div>
        </div>
      </header>

      {/* THANH SECOND-BAR THEO CHUẨN CLASS CỦA DỰ ÁN */}
      <div className='second-bar'>
          <h2 className='second-bar-content' style={{ fontWeight: 'bold', color: '#000000', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => router.push('/risks/pending-evaluations')}
              style={{ 
                background: 'none', 
                border: 'none', 
                fontSize: '20px', 
                cursor: 'pointer', 
                color: '#000000', 
                fontWeight: 'bold',
                padding: '0',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              ←
            </button>
            Báo cáo chi tiết
          </h2>
      </div>

      {/* KHU VỰC BỐ CỤC CHÍNH BÊN DƯỚI */}
      <div className='report-content' style={{ 
        display: 'grid', 
        gridTemplateColumns: '1.2fr 1fr', 
        gap: '24px', 
        alignItems: 'start',
        marginTop: '24px'
      }}>
        
        {/* CỘT TRÁI: THÔNG TIN BÁO CÁO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ color: '#004085', borderBottom: '2px solid #E2E8F0', paddingBottom: '10px', marginTop: 0, fontSize: '15px', fontWeight: '700' }}>THÔNG TIN BÁO CÁO</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '18px', paddingTop: '14px', fontSize: '14px', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold' }}>Mã báo cáo</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: '700', fontSize: '16px' }}>{report?.report_id}</span>
                <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: badge.text, backgroundColor: badge.bg, border: `1px solid ${badge.border}` }}>{badge.label}</span>
              </div>
              <span style={{ fontWeight: 'bold' }}>Loại sự cố</span><span>{report?.incident_type_id}</span>
              <span style={{ fontWeight: 'bold' }}>Địa điểm</span><span>{report?.location}</span>
              <span style={{ fontWeight: 'bold', alignSelf: 'start' }}>Mô tả sự cố</span><span style={{ lineHeight: '1.5' }}>{report?.description}</span>
              <span style={{ fontWeight: 'bold', alignSelf: 'start' }}>Ảnh hiện trường</span>
              <div>
                <img src={report?.image_url} alt="Hiện trường" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/120x120?text=No+Image' }} style={{ width: '120px', height: '120px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #CBD5E1' }} />
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ color: '#004085', borderBottom: '2px solid #E2E8F0', paddingBottom: '10px', marginTop: 0, fontSize: '15px', fontWeight: '700' }}>THÔNG TIN KHÁC</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '12px', paddingTop: '14px', fontSize: '14px' }}>
              <span style={{ fontWeight: 'bold' }}>Ngày tạo:</span><span>{report?.created_at}</span>
              <span style={{ fontWeight: 'bold' }}>Người tạo:</span><span>{report?.created_by}</span>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: ĐÁNH GIÁ NỘI DUNG */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '28px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#004085', marginTop: 0, fontSize: '16px', fontWeight: '700' }}>ĐÁNH GIÁ NỘI DUNG BÁO CÁO</h3>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '-4px', marginBottom: '24px' }}>Xem xét thông tin và đưa ra quyết định</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button onClick={() => handleAction('Approved')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer' }}>
              <span style={{ fontSize: '22px', color: '#27AE60' }}>✔️</span><span style={{ fontSize: '15px', fontWeight: '700' }}>Phê duyệt báo cáo</span>
            </button>
            <button onClick={() => handleAction('Rejected')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer' }}>
              <span style={{ fontSize: '22px', color: '#EB5757' }}>❌</span><span style={{ fontSize: '15px', fontWeight: '700' }}>Từ chối báo cáo</span>
            </button>
            <button onClick={() => handleAction('RequestInfo')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer' }}>
              <span style={{ fontSize: '22px', color: '#BB6BD9' }}>📝</span><span style={{ fontSize: '15px', fontWeight: '700' }}>Yêu cầu bổ sung</span>
            </button>
          </div>

          <div style={{ marginTop: '28px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Ghi chú <span style={{ fontWeight: 'normal', color: '#64748B' }}>(không bắt buộc)</span></label>
            <textarea placeholder="Nhập nội dung cần thiết" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', height: '100px', padding: '12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13.5px', outline: 'none', resize: 'none', boxSizing: 'border-box', backgroundColor: '#FAFAFA' }} />
          </div>
        </div>

      </div>
    </main>
  );
}

export default function ViewPendingEvaluationPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Đang khởi tạo...</div>}>
      <ViewPendingEvaluationContent />
    </Suspense>
  );
}