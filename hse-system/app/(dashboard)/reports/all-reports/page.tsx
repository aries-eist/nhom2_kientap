'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; 
import '@/app/layout-styles.css'; 

const statusStyleConfig: Record<string, { label: string; text: string; bg: string; border: string }> = {
  New: { label: 'Mới', text: '#CDA000', bg: '#FFFDE6', border: '#FFF9B3' },
  RequestInfo: { label: 'Yêu cầu bổ sung', text: '#B02BB8', bg: '#F9E6FA', border: '#F3B3F5' },
  Approved: { label: 'Đã phê duyệt', text: '#2F80ED', bg: '#EBF3FF', border: '#B3D4FF' },
  Rejected: { label: 'Đã hủy', text: '#F2994A', bg: '#FFF0E6', border: '#FFD1B3' },
  Closed: { label: 'Đã đóng', text: '#27AE60', bg: '#E6F9ED', border: '#B3F5CC' },
};

export default function MyReportsNormalPage() {
  const router = useRouter(); 
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // State quản lý Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const pageSize = 20;

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Khi người dùng thay đổi bộ lọc tìm kiếm hoặc trạng thái, tự động reset về trang 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    async function fetchReportsFromSupabase() {
      setLoading(true);
      try {
        const response = await fetch(`/api/reports?search=${searchTerm}&status=${statusFilter}&page=${currentPage}`);
        if (!response.ok) {
          throw new Error('Lỗi không thể lấy dữ liệu từ Server');
        }
        const data = await response.json();
        
        if (data && data.reports && data.reports.length > 0) {
          setReports(data.reports);
          setTotalReports(data.totalCount); 
        } else {
          setReports([]);
          setTotalReports(0);
        }
      } catch (error) {
        console.error("Lỗi kết nối API:", error);
        setReports([]);
        setTotalReports(0);
      } finally {
        setLoading(false);
      }
    }

    const delayDebounceFn = setTimeout(() => {
      fetchReportsFromSupabase();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, statusFilter, currentPage]);

  const totalPages = Math.ceil(totalReports / pageSize) || 1;

  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('vi-VN', { hour12: false }).replace(',', '');
    } catch (e) {
      return dateString;
    }
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

        <div className='second-bar'>
            <h2 className='second-bar-content' style={{ fontWeight: 'bold', color: '#000000', fontSize: '16px' }}>
              Quản lý sự cố &gt; Báo cáo của tôi
            </h2>
        </div>

        <div className='report-content' style={{ padding: '24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', width: '100%' }}>
              <div style={{ position: 'relative', width: '40%' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', zIndex: 1 }}>🔍</span>
                <input
                  type="text"
                  placeholder="Tìm kiếm mã báo cáo..."
                  style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', outline: 'none', color: '#334155', boxSizing: 'border-box' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                style={{ padding: '8px 16px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', backgroundColor: 'white', color: '#334155', cursor: 'pointer', width: '30%' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="New">Mới</option>
                <option value="RequestInfo">Yêu cầu bổ sung</option>
                <option value="Approved">Đã phê duyệt</option>
                <option value="Rejected">Đã hủy</option>
                <option value="Closed">Đã đóng</option>
              </select>

              <div>
                <Link href="/reports/my-reports/create-new-report" style={{ textDecoration: 'none' }}>
                  <button style={{ backgroundColor: '#648AF5', color: 'white', border: 'none', padding: '12px 28px', fontSize: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    Tạo báo cáo mới
                  </button>
                </Link>
              </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F4F6FA', borderBottom: '1px solid #E2E8F0', fontSize: '14px', color: '#1E293B', fontWeight: 'bold' }}>
                  <th style={{ padding: '18px 20px' }}>Mã báo cáo</th>
                  <th style={{ padding: '18px 20px' }}>Loại sự cố</th>
                  <th style={{ padding: '18px 20px' }}>Địa điểm</th>
                  <th style={{ padding: '18px 20px' }}>Thời gian</th>
                  <th style={{ padding: '18px 20px', textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ padding: '18px 20px', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '13.5px', color: '#334155' }}>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                      Đang tải dữ liệu từ Supabase...
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                      Không tìm thấy báo cáo nào khớp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  reports.map((rep) => {
                    const badge = statusStyleConfig[rep.status] || { label: rep.status, text: '#000', bg: '#FFF', border: '#FFF' };

                    return (
                      <tr key={rep.report_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '20px', fontWeight: 'bold', color: '#0F172A' }}>{rep.report_id}</td>
                        <td style={{ padding: '20px', fontWeight: '500' }}>{rep.incident_type_id}</td>
                        <td style={{ padding: '20px', color: '#475569' }}>{rep.location}</td>
                        <td style={{ padding: '20px', color: '#64748B' }}>{formatDateTime(rep.occurred_at)}</td>
                        
                        <td style={{ padding: '20px', textAlign: 'center' }}>
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

                        {/* CỘT THAO TÁC: CHỈ GIỮ LẠI NÚT XEM VỚI BIỂU TƯỢNG RÕ RÀNG */}
                        <td style={{ padding: '20px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <button 
                              onClick={() => router.push(`/reports/my-reports/view-report?id=${rep.report_id}`)}
                              style={{ background: 'none', border: 'none', color: '#334155', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <img src='/view.JPEG' width='10px' alt='view'></img> Xem
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* PHÂN TRANG */}
            <div style={{ padding: '20px', backgroundColor: 'white', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center' }}>
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                style={{ width: '32px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: 'white', color: currentPage === 1 ? '#CBD5E1' : '#334155', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                &lt;
              </button>

              {pageNumbers.map((number) => {
                const isActive = currentPage === number;
                return (
                  <button
                    key={number}
                    onClick={() => setCurrentPage(number)}
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      border: isActive ? '1px solid #2F80ED' : '1px solid #CBD5E1', 
                      borderRadius: '4px', 
                      backgroundColor: isActive ? '#EBF3FF' : 'white', 
                      color: isActive ? '#2F80ED' : '#334155', 
                      cursor: 'pointer', 
                      fontWeight: 'bold',
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center'
                    }}
                  >
                    {number}
                  </button>
                );
              })}

              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                style={{ width: '32px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: 'white', color: currentPage === totalPages ? '#CBD5E1' : '#334155', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                &gt;
              </button>
            </div>
          </div>

        </div>

      </main>
  );
}