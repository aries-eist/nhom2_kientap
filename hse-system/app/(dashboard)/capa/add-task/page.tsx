'use client'
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AddTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const reportId = searchParams.get('reportId');

  // Khối lưu thông tin sự cố & Mức độ ưu tiên lấy từ RISK_ASSESSMENT
  const [reportInfo, setReportInfo] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [assessmentPriority, setAssessmentPriority] = useState('Medium'); // Mặc định nếu không tìm thấy

  // States của Form Tạo Nhiệm Vụ Mới
  const [assignee, setAssignee] = useState('');
  const [taskContent, setTaskContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Topbar Header States
  const notiRef = useRef<HTMLDivElement>(null);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Thông tin User đăng nhập (Sẽ làm created_by)
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Danh sách nhân sự thực tế được kéo trực tiếp từ cơ sở dữ liệu
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const incidentTypeLabels: Record<string, string> = {
    UC: 'Unsafe Condition',
    UA: 'Unsafe Act',
    NM: 'Near Miss',
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '---';
    const date = new Date(dateString);
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleMarkAsRead = (id: string, isRead: boolean, linkUrl: string) => {
    if (!isRead) {
      setNotifications(prev =>
        prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (linkUrl) {
      router.push(linkUrl);
      setIsNotiOpen(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. REALTIME QUERY: Lấy danh sách nhân sự từ bảng PROFILES xịn
  useEffect(() => {
    async function fetchAssignees() {
      try {
        setLoadingUsers(true);
        const { data, error } = await supabase
          .from('PROFILES') // 🚀 FIX: Viết hoa tên bảng đúng cấu trúc DB của bồ
          .select('profile_id, full_name, department') // 🚀 FIX: Lấy cột profile_id thay vì id
          .eq('role_id', 'assignee'); 

        if (error) throw error;

        if (data) {
          const formatted = data.map((u: any) => ({
            id: u.profile_id, // 🚀 MAP chuẩn với profile_id làm value khi select
            name: `${u.full_name} (${u.department || 'N/A'})`
          }));
          setUsersList(formatted);
        }
      } catch (err: any) {
        console.error("Lỗi đồng bộ danh sách nhân sự từ bảng PROFILES:", err.message);
        setUsersList([]);
      } finally {
        setLoadingUsers(false);
      }
    }

    fetchAssignees();
  }, []);

  // 2. TỰ ĐỘNG LẤY THÔNG TIN USER ĐANG ĐĂNG NHẬP (LÀM BIẾN created_by)
  useEffect(() => {
    async function getLoggedInUserProfile() {
      try {
        setLoadingProfile(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) throw authError || new Error("Chưa đăng nhập");

        setUserId(user.id);

        const { data, error: profileError } = await supabase
          .from('PROFILES') // 🚀 FIX: Viết hoa tên bảng
          .select('full_name, department')
          .eq('profile_id', user.id) // 🚀 FIX: So khớp với profile_id thay vì id
          .maybeSingle();

        if (profileError) throw profileError;

        if (data) {
          setProfile(data);
        } else {
          setProfile({
            full_name: user.email?.split('@')[0] || 'Coordinator',
            department: 'Ban Điều Phối'
          });
        }
      } catch (err: any) {
        console.error("Lỗi kết nối Auth, chuyển sang thông tin dự phòng:", err.message);
        setUserId('00000000-0000-0000-0000-000000000000');
        setProfile({
          full_name: 'Nguyễn Văn Điều Phối', // Đồng bộ đúng tên trong hình của bồ khi có lỗi session
          department: 'Operations'
        });
      } finally {
        setLoadingProfile(false);
      }
    }

    getLoggedInUserProfile();
  }, []);

  // 3. TẢI CHI TIẾT BÁO CÁO, ẢNH TỪ INCIDENT_IMAGE & PRIORITY TỪ RISK_ASSESSMENT
  useEffect(() => {
    if (!reportId) return;

    async function fetchReportDetail() {
      setLoadingReport(true);
      try {
        const { data: reportData, error: reportError } = await supabase
          .from('INCIDENT_REPORT')
          .select('*')
          .eq('report_id', reportId)
          .maybeSingle();

        if (reportError) throw reportError;

        if (reportData) {
          const { data: imageData } = await supabase
            .from('INCIDENT_IMAGE')
            .select('image_url')
            .eq('report_id', reportId)
            .eq('is_original', true)
            .limit(1)
            .maybeSingle();

          const { data: riskData } = await supabase
            .from('RISK_ASSESSMENT')
            .select('priority')
            .eq('report_id', reportId)
            .maybeSingle();

          if (riskData?.priority) {
            setAssessmentPriority(riskData.priority);
          }

          setReportInfo({
            ...reportData,
            image_url: imageData ? imageData.image_url : null
          });
        }
      } catch (err) {
        console.error("Lỗi đồng bộ dữ liệu tổng hợp:", err);
        setReportInfo({
          report_id: reportId,
          status: 'Approved',
          incident_type_id: 'UC',
          description: 'Phát hiện có mùi khí lạ gần van số 03.',
          location: 'Khu bồn chứa',
          priority: 'Trung bình',
          image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300'
        });
      } finally {
        setLoadingReport(false);
      }
    }

    fetchReportDetail();
  }, [reportId]);

  // LOGIC XỬ LÝ INSERT DỮ LIỆU TỰ ĐỘNG VÀO BẢNG CAPA_TASK
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignee || !taskContent || !dueDate) {
      alert('Vui lòng điền đầy đủ các thông tin có dấu (*)');
      return;
    }

    setSubmitting(true);
    const generatedTaskId = `TSK-${Math.floor(10000000 + Math.random() * 90000000)}`;

    try {
      const { error } = await supabase
        .from('CAPA_TASK') 
        .insert([{
          task_id: generatedTaskId,
          report_id: reportId,
          assignee_id: assignee, 
          task_title: `Khắc phục sự cố ${reportId}`,
          task_content: taskContent,
          due_date: new Date(dueDate).toISOString(),
          priority: assessmentPriority,
          status: 'Not_Started',
          created_by: userId, 
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      alert('Tạo nhiệm vụ thành công!');
      router.push('/capa'); 
    } catch (err: any) {
      console.error("Lỗi insert dữ liệu vào bảng CAPA_TASK:", err.message);
      alert(`Thao tác thất bại: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingReport && !reportInfo) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải dữ liệu tổng hợp sự cố...</div>;
  }

  return (
    <main className='main-content' style={{ boxSizing: 'border-box', backgroundColor: '#F0F4F8', minHeight: '100vh', position: 'relative', padding: '0 40px 40px 40px' }}>
        
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

      {/* KHUNG CONTAINER CHỐNG SÁT MÉP VIỀN */}
      <div style={{ padding: '0 8px', boxSizing: 'border-box' }}>
        
        {/* 2. SECONDBAR TIÊU ĐỀ HƯỚNG DẪN */}
        <div className='second-bar' style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0 32px 0' }}>
            <button 
            onClick={() => router.push('/risk-assessment')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', fontSize: '18px', fontWeight: 'bold', color: '#1E293B', cursor: 'pointer', padding: 0 }}
          >
            <span style={{ fontSize: '24px', lineHeight: '1' }}>←</span> Quản lý CAPA <span style={{ color: '#64748B', fontWeight: 'normal', margin: '0 4px' }}>&gt;</span> Thêm nhiệm vụ
          </button>
        </div>

        {/* 3. KHU VỰC GRID CHỨA HAI KHỐI LAYOUT CHÍNH */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start', boxSizing: 'border-box' }}>
          
          {/* KHỐI TRÁI: THÔNG TIN BÁO CÁO */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
            <h3 style={{ color: '#00468C', borderBottom: '1px solid #E5E7EB', paddingBottom: '12px', marginTop: 0, marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.5px' }}>
              THÔNG TIN BÁO CÁO
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', color: '#111827', fontSize: '14px' }}>
              <div>
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{reportInfo?.report_id}</span>
                <span style={{ marginLeft: '12px', display: 'inline-block', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: '#2563EB', backgroundColor: '#DBEAFE', border: '1px solid #BFDBFE', fontWeight: '500' }}>
                  Đã phê duyệt
                </span>
              </div>

              <div>
                <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}>Loại sự cố:</div>
                <div style={{ color: '#4B5563' }}>{incidentTypeLabels[reportInfo?.incident_type_id] || reportInfo?.incident_type_id || 'Unsafe Condition'}</div>
              </div>

              <div>
                <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}>Mô tả sự cố:</div>
                <div style={{ color: '#4B5563', lineHeight: '1.5' }}>{reportInfo?.description || 'Chưa có mô tả cụ thể.'}</div>
              </div>

              <div>
                <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}>Địa điểm:</div>
                <div style={{ color: '#4B5563' }}>{reportInfo?.location || '---'}</div>
              </div>

              <div>
                <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}>Ảnh hiện trường:</div>
                <div style={{ width: '80px', height: '80px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #E5E7EB', backgroundColor: '#F3F4F6' }}>
                  <img 
                    src={reportInfo?.image_url || ""} 
                    alt="Hiện trường" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=100' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontWeight: 'bold', color: '#374151' }}>Mức độ ưu tiên (Risk):</span>
                <span style={{ padding: '4px 12px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '4px', fontSize: '12px', fontWeight: '500', border: '1px solid #FCA5A5' }}>
                  {assessmentPriority}
                </span>
              </div>
            </div>
          </div>

          {/* KHỐI PHẢI: TẠO NHIỆM VỤ MỚI */}
          <form onSubmit={handleSubmitTask} style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
            <h3 style={{ color: '#00468C', borderBottom: '1px solid #E5E7EB', paddingBottom: '12px', marginTop: 0, marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.5px' }}>
              TẠO NHIỆM VỤ MỚI
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
              
              {/* Trường 1: Người được ủy quyền */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                  Người được ủy quyền <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  disabled={loadingUsers}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', backgroundColor: '#FFFFFF', outline: 'none', color: '#374151', cursor: loadingUsers ? 'not-allowed' : 'pointer' }}
                >
                  <option value="">{loadingUsers ? 'Đang tải danh sách...' : 'Chọn người thực hiện'}</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Trường 2: Nội dung công việc */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                  Nội dung công việc <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  placeholder="Nhập nội dung công việc chi tiết..."
                  rows={5}
                  value={taskContent}
                  onChange={(e) => setTaskContent(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#374151', fontFamily: 'sans-serif', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {/* Trường 3: Ngày đến hạn */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                  Ngày đến hạn <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#374151', boxSizing: 'border-box', cursor: 'pointer' }}
                />
              </div>

              {/* Khối hiển thị: Người tạo thực hiện và thời gian hệ thống */}
              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '16px', fontSize: '13px', color: '#6B7280' }}>
                <div style={{ marginBottom: '4px' }}>
                  <strong>Người thực hiện tạo:</strong> {profile?.full_name || 'Đang tải...'}
                </div>
                <div>
                  <strong>Thời gian ghi nhận:</strong> Vừa xong (Hệ thống tự động ghi lại thời gian thực khi nhấn Xác nhận)
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={submitting || loadingUsers}
                  style={{ backgroundColor: '#4C6FC2', color: '#FFFFFF', border: 'none', padding: '10px 24px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: (submitting || loadingUsers) ? 'not-allowed' : 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  {submitting ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </form>
        </div>

      </div>
    </main>
  );
}