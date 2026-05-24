'use client'
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import '@/app/layout-styles.css';

// Cấu hình nhãn trạng thái với viền và nền màu vàng nhạt chuẩn theo hình mẫu (Mới)
const statusStyleConfig: Record<string, { label: string; text: string; bg: string; border: string }> = {
  New: { label: 'Mới', text: '#B29300', bg: '#FFFDE6', border: '#E8DB8D' },
  RequestInfo: { label: 'Yêu cầu bổ sung', text: '#B02BB8', bg: '#F9E6FA', border: '#F3B3F5' },
  Approved: { label: 'Đã phê duyệt', text: '#2F80ED', bg: '#EBF3FF', border: '#B3D4FF' },
  Rejected: { label: 'Đã hủy', text: '#F2994A', bg: '#FFF0E6', border: '#FFD1B3' },
  Closed: { label: 'Đã đóng', text: '#27AE60', bg: '#E6F9ED', border: '#B3F5CC' },
};

const incidentTypeLabels: Record<string, string> = {
  UC: 'Unsafe Condition',
  UA: 'Unsafe Act',
  NM: 'Near Miss',
};

function ReportDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) return;

    async function fetchDetail() {
      try {
        setLoading(true);
        // Link API chuẩn (đã sửa lỗi details thừa chữ s)
        const res = await fetch(`/api/reports/detail?id=${reportId}`);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Lỗi hệ thống mã: ${res.status}`);
        }
        
        const data = await res.json();
        setReportData(data);
      } catch (error: any) {
        console.error("Lỗi đồng bộ dữ liệu xem chi tiết:", error.message);
        alert(`Không thể tải dữ liệu: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [reportId]);

  // Định dạng hiển thị ngày chỉ lấy Date (DD/MM/YYYY) giống hệt ảnh mẫu 12/04/2026
  const formatDateOnly = (dateString: string) => {
    if (!dateString) return '---';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString;
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>Đang kết nối cơ sở dữ liệu Supabase...</div>;
  }

  if (!reportData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#EF4444', marginBottom: '16px', fontSize: '14px' }}>Không tìm thấy dữ liệu báo cáo sự cố hợp lệ!</p>
        <button onClick={() => router.push('/reports/my-reports')} style={{ color: '#4460A0', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', fontSize: '14px' }}>Quay lại danh sách</button>
      </div>
    );
  }

  const badge = statusStyleConfig[reportData.status] || { label: reportData.status, text: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
  const isEditable = reportData.status === 'New' || reportData.status === 'RequestInfo';

  // --- HỆ THỐNG INLINE STYLES ĐỒNG BỘ 100% THEO HÌNH ---
  const containerStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    border: '1px solid #CBD5E1',
    marginBottom: '20px',
    width: '100%',
    boxSizing: 'border-box' as const
  };

  const headerStyle = {
    padding: '12px 20px',
    fontSize: '15px',
    fontWeight: 'bold' as const,
    color: '#000000',
    borderBottom: '1px solid #CBD5E1',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  };

  const rowStyle = {
    display: 'flex',
    padding: '10px 20px',
    fontSize: '14px',
    alignItems: 'flex-start'
  };

  const labelStyle = {
    width: '160px',
    color: '#000000',
    fontWeight: '500' as const,
    flexShrink: 0
  };

  const valueStyle = {
    color: '#333333',
    paddingLeft: '10px'
  };

  const buttonStyle = {
    color: 'white',
    border: 'none',
    padding: '10px 28px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  };

  return (
    <main className='main-content'>
        <header className='topbar'>
          <div className='bell'>
            🔔<span className='notice-number'>1</span>
          </div>
          <div className='user-profile'>
            <div className='avatar-box'>
              <img src="/avatar-pink.JPEG" alt="avatar" className='avatar-img'/>
            </div>
            <div className='user-info'>
              <div className='user-name'>Họ và tên</div>
              <div className='user-role'>Vị trí</div>
            </div>
          </div>
        </header>

        <div className='second-bar' style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px', padding: '16px 32px', height: 'auto', justifyContent: 'flex-start' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#1E293B', padding: '0', display: 'flex', alignItems: 'center' }}>←</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0F172A', lineHeight: '1.2' }}>Báo cáo chi tiết</h2>
        </div>
      </div>

      {/* 3. KHU VỰC HIỂN THỊ CHI TIẾT NỘI DUNG FORM */}
      <div style={{ padding: '24px 32px' }}>
        
        {/* CARD 1: THÔNG TIN SỰ CỐ */}
        <div style={containerStyle}>
          <div style={headerStyle}>
            <span>Thông tin sự cố</span>
            <span style={{ 
              padding: '2px 14px', 
              borderRadius: '4px', 
              fontSize: '12px', 
              fontWeight: 'normal', 
              color: badge.text, 
              backgroundColor: badge.bg, 
              border: `1px solid ${badge.border}` 
            }}>
              {badge.label}
            </span>
          </div>
          
          <div style={{ padding: '8px 0' }}>
            <div style={rowStyle}>
              <div style={labelStyle}>Mã báo cáo</div>
              <div style={{ ...valueStyle, fontWeight: 'bold', color: '#000000' }}>{reportData.report_id}</div>
            </div>
            
            <div style={rowStyle}>
              <div style={labelStyle}>Loại sự cố</div>
              <div style={valueStyle}>{incidentTypeLabels[reportData.incident_type_id] || reportData.incident_type_id}</div>
            </div>
            
            <div style={rowStyle}>
              <div style={labelStyle}>Địa điểm xảy ra</div>
              <div style={valueStyle}>{reportData.location || '---'}</div>
            </div>
            
            <div style={rowStyle}>
              <div style={labelStyle}>Mô tả sự cố</div>
              <div style={valueStyle}>{reportData.short_description || reportData.long_description || '---'}</div>
            </div>
            
            <div style={rowStyle}>
              <div style={labelStyle}>Ảnh hiện trường</div>
              <div style={valueStyle}>
                <div style={{ 
                  width: '90px', 
                  height: '90px', 
                  borderRadius: '4px', 
                  overflow: 'hidden', 
                  border: '1px solid #CBD5E1',
                  marginTop: '2px'
                }}>
                  <img 
                    src={reportData.image_url || "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=400"} 
                    alt="Hiện trường" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD PHẢN HỒI NẾU CÓ (YÊU CẦU BỔ SUNG) */}
        {reportData.reviewer_feedback && (
          <div style={{ ...containerStyle, border: '1px solid #F3B3F5' }}>
            <div style={{ ...headerStyle, color: '#B02BB8', borderBottom: '1px solid #F3B3F5' }}>
              <span>Phản hồi từ người kiểm duyệt</span>
            </div>
            <div style={{ padding: '14px 20px', fontSize: '14px', color: '#333333' }}>
              {reportData.reviewer_feedback}
            </div>
          </div>
        )}

        {/* CARD 2: THÔNG TIN KHÁC (KHỚP 100% GIAO DIỆN MẪU) */}
        <div style={containerStyle}>
          <div style={headerStyle}>
            <span>Thông tin khác</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            <div style={rowStyle}>
              <div style={labelStyle}>Ngày tạo</div>
              <div style={valueStyle}>{formatDateOnly(reportData.created_at)}</div>
            </div>
            <div style={rowStyle}>
              <div style={labelStyle}>Người tạo</div>
              <div style={valueStyle}>{reportData.created_by_name || 'Nguyen Van A'}</div>
            </div>
          </div>
        </div>

        {/* KHỐI NÚT CHỨC NĂNG DƯỚI ĐÁY CARD CĂN PHẢI */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '24px' }}>
          {isEditable && (
            <button 
              onClick={() => router.push(`/reports/my-reports/edit-report?id=${reportData.report_id}`)}
              style={{ ...buttonStyle, backgroundColor: '#4460A0' }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#344b82')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4460A0')}
            >
              Chỉnh sửa
            </button>
          )}
          
          <button 
            onClick={() => router.push('/reports/my-reports')}
            style={{ ...buttonStyle, backgroundColor: '#4460A0' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#344b82')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4460A0')}
          >
            Quay về danh sách
          </button>
        </div>

      </div>
    </main>
  );
}

export default function ReportDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Đang chuẩn bị giao diện...</div>}>
      <ReportDetailContent />
    </Suspense>
  );
}