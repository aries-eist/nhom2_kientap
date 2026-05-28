'use client'
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client'; 
import '@/app/layout-styles.css';

// Cấu hình nhãn trạng thái với viền và nền màu vàng nhạt chuẩn theo hình mẫu
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

interface UserProfile {
  full_name: string;
  department: string;
}

function ReportDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');
  const supabase = createClient();

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // State quản lý ID người dùng đăng nhập thực tế
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // State quản lý Profile cá nhân hiển thị trên thanh Topbar
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // 🔔 CÁC STATE BỔ SUNG CHO CHUÔNG THÔNG BÁO ĐỘNG
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  // Tự động đóng menu thông báo khi click ra ngoài vùng chuông
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // =========================================================================
  // HOOK 1: LẤY THÔNG TIN USER ĐĂNG NHẬP ĐỂ ĐỔ LÊN TOPBAR
  // =========================================================================
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        setLoadingProfile(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error("Không tìm thấy thông tin user đăng nhập:", userError);
          return;
        }

        setCurrentUserId(user.id);

        let { data: profileData, error: profileError } = await supabase
          .from('PROFILES')
          .select('full_name, department')
          .eq('profile_id', user.id) 
          .maybeSingle();

        if (profileError || !profileData) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('PROFILES')
            .select('full_name, department')
            .eq('id', user.id)
            .maybeSingle();
          
          if (!fallbackError && fallbackData) {
            profileData = fallbackData;
          }
        }

        if (profileData) {
          setProfile(profileData);
        }
      } catch (err) {
        console.error("Lỗi hệ thống khi lấy profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchUserProfile();
  }, []);

  // =========================================================================
  // 🔔 HOOK BỔ SUNG: FETCH + REALTIME THÔNG BÁO CHO USER ĐANG ĐĂNG NHẬP
  // =========================================================================
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
      .channel('realtime-notifications-detail-page')
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

  // =========================================================================
  // HOOK 2: LẤY CHI TIẾT BÁO CÁO SỰ CỐ
  // =========================================================================
  useEffect(() => {
    if (!reportId) return;

    async function fetchDetail() {
      try {
        setLoading(true);
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

  // Hàm bấm xem và đánh dấu đã đọc thông báo
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

  // Hàm đánh dấu đã đọc toàn bộ thông báo cùng lúc
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

  // Định dạng hiển thị ngày chỉ lấy Date (DD/MM/YYYY)
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

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('vi-VN', { hour12: false }).replace(',', '');
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

  // --- HỆ THỐNG INLINE STYLES ĐỒNG BỘ 100% ---
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
    <main className='main-content' style={{ boxSizing: 'border-box', backgroundColor: '#F0F4F8', minHeight: '100vh', position: 'relative' }}>
        
        {/* 1. THANH TOPBAR HEADER */}
        <header className='topbar'>
          
          {/* CỤM CHUÔNG THÔNG BÁO ĐỘNG KẾT NỐI REALTIME */}
          <div className='bell' ref={notiRef} style={{ position: 'relative', cursor: 'pointer', userSelect: 'none' }}>
            <span onClick={() => setIsNotiOpen(!isNotiOpen)} style={{ fontSize: '20px' }}>🔔</span>
            {unreadCount > 0 && (
              <span className='notice-number' onClick={() => setIsNotiOpen(!isNotiOpen)}>
                {unreadCount}
              </span>
            )}

            {/* POPUP DANH SÁCH THÔNG BÁO CHUẨN MOCKUP */}
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
                {loadingProfile ? 'Đang tải...' : (profile?.full_name || 'Chưa cập nhật tên')}
              </div>
              <div className='user-role' style={{ fontSize: '11px', color: '#64748B' }}>
                {loadingProfile ? '...' : (profile?.department || 'Chưa xếp phòng ban')}
              </div>
            </div>
          </div>
        </header>

        {/* 2. THANH SECONDBAR TIÊU ĐỀ TRANG */}
        <div className='second-bar' style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px', padding: '14px 32px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#1E293B', padding: '0', display: 'flex', alignItems: 'center' }}>←</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#000000', lineHeight: '1.2' }}>Báo cáo chi tiết</h2>
          </div>
        </div>

      {/* 3. KHU VỰC HIỂN THỊ CHI TIẾT NỘI DUNG FORM */}
      <div className='report-content' style={{ padding: '24px 32px' }}>
        
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
                  marginTop: '2px',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img 
                    src={reportData.image_url || "https://placehold.co/90x90/e2e8f0/64748b?text=No+Image"} 
                    alt="Hiện trường" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.src = "https://placehold.co/90x90/e2e8f0/64748b?text=Error+Image";
                    }}
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

        {/* CARD 2: THÔNG TIN KHÁC */}
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
            >
              Chỉnh sửa
            </button>
          )}
          
          <button 
            onClick={() => router.push('/reports/my-reports')}
            style={{ ...buttonStyle, backgroundColor: '#4460A0' }}
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


