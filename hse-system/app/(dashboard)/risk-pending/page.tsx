'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'; 
import { createClient } from '@/utils/supabase/client'; 
import '@/app/layout-styles.css'; 

// Cấu hình nhãn trạng thái phẳng (Flat UI) đồng bộ hệ thống mới không dùng border viền cũ
const statusStyleConfig: Record<string, { label: string; text: string; bg: string }> = {
  New: { label: 'Mới', text: '#D97706', bg: '#FEF3C7' },
  RequestInfo: { label: 'Yêu cầu bổ sung', text: '#7C3AED', bg: '#F5F3FF' },
  Approved: { label: 'Đã phê duyệt', text: '#10B981', bg: '#D1FAE5' },
  Rejected: { label: 'Đã hủy', text: '#EA580C', bg: '#FFEDD5' },
  Closed: { label: 'Đã đóng', text: '#2563EB', bg: '#DBEAFE' },
};

// Từ điển dịch mã loại sự cố sang tiếng Anh chuẩn hóa
const incidentTypeLabels: Record<string, string> = {
  UC: 'Unsafe Condition',
  UA: 'Unsafe Act',
  NM: 'Near Miss',
};

interface UserProfile {
  full_name: string;
  department: string;
}

export default function ReviewerRiskPendingPage() {
  const router = useRouter(); 
  const supabase = createClient();
  
  // Các state bộ lọc theo giao diện Mockup nâng cấp
  const [searchTerm, setSearchTerm] = useState('');
  const [incidentTypeFilter, setIncidentTypeFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(''); // Chọn ngày cụ thể qua cuốn lịch
  const [statusFilter, setStatusFilter] = useState('');
  
  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const pageSize = 20;

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Profile Topbar
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Chuông thông báo
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  // Đóng menu thông báo khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Thông tin Profile người phê duyệt đổ lên Topbar
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        setLoadingProfile(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) return;
        setCurrentUserId(user.id);

        let { data: profileData, error: profileError } = await supabase
          .from('PROFILES')
          .select('full_name, department')
          .eq('profile_id', user.id) 
          .maybeSingle();

        if (profileError || !profileData) {
          const { data: fallbackData } = await supabase
            .from('PROFILES')
            .select('full_name, department')
            .eq('id', user.id)
            .maybeSingle();
          if (fallbackData) profileData = fallbackData;
        }

        if (profileData) setProfile(profileData);
      } catch (err) {
        console.error("Lỗi lấy thông tin profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchUserProfile();
  }, []);

  // Realtime thông báo hệ thống
  useEffect(() => {
    if (!currentUserId) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('NOTIFICATION')
        .select('*')
        .eq('receiver_id', currentUserId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel('realtime-notifications-reviewer')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'NOTIFICATION', filter: `receiver_id=eq.${currentUserId}` },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Reset về trang 1 khi thay đổi bất kỳ bộ lọc nào
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, incidentTypeFilter, selectedDate, statusFilter]);

  // Fetch danh sách toàn bộ các báo cáo cần phê duyệt
  useEffect(() => {
    async function fetchAllPendingReports() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/reports?search=${searchTerm}&status=${statusFilter}&incidentType=${incidentTypeFilter}&date=${selectedDate}&page=${currentPage}`
        );
        if (!response.ok) throw new Error('Lỗi không thể lấy dữ liệu từ Server');
        
        const data = await response.json();
        if (data && data.reports) {
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
      fetchAllPendingReports();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, statusFilter, incidentTypeFilter, selectedDate, currentPage]);

  const handleMarkAsRead = async (id: string, isRead: boolean, linkUrl: string) => {
    if (!isRead) {
      const { error } = await supabase
        .from('NOTIFICATION')
        .update({ is_read: true })
        .eq('notification_id', id);

      if (!error) {
        setNotifications(prev =>
          prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
    if (linkUrl) {
      router.push(linkUrl);
      setIsNotiOpen(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUserId || unreadCount === 0) return;
    const { error } = await supabase
      .from('NOTIFICATION')
      .update({ is_read: true })
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const totalPages = Math.ceil(totalReports / pageSize) || 1;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

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
    <main className='main-content' style={{ boxSizing: 'border-box', backgroundColor: '#F0F4F8', minHeight: '100vh', position: 'relative', fontFamily: 'sans-serif' }}>
      
      {/* 1. TOPBAR HEADER */}
      <header className='topbar' style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 40px', backgroundColor: 'white', borderBottom: '1px solid #E2E8F0', gap: '24px' }}>
        <div className='bell' ref={notiRef} style={{ position: 'relative', cursor: 'pointer', userSelect: 'none' }}>
          <span onClick={() => setIsNotiOpen(!isNotiOpen)} style={{ fontSize: '22px' }}>🔔</span>
          {unreadCount > 0 && (
            <span className='notice-number' style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#EF4444', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>{unreadCount}</span>
          )}

          {isNotiOpen && (
            <div style={{
              position: 'absolute', right: '-10px', top: '35px', width: '320px', backgroundColor: 'white',
              border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              zIndex: 999, overflow: 'hidden', textAlign: 'left'
            }}>
              <div style={{ padding: '12px 16px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <span style={{ color: '#1E293B' }}>Thông báo</span>
                <span onClick={handleMarkAllAsRead} style={{ fontSize: '11px', color: '#2F80ED', fontWeight: 'normal', cursor: 'pointer' }}>Đánh dấu đã đọc tất cả</span>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Không có thông báo nào</div>
                ) : (
                  notifications.map((noti) => (
                    <div
                      key={noti.notification_id}
                      onClick={() => handleMarkAsRead(noti.notification_id, noti.is_read, noti.link_url)}
                      style={{
                        padding: '12px 16px', borderBottom: '1px solid #F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', cursor: 'pointer',
                        backgroundColor: noti.is_read ? 'white' : '#F0F7FF'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: noti.is_read ? '600' : 'bold', fontSize: '13px', color: '#1E293B' }}>{noti.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{noti.content}</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>{formatDateTime(noti.created_at)}</div>
                      </div>
                      {!noti.is_read && <div style={{ width: '8px', height: '8px', backgroundColor: '#2F80ED', borderRadius: '50%', marginTop: '5px', flexShrink: 0 }}></div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className='user-profile' style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className='avatar-box' style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden' }}>
            <img src="/avatar-pink.JPEG" alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          </div>
          <div className='user-info' style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <div className='user-name' style={{ fontWeight: 'bold', fontSize: '14px', color: '#0F172A' }}>
              {loadingProfile ? 'Đang tải...' : (profile?.full_name || 'Người phê duyệt')}
            </div>
            <div className='user-role' style={{ fontSize: '11px', color: '#64748B' }}>
              {loadingProfile ? '...' : (profile?.department || 'Ban HSE')}
            </div>
          </div>
        </div>
      </header>

      {/* 2. SECONDBAR TIÊU ĐỀ FLAT UI */}
      <div className='second-bar' style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '24px 40px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#000000', letterSpacing: '-0.3px' }}>
            Quản lý rủi ro &gt; Phê duyệt báo cáo
          </h2>
      </div>

      {/* 3. KHU VỰC BẢNG LỌC VÀ HIỂN THỊ CHUẨN UI KHÔNG KHÍ THOÁNG */}
      <div className='report-content' style={{ padding: '32px 40px' }}>
        
        {/* THANH BỘ LỌC ĐA NĂNG NÂNG CẤP CUỐN LỊCH */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '24px', gap: '16px', width: '100%' }}>
            
            {/* Ô tìm kiếm mã sự cố */}
            <div style={{ position: 'relative', width: '260px' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '16px', zIndex: 1 }}>🔍</span>
              <input
                type="text"
                placeholder="Tìm kiếm sự cố..."
                style={{ width: '100%', padding: '12px 16px 12px 44px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', outline: 'none', color: '#334155', backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', boxSizing: 'border-box' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Dropdown 1: Loại sự cố */}
            <select
              style={{ padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', backgroundColor: 'white', color: '#334155', cursor: 'pointer', width: '180px', outline: 'none', fontWeight: '500' }}
              value={incidentTypeFilter}
              onChange={(e) => setIncidentTypeFilter(e.target.value)}
            >
              <option value="">Tất cả loại sự cố</option>
              <option value="UC">Unsafe Condition</option>
              <option value="UA">Unsafe Act</option>
              <option value="NM">Near Miss</option>
            </select>

            {/* 🔥 ĐÃ SỬA: Ô chọn ngày bằng Cuốn Lịch (input type="date") thay cho chọn khoảng ngày cũ */}
            <div style={{ position: 'relative', width: '180px' }}>
              <input
                type="date"
                style={{ 
                  width: '100%', padding: '11px 16px', border: '1px solid #E2E8F0', borderRadius: '10px', 
                  fontSize: '14px', backgroundColor: 'white', color: '#334155', cursor: 'pointer', 
                  outline: 'none', fontWeight: '500', boxSizing: 'border-box' 
                }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {/* Dropdown 3: Trạng thái phê duyệt */}
            <select
              style={{ padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', backgroundColor: 'white', color: '#334155', cursor: 'pointer', width: '180px', outline: 'none', fontWeight: '500' }}
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

            {/* Nút dọn bộ lọc ngày nhanh */}
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate('')}
                style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Xóa ngày lọc
              </button>
            )}
        </div>

        {/* BẢNG DỮ LIỆU ĐỔ THEO THIẾT KẾ FLAT UI ĐẬM ĐÀ */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #F1F5F9', fontSize: '14px', color: '#000000', fontWeight: '700' }}>
                <th style={{ padding: '20px 24px' }}>Mã báo cáo</th>
                <th style={{ padding: '20px 24px' }}>Loại sự cố</th>
                <th style={{ padding: '20px 24px' }}>Địa điểm</th>
                <th style={{ padding: '20px 24px' }}>Thời gian</th>
                <th style={{ padding: '20px 24px', textAlign: 'center' }}>Trạng thái</th>
                <th style={{ padding: '20px 24px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '14px', color: '#334155' }}>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                    Đang quét danh sách phê duyệt...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                    Hiện tại không có báo cáo nào khớp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => {
                  const badge = statusStyleConfig[rep.status] || { label: rep.status, text: '#000000', bg: '#F1F5F9' };

                  return (
                    <tr key={rep.report_id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '20px 24px', fontWeight: '600', color: '#0F172A' }}>{rep.report_id}</td>
                      <td style={{ padding: '20px 24px' }}>{incidentTypeLabels[rep.incident_type_id] || rep.incident_type_id}</td>
                      <td style={{ padding: '20px 24px', color: '#334155' }}>{rep.location}</td>
                      <td style={{ padding: '20px 24px', color: '#64748B' }}>{formatDateTime(rep.occurred_at)}</td>
                      
                      <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                        <span style={{ 
                          display: 'inline-block', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                          color: badge.text, backgroundColor: badge.bg
                        }}>
                          {badge.label}
                        </span>
                      </td>

                      <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                        <button 
                          onClick={() => router.push(`/risk-pending/view-pending-report?id=${rep.report_id}`)}
                          style={{ background: 'none', border: 'none', color: '#000000', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
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

          {/* ĐOẠN PHÂN TRANG */}
          <div style={{ padding: '20px 24px', backgroundColor: 'white', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center' }}>
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ width: '32px', height: '32px', border: '1px solid #E2E8F0', borderRadius: '6px', backgroundColor: 'white', color: '#334155', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                    width: '32px', height: '32px', border: isActive ? '1px solid #2F80ED' : '1px solid #E2E8F0', 
                    borderRadius: '6px', backgroundColor: isActive ? '#EBF3FF' : 'white', color: isActive ? '#2F80ED' : '#334155', cursor: 'pointer', fontWeight: 'bold' 
                  }}
                >
                  {number}
                </button>
              );
            })}

            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ width: '32px', height: '32px', border: '1px solid #E2E8F0', borderRadius: '6px', backgroundColor: 'white', color: '#334155', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              &gt;
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}