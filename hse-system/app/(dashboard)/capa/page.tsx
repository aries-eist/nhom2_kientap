'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'; 
import { createClient } from '@/utils/supabase/client'; 
import '@/app/layout-styles.css'; 

// Cấu hình nhãn mức độ ưu tiên phẳng (Flat UI)
const priorityStyleConfig: Record<string, { label: string; text: string; bg: string }> = {
  Urgent: { label: 'Khẩn cấp', text: '#DC2626', bg: '#FEE2E2' },
  High: { label: 'Cao', text: '#EA580C', bg: '#FFEDD5' },       
  Medium: { label: 'Trung bình', text: '#D97706', bg: '#FEF3C7' },
  Low: { label: 'Thấp', text: '#10B981', bg: '#D1FAE5' },
};

// Từ điển hiển thị chuẩn tiếng Anh như Mockup yêu cầu
const incidentTypeLabels: Record<string, string> = {
  UC: 'Unsafe Condition',
  UA: 'Unsafe Act',
  NM: 'Near Miss',
};

interface UserProfile {
  full_name: string;
  department: string;
}

export default function CoordinatorCapaPage() {
  const router = useRouter(); 
  const supabase = createClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [incidentTypeFilter, setIncidentTypeFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(''); 

  const [currentPage, setCurrentPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const pageSize = 20;

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(1); 
  const notiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        setUnreadCount(data.filter(n => !n.is_read).length || 1);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel('realtime-notifications-coordinator')
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, incidentTypeFilter, selectedDate]);

  useEffect(() => {
    async function fetchAllReports() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/reports?search=${encodeURIComponent(searchTerm)}&status=Approved&incidentType=${incidentTypeFilter}&date=${selectedDate}&page=${currentPage}`
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
      fetchAllReports();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, incidentTypeFilter, selectedDate, currentPage]);

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
    if (!dateString) return '---';
    const date = new Date(dateString);
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  return (
    <main className='main-content' style={{ boxSizing: 'border-box', backgroundColor: '#F3F4F6', minHeight: '100vh', position: 'relative', fontFamily: 'sans-serif' }}>
      
      {/* 1. TOPBAR HEADER */}
      <header className='topbar' style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 40px', backgroundColor: 'white', borderBottom: '1px solid #E5E7EB', gap: '24px' }}>
        <div className='bell' ref={notiRef} style={{ position: 'relative', cursor: 'pointer', userSelect: 'none' }}>
          <span onClick={() => setIsNotiOpen(!isNotiOpen)} style={{ fontSize: '24px' }}>🔔</span>
          
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#EF4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</span>
          )}

          {isNotiOpen && (
            <div style={{
              position: 'absolute', right: '-10px', top: '35px', width: '320px', backgroundColor: 'white',
              border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              zIndex: 999, overflow: 'hidden', textAlign: 'left'
            }}>
              <div style={{ padding: '12px 16px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <span style={{ color: '#1E293B' }}>Thông báo</span>
                <span onClick={handleMarkAllAsRead} style={{ fontSize: '11px', color: '#4C6FC2', fontWeight: 'normal', cursor: 'pointer' }}>Đánh dấu đã đọc tất cả</span>
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className='user-profile' style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className='avatar-box' style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden' }}>
            <img src="/avatar-pink.JPEG" alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' }}/>
          </div>
          <div className='user-info' style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <div className='user-name' style={{ fontWeight: 'bold', fontSize: '14px', color: '#111827' }}>
              {loadingProfile ? 'Họ và tên' : (profile?.full_name || 'Họ và tên')}
            </div>
            <div className='user-role' style={{ fontSize: '11px', color: '#6B7280' }}>
              {loadingProfile ? '...' : (profile?.department || 'Vị trí')}
            </div>
          </div>
        </div>
      </header>

      {/* 2. SECONDBAR TIÊU ĐỀ */}
      <div className='second-bar' style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '24px 40px 0 40px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
            Quản lý CAPA &gt; Thêm nhiệm vụ
          </h2>
      </div>

      {/* 3. KHU VỰC BẢNG LỌC VÀ HIỂN THỊ */}
      <div className='report-content' style={{ padding: '24px 40px 40px 40px' }}>
        
        {/* THANH BỘ LỌC ĐA NĂNG */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '20px', gap: '16px', width: '100%' }}>
            
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

            <div style={{ position: 'relative', width: '180px' }}>
              <input
                type="date"
                style={{ width: '100%', padding: '11px 16px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', backgroundColor: 'white', color: '#334155', cursor: 'pointer', outline: 'none', fontWeight: '500', boxSizing: 'border-box' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
        </div>

        {/* BẢNG DỮ LIỆU */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: '14px', color: '#111827', fontWeight: 'bold' }}>
                <th style={{ padding: '16px 24px' }}>Mã báo cáo</th>
                <th style={{ padding: '16px 24px' }}>Loại sự cố</th>
                <th style={{ padding: '16px 24px' }}>Địa điểm</th>
                <th style={{ padding: '16px 24px' }}>Thời gian</th>
                <th style={{ padding: '16px 24px', textAlign: 'center' }}>Trạng thái</th>
                <th style={{ padding: '16px 24px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '13px', color: '#374151' }}>
              {loading && reports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#6B7280', fontStyle: 'italic' }}>
                    Đang tải danh sách sự cố...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF' }}>
                    Không tìm thấy dữ liệu báo cáo nào phù hợp.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => {
                  return (
                    <tr key={rep.report_id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '16px 24px', color: '#111827' }}>{rep.report_id}</td>
                      <td style={{ padding: '16px 24px' }}>{incidentTypeLabels[rep.incident_type_id] || rep.incident_type_id}</td>
                      <td style={{ padding: '16px 24px' }}>{rep.location}</td>
                      <td style={{ padding: '16px 24px' }}>{formatDateTime(rep.created_at)}</td>
                      
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <span style={{ 
                          display: 'inline-block', padding: '6px 12px', borderRadius: '4px', fontSize: '12px',
                          color: '#2563EB', backgroundColor: '#DBEAFE', border: '1px solid #BFDBFE'
                        }}>
                          {rep.status === 'Approved' ? 'Đã phê duyệt' : rep.status}
                        </span>
                      </td>

                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <button 
                          onClick={() => router.push(`/capa/add-task?reportId=${rep.report_id}`)}
                          style={{ 
                            backgroundColor: '#4C6FC2', color: '#FFFFFF', border: 'none', 
                            padding: '8px 16px', borderRadius: '6px', fontWeight: '600', 
                            fontSize: '12px', cursor: 'pointer'
                          }}
                        >
                          Thêm nhiệm vụ
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* PHÂN TRANG */}
          {totalPages > 1 && (
            <div style={{ padding: '14px 24px', backgroundColor: 'white', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '4px', alignItems: 'center' }}>
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: '4px', backgroundColor: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '12px' }}
              >
                &lt;
              </button>

              {pageNumbers.map((number) => (
                <button
                  key={number}
                  onClick={() => setCurrentPage(number)}
                  style={{ 
                    padding: '6px 12px', border: currentPage === number ? '1px solid #4C6FC2' : '1px solid #D1D5DB', 
                    borderRadius: '4px', backgroundColor: currentPage === number ? '#E0E7FF' : '#FFFFFF', color: currentPage === number ? '#4C6FC2' : '#374151', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' 
                  }}
                >
                  {number}
                </button>
              ))}

              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                style={{ padding: '6px 10px', border: '1px solid #D1D5DB', borderRadius: '4px', backgroundColor: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px' }}
              >
                &gt;
              </button>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}