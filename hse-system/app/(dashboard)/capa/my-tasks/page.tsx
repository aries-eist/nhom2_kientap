'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function MyTasksPage() {
  const router = useRouter();
  const supabase = createClient();

  // --- States Dữ liệu Nhiệm vụ ---
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // --- States Thông tin Cá nhân (Topbar) ---
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // --- States Thông báo (Notification) ---
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); 
  const [notifications, setNotifications] = useState<any[]>([]); 
  const notiRef = useRef<HTMLDivElement>(null);

  // --- States Bộ lọc & Phân trang ---
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; 

  // --- Xử lý đóng hộp thông báo khi click ra ngoài ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Fetch dữ liệu chính ---
  useEffect(() => {
    async function initData() {
      setLoading(true);
      setLoadingProfile(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUser(user);

        let { data: profileData } = await supabase
          .from('PROFILES')
          .select('full_name, department')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (!profileData) {
          const { data: fallbackProfile } = await supabase
            .from('PROFILES')
            .select('full_name, department')
            .eq('id', user.id)
            .maybeSingle();
          if (fallbackProfile) profileData = fallbackProfile;
        }
        setProfile(profileData);
        setLoadingProfile(false);

        const { data: notiData } = await supabase
          .from('NOTIFICATION')
          .select('*')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
        
        setNotifications(notiData || []);
        setUnreadCount(notiData ? notiData.filter(n => !n.is_read).length : 0);

        const { data: taskData, error } = await supabase
          .from('CAPA_TASK')
          .select(`
            *,
            PROFILES!CAPA_TASK_assignee_id_fkey (full_name) 
          `) 
          .order('created_at', { ascending: false });

        if (error) {
          const { data: fallbackData } = await supabase
            .from('CAPA_TASK')
            .select('*')
            .order('created_at', { ascending: false });
          if (fallbackData) setTasks(fallbackData);
        } else {
          setTasks(taskData || []);
        }
      } catch (err) {
        console.error("Lỗi fetch dữ liệu hệ thống:", err);
      } finally {
        setLoading(false);
        setLoadingProfile(false);
      }
    }
    initData();
  }, []);

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    try {
      await supabase
        .from('NOTIFICATION')
        .update({ is_read: true })
        .eq('profile_id', currentUser.id);
      
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Lỗi cập nhật thông báo:", err);
    }
  };

  // --- Logic Bộ Lọc ---
  const filteredTasks = tasks.filter(task => {
    const isMyTask = currentUser ? (task.assignee_id === currentUser.id || task.profile_id === currentUser.id) : true;
    const matchesPriority = priorityFilter === '' || task.priority === priorityFilter;
    const matchesStatus = statusFilter === '' || task.status === statusFilter;
    return isMyTask && matchesPriority && matchesStatus;
  });

  // --- Logic Phân Trang ---
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTasks.slice(indexOfFirstItem, indexOfLastItem);

  // --- Hàm map Style Màu sắc theo ảnh UI thực tế ---
  const getPriorityStyle = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'cao':
      case 'high':
        return { backgroundColor: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5' };
      case 'trung bình':
      case 'medium':
        return { backgroundColor: '#FEF08A', color: '#854D0E', border: '1px solid #FDE047' };
      default:
        return { backgroundColor: '#E0F2FE', color: '#0284C7', border: '1px solid #7DD3FC' };
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'chưa thực hiện':
      case 'not_started':
      case 'in_progress':
        return { backgroundColor: '#DCFCE7', color: '#16A34A', border: 'none' };
      case 'chờ nghiệm thu':
        return { backgroundColor: '#FEF3C7', color: '#D97706', border: 'none' };
      default:
        return { backgroundColor: '#E2E8F0', color: '#475569', border: 'none' };
    }
  };

  return (
    <main className='main-content' style={{ boxSizing: 'border-box', backgroundColor: '#F0F4F8', minHeight: '100vh', position: 'relative', padding: '0 40px 40px 40px', fontFamily: 'sans-serif' }}>
      
       {/* 1. THANH TOPBAR HEADER */}
       <header className='topbar' style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 0', backgroundColor: 'transparent', gap: '24px' }}>
          <div className='bell' ref={notiRef} style={{ position: 'relative', cursor: 'pointer', userSelect: 'none' }}>
            <span onClick={() => setIsNotiOpen(!isNotiOpen)} style={{ fontSize: '20px' }}>🔔</span>
            {unreadCount > 0 && (
              <span className='notice-number' onClick={() => setIsNotiOpen(!isNotiOpen)} style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#EF4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {unreadCount}
              </span>
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
                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {notifications.length > 0 ? (
                    notifications.map((noti, i) => (
                      <div key={noti.id || i} style={{ padding: '12px 16px', fontSize: '13px', borderBottom: '1px solid #F1F5F9', backgroundColor: noti.is_read ? 'transparent' : '#F0F7FF' }}>
                        <div style={{ fontWeight: noti.is_read ? 'normal' : '600', color: '#334155' }}>{noti.title || 'Nhiệm vụ mới được giao'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{noti.content || 'Bạn có một công việc CAPA mới cần xử lý.'}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', fontSize: '13px', color: '#64748B', textAlign: 'center' }}>
                      Không có thông báo mới nào
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className='user-profile' style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className='avatar-box' style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden' }}>
              <img src="/avatar-pink.JPEG" alt="avatar" className='avatar-img' style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' }}/>
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

      {/* KHUNG CONTAINER CONTAINER */}
      <div style={{ padding: '0 8px', boxSizing: 'border-box' }}>
        
        {/* 2. SECONDBAR TIÊU ĐỀ */}
        <div className='second-bar' style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0 32px 0' }}>
            <h2 className='second-bar-content' style={{ fontWeight: 'bold', color: '#1E293B', fontSize: '18px', margin: 0 }}>
              Quản lý CAPA <span style={{ color: '#64748B', fontWeight: 'normal', margin: '0 4px' }}>&gt;</span> Nhiệm vụ của tôi
            </h2>
        </div>

        {/* 3. THANH BỘ LỌC (FILTERS) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginBottom: '20px' }}>
          <select 
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', minWidth: '160px', outline: 'none', color: '#475569', fontSize: '14px' }}
          >
            <option value="">Mức độ ưu tiên</option>
            <option value="Cao">Cao</option>
            <option value="Trung bình">Trung bình</option>
            <option value="Thấp">Thấp</option>
          </select>

          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', minWidth: '160px', outline: 'none', color: '#475569', fontSize: '14px' }}
          >
            <option value="">Trạng thái</option>
            <option value="Chưa thực hiện">Chưa thực hiện</option>
            <option value="Đang xử lý">Đang xử lý</option>
            <option value="Chờ nghiệm thu">Chờ nghiệm thu</option>
            <option value="Hoàn thành">Hoàn thành</option>
          </select>
        </div>

        {/* 4. BẢNG DỮ LIỆU CHÍNH */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Đang tải danh sách nhiệm vụ...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '16px 8px', fontWeight: '600', color: '#0F172A', width: '60px' }}>#</th>
                  <th style={{ padding: '16px 12px', fontWeight: '600', color: '#0F172A', textAlign: 'left' }}>Tiêu đề công việc</th>
                  <th style={{ padding: '16px 12px', fontWeight: '600', color: '#0F172A' }}>Người được ủy quyền</th>
                  <th style={{ padding: '16px 12px', fontWeight: '600', color: '#0F172A' }}>Mức độ ưu tiên</th>
                  <th style={{ padding: '16px 12px', fontWeight: '600', color: '#0F172A' }}>Trạng thái</th>
                  <th style={{ padding: '16px 12px', fontWeight: '600', color: '#0F172A' }}>Ngày đến hạn</th>
                  <th style={{ padding: '16px 12px', fontWeight: '600', color: '#0F172A', width: '120px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((task, index) => (
                    <tr key={task.task_id || index} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '16px 8px', color: '#64748B' }}>{indexOfFirstItem + index + 1}</td>
                      <td style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '500', color: '#1E293B' }}>
                        {task.task_name || task.task_content || 'Kiểm tra thiết bị bồn chứa'}
                      </td>
                      <td style={{ padding: '16px 12px', color: '#334155' }}>
                        {task.PROFILES?.full_name || profile?.full_name || 'Người thực hiện'}
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', ...getPriorityStyle(task.priority || 'Trung bình') }}>
                          {task.priority || 'Trung bình'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', ...getStatusStyle(task.status || 'Chưa thực hiện') }}>
                          {task.status || 'Chưa thực hiện'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', color: '#334155' }}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : '18/05/2026'}
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <button 
                          onClick={() => router.push(`/capa/my-tview-my-task?id=${task.task_id || task.report_id}`)}
                          style={{ background: 'none', border: 'none', color: '#000000', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
                        >
                          <img src='/view.JPEG' width='14px' alt='view'></img> Xem
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '30px', color: '#64748B' }}>Không tìm thấy nhiệm vụ nào phù hợp.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* 5. KHỐI ĐIỀU HƯỚNG PHÂN TRANG (PAGINATION) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', marginTop: '20px' }}>
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#64748B' }}
          >
            &lt;
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              style={{ 
                width: '32px', 
                height: '32px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                border: '1px solid', 
                borderColor: currentPage === page ? '#4C6FC2' : '#CBD5E1', 
                borderRadius: '4px', 
                backgroundColor: currentPage === page ? '#FFF' : 'white', 
                color: currentPage === page ? '#4C6FC2' : '#1E293B', 
                fontWeight: currentPage === page ? 'bold' : 'normal',
                cursor: 'pointer' 
              }}
            >
              {page}
            </button>
          ))}

          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: '#64748B' }}
          >
            &gt;
          </button>
        </div>
      </div>

    </main>
  );
}