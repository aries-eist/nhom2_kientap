'use client'
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; 
import { createClient } from '@/utils/supabase/client'; 
import '@/app/layout-styles.css'; 

interface UserProfile {
  full_name: string;
  department: string;
}

const statusStyleConfig: Record<string, { label: string; text: string; bg: string; border: string }> = {
  New: { label: 'Mới', text: '#CDA000', bg: '#FFFDE6', border: '#FFF9B3' },
  RequestInfo: { label: 'Yêu cầu bổ sung', text: '#B02BB8', bg: '#F9E6FA', border: '#F3B3F5' },
  Approved: { label: 'Đã phê duyệt', text: '#2F80ED', bg: '#EBF3FF', border: '#B3D4FF' },
  Rejected: { label: 'Đã hủy', text: '#F2994A', bg: '#FFF0E6', border: '#FFD1B3' },
  Closed: { label: 'Đã đóng', text: '#27AE60', bg: '#E6F9ED', border: '#B3F5CC' },
};

export default function MyReportsNormalPage() {
  const router = useRouter(); 
  const supabase = createClient(); 

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // State quản lý Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const pageSize = 20;

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Thông tin User thực tế trên Topbar
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // 🔔 CÁC STATE BỔ SUNG CHO CHUÔNG THÔNG BÁO
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  // Click ra ngoài chuông thì tự động đóng menu thông báo lại
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Khi người dùng thay đổi bộ lọc tìm kiếm hoặc trạng thái, tự động reset về trang 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // 🔄 Load thông tin tài khoản đăng nhập phục vụ Topbar và Chuông
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        setLoadingProfile(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);

          // Thực hiện tìm kiếm thông tin cá nhân trong bảng PROFILES
          let { data: profileData } = await supabase
            .from('PROFILES')
            .select('full_name, department')
            .eq('profile_id', user.id) 
            .maybeSingle();

          if (!profileData) {
            const { data: fallbackData } = await supabase
              .from('PROFILES')
              .select('full_name, department')
              .eq('id', user.id)
              .maybeSingle();
            if (fallbackData) profileData = fallbackData;
          }

          if (profileData) {
            setProfile(profileData);
          }
        }
      } catch (err) {
        console.error('Lỗi khi lấy thông tin profile người dùng:', err);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchUserProfile();
  }, []);

  // 🔔 FETCH + REALTIME THÔNG BÁO CHO USER ĐANG ĐĂNG NHẬP
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

    // Kênh realtime tự nhẩy số chuông khi có thông báo đổ về database
    const channel = supabase
      .channel('realtime-notifications')
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

  // 🔄 FETCH BÁO CÁO (Đã gài lọc theo user.id đang đăng nhập)
  useEffect(() => {
    // Chỉ kích hoạt gọi API khi đã xác định được ID của user đang đăng nhập
    if (!currentUserId) return;

    async function fetchReportsFromSupabase() {
      setLoading(true);
      try {
        // 🛠️ ĐÃ SỬA: Gửi kèm param userId=${currentUserId} để API chỉ trả về báo cáo của chính họ
        const response = await fetch(`/api/reports?search=${searchTerm}&status=${statusFilter}&page=${currentPage}&userId=${currentUserId}`);
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
  }, [searchTerm, statusFilter, currentPage, currentUserId]);

  // Hàm click vào dòng để đọc thông báo
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
    // Điều hướng trang xử lý dựa vào trường link_url lưu trong DB
    if (linkUrl) {
      router.push(linkUrl);
      setIsNotiOpen(false);
    }
  };

  // Hàm Đánh dấu đọc tất cả
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
      <main className='main-content' style={{ boxSizing: 'border-box' }}>
        <header className='topbar'>
          
          {/* CỤM CHUÔNG THÔNG BÁO ĐỘNG */}
          <div className='bell' ref={notiRef} style={{ position: 'relative', cursor: 'pointer', userSelect: 'none' }}>
            <span onClick={() => setIsNotiOpen(!isNotiOpen)} style={{ fontSize: '20px' }}>🔔</span>
            {unreadCount > 0 && (
              <span className='notice-number' onClick={() => setIsNotiOpen(!isNotiOpen)}>
                {unreadCount}
              </span>
            )}

            {/* KHUNG DANH SÁCH THÔNG BÁO KHI BẤM CHUÔNG */}
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
                          backgroundColor: noti.is_read ? 'white' : '#F0F7FF', transition: 'background-color 0.2s'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: noti.is_read ? '600' : 'bold', fontSize: '13px', color: '#1E293B' }}>{noti.title}</div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{noti.content}</div>
                          <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>{formatDateTime(noti.created_at)}</div>
                        </div>
                        {/* CHẤM XANH CHƯA ĐỌC GIỐNG HỆT FILE HÌNH CỦA BÀ */}
                        {!noti.is_read && (
                          <div style={{ width: '8px', height: '8px', backgroundColor: '#2F80ED', borderRadius: '50%', marginTop: '5px', flexShrink: 0 }}></div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className='user-profile'>
            <div className='avatar-box'>
              <img src="/avatar-pink.JPEG" alt="avatar" className='avatar-img'/>
            </div>
            <div className='user-info' style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <div className='user-name' style={{ fontWeight: 'bold', fontSize: '13px', color: '#1E293B' }}>
                {loadingProfile ? 'Đang tải...' : (profile?.full_name || 'Chưa cập nhật')}
              </div>
              <div className='user-role' style={{ fontSize: '11px', color: '#64748B' }}>
                {loadingProfile ? '...' : (profile?.department || 'Chưa xếp phòng ban')}
              </div>
            </div>
          </div>
        </header>

        <div className='second-bar'>
            <h2 className='second-bar-content' style={{ fontWeight: 'bold', color: '#000000', fontSize: '16px', margin: 0 }}>
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
