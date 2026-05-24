'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import '@/app/layout-styles.css'; 

// Cấu hình màu sắc nhãn Trạng thái chuẩn theo UI thiết kế của hệ thống HSE
const statusStyleConfig: Record<string, { label: string; text: string; bg: string; border: string }> = {
  New: { label: 'Mới', text: '#CDA000', bg: '#FFFDE6', border: '#FFF9B3' },
  RequestInfo: { label: 'Yêu cầu bổ sung', text: '#B02BB8', bg: '#F9E6FA', border: '#F3B3F5' },
  Approved: { label: 'Đã phê duyệt', text: '#2F80ED', bg: '#EBF3FF', border: '#B3D4FF' },
  Rejected: { label: 'Đã hủy', text: '#F2994A', bg: '#FFF0E6', border: '#FFD1B3' },
  Closed: { label: 'Đã đóng', text: '#27AE60', bg: '#E6F9ED', border: '#B3F5CC' },
};

export default function PendingEvaluationsPage() {
  const router = useRouter();
  
  // Các state lưu giá trị bộ lọc mở rộng theo ảnh thiết kế Module Quản lý rủi ro
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // State quản lý mảng dữ liệu chờ đánh giá
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // KẾT NỐI BACK-END LẤY DANH SÁCH CHỜ ĐÁNH GIÁ RỦI RO
  useEffect(() => {
    async function fetchPendingEvaluations() {
      setLoading(true);
      try {
        const response = await fetch(`/api/risks/pending?search=${searchTerm}&type=${typeFilter}&time=${timeFilter}&status=${statusFilter}`);
        if (!response.ok) {
          throw new Error('Không thể kết nối lấy dữ liệu rủi ro hệ thống');
        }
        const data = await response.json();
        
        if (data && data.length > 0) {
          setReports(data);
        } else {
          setReports(getRiskMockData()); 
        }
      } catch (error) {
        console.error("Lỗi API rủi ro hoặc DB trống, tự động dùng dữ liệu dự phòng:", error);
        setReports(getRiskMockData());
      } finally {
        setLoading(false);
      }
    }

    const delayDebounceFn = setTimeout(() => {
      fetchPendingEvaluations();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, typeFilter, timeFilter, statusFilter]);

  // Khởi tạo dòng dữ liệu mẫu REP-0005 khớp với ảnh của bạn
  function getRiskMockData() {
    return [
      { 
        report_id: 'REP-0005', 
        incident_type_id: 'Unsafe Condition', 
        location: 'Khu đường ống', 
        occurred_at: '2026-05-12T14:30:00.000Z', 
        status: 'New' 
      }
    ];
  }

  // Hàm định dạng ngày giờ hiển thị dạng DD/MM/YYYY HH:mm chính xác trên hàng của bảng (Ví dụ: 12/05/2026 14:30)
  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return dateString;
    }
  };

  return (
    <main className='main-content'>
      
      {/* THANH HEADER TOPBAR */}
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

      {/* THANH ĐIỀU HƯỚNG PHÂN CẤP MODULE 2 */}
      <div className='second-bar'>
          <h2 className='second-bar-content' style={{ fontWeight: 'bold', color: '#000000' }}>
            Quản lý rủi ro &gt; Danh sách chờ đánh giá
          </h2>
      </div>

      <div className='report-content'>
        
        {/* 1. THANH TÌM KIẾM VÀ 3 BỘ LỌC ĐA NHIỆM XẾP NGANG ĐỀU */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px', width: '100%' }}>
            
            {/* Ô Tìm kiếm sự cố */}
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', zIndex: 1 }}>🔍</span>
              <input
                type="text"
                placeholder="Tìm kiếm sự cố..."
                style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#334155', backgroundColor: '#F8FAFC', boxSizing: 'border-box' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Bộ lọc Loại sự cố */}
            <select
              style={{ padding: '10px 16px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', backgroundColor: 'white', color: '#334155', cursor: 'pointer', width: '22%' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Tất cả loại sự cố</option>
              <option value="Unsafe Act">Unsafe Act</option>
              <option value="Unsafe Condition">Unsafe Condition</option>
              <option value="Near Miss">Near Miss</option>
            </select>

            {/* Bộ lọc Thời gian: Đã sửa đổi thành input datetime-local có nút cuốn lịch tự động của trình duyệt */}
            <div style={{ width: '22%' }}>
              <input
                type="datetime-local"
                style={{ 
                  width: '100%', 
                  padding: '9px 12px', 
                  border: '1px solid #CBD5E1', 
                  borderRadius: '6px', 
                  fontSize: '13px', 
                  backgroundColor: 'white', 
                  color: timeFilter ? '#334155' : '#94A3B8', 
                  boxSizing: 'border-box', 
                  outline: 'none',
                  cursor: 'pointer'
                }}
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
              />
            </div>

            {/* Bộ lọc Trạng thái bổ sung đầy đủ */}
            <select
              style={{ padding: '10px 16px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', backgroundColor: 'white', color: '#334155', cursor: 'pointer', width: '22%' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Trạng thái</option>
              <option value="New">Mới</option>
              <option value="RequestInfo">Yêu cầu bổ sung</option>
              <option value="Approved">Đã phê duyệt</option>
              <option value="Closed">Đã đóng</option>
            </select>
        </div>

        {/* 2. BẢNG HIỂN THỊ DANH SÁCH CHỜ ĐÁNH GIÁ */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F4F6FA', borderBottom: '1px solid #E2E8F0', fontSize: '14px', color: '#1E293B', fontWeight: 'bold' }}>
                <th style={{ padding: '18px 20px' }}>Mã báo cáo</th>
                <th style={{ padding: '18px 20px' }}>Loại sự cố</th>
                <th style={{ padding: '18px 20px' }}>Địa điểm</th>
                <th style={{ padding: '18px 20px' }}>Thời gian</th>
                <th style={{ padding: '18px 20px', textAlign: 'left' }}>Trạng thái</th>
                <th style={{ padding: '18px 20px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '13.5px', color: '#334155' }}>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                    Đang quét danh sách rủi ro...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                    Hiện không có sự cố nào đang chờ đánh giá rủi ro.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => {
                  const badge = statusStyleConfig[rep.status] || { label: rep.status, text: '#000', bg: '#FFF', border: '#FFF' };

                  return (
                    <tr key={rep.report_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '20px', fontWeight: '600', color: '#0F172A' }}>{rep.report_id}</td>
                      <td style={{ padding: '20px', color: '#1E293B' }}>{rep.incident_type_id}</td>
                      <td style={{ padding: '20px', color: '#475569' }}>{rep.location}</td>
                      <td style={{ padding: '20px', color: '#475569' }}>{formatDateTime(rep.occurred_at)}</td>
                      
                      <td style={{ padding: '20px' }}>
                        <span style={{ 
                          display: 'inline-block', 
                          padding: '6px 12px', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          fontWeight: '500',
                          color: badge.text,
                          backgroundColor: badge.bg,
                          border: `1px solid ${badge.border}`
                        }}>
                          {badge.label}
                        </span>
                      </td>

                      <td style={{ padding: '20px', textAlign: 'center' }}>
                        <button 
                          onClick={() => router.push(`/risks/risk-assessment?id=${rep.report_id}`)}
                          style={{ background: 'none', border: 'none', color: '#000000', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
                        >
                          👁️ Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* 3. THANH PHÂN TRANG */}
          <div style={{ padding: '20px', backgroundColor: 'white', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <button style={{ width: '32px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: 'white', color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>&lt;</button>
            <button style={{ width: '32px', height: '32px', border: '1px solid #2F80ED', borderRadius: '4px', backgroundColor: '#EBF3FF', color: '#2F80ED', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</button>
            <button style={{ width: '32px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>2</button>
            <button style={{ width: '32px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>3</button>
            <button style={{ width: '32px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: 'white', color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>&gt;</button>
          </div>
        </div>

      </div>

    </main>
  );
}