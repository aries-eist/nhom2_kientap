'use client'
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client'; 
import '@/app/layout-styles.css';

interface UserProfile {
  full_name: string;
  department: string;
}

function EditReportFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  // Bóc tách mã báo cáo từ thanh URL (Ví dụ: ?id=REP-0005)
  const reportIdFromUrl = searchParams.get('id');

  // Quản lý trạng thái tải form và trạng thái nút bấm gửi
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // State quản lý ID người dùng đăng nhập thực tế
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // State quản lý Profile cá nhân hiển thị lên thanh Topbar
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // 🔔 CÁC STATE BỔ SUNG CHO CHUÔNG THÔNG BÁO ĐỘNG
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  // Khởi tạo State lưu trữ dữ liệu form trống ban đầu
  const [formData, setFormData] = useState({
    report_id: '',
    incident_type_id: 'UC', 
    location: '',
    occurred_date: '',
    occurred_time: '',
    short_description: '',
    detailed_description: '',
    initial_action: ''
  });

  const [imageEvidence, setImageEvidence] = useState<string | null>(null);

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
        console.error("Lỗi hệ thống khi lấy profile Topbar:", err);
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
      .channel('realtime-notifications-edit-page')
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
  // HOOK 2: KÉO DỮ LIỆU THẬT TỪ DATABASE ĐỔ VÀO FORM KHI MỞ TRANG
  // =========================================================================
  useEffect(() => {
    if (!reportIdFromUrl) return;

    async function fetchReportDetail() {
      try {
        setLoading(true);
        const res = await fetch(`/api/reports/detail?id=${reportIdFromUrl}`);
        if (!res.ok) throw new Error("Không thể tải thông tin báo cáo");
        
        const data = await res.json();
        
        const rawDate = data.occurred_at ? data.occurred_at.split('T')[0] : '';
        const rawTime = data.occurred_at ? data.occurred_at.split('T')[1]?.substring(0, 5) : '';

        setFormData({
          report_id: data.report_id,
          incident_type_id: data.incident_type_id || 'UC',
          location: data.location || '',
          occurred_date: rawDate,
          occurred_time: rawTime,
          short_description: data.short_description || '',
          detailed_description: data.long_description || '', 
          initial_action: data.reviewer_feedback || '' 
        });
        
        if (data.image_url) {
          setImageEvidence(data.image_url);
        } else {
          setImageEvidence('https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=400');
        }

      } catch (error) {
        console.error("Lỗi đồng bộ dữ liệu sửa:", error);
        alert("Không tìm thấy thông tin báo cáo sự cố hợp lệ.");
      } finally {
        setLoading(false);
      }
    }

    fetchReportDetail();
  }, [reportIdFromUrl]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      if (!reportIdFromUrl) {
        alert("Lỗi hệ thống: Không tìm thấy ID báo cáo trên URL.");
        return;
      }

      if (!formData.location || !formData.occurred_date || !formData.occurred_time || !formData.short_description) {
        alert("Vui lòng nhập đầy đủ các thông tin bắt buộc (*)");
        return;
      }

      setIsSaving(true);
      
      let combinedOccurredAt = '';
      try {
        combinedOccurredAt = new Date(`${formData.occurred_date}T${formData.occurred_time}:00`).toISOString();
      } catch (e) {
        alert("Định dạng ngày giờ không hợp lệ, vui lòng kiểm tra lại!");
        setIsSaving(false);
        return;
      }

      const response = await fetch(`/api/reports/detail?id=${reportIdFromUrl}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_type_id: formData.incident_type_id,
          location: formData.location,
          occurred_at: combinedOccurredAt,
          short_description: formData.short_description,
          long_description: formData.detailed_description,
        })
      });

      if (response.ok) {
        setShowSuccessModal(true);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`Lỗi cập nhật dữ liệu: ${errData.error || 'Vui lòng kiểm tra các ràng buộc dữ liệu đầu vào'}`);
      }
    } catch (error: any) {
      console.error("🔴 LỖI FRONT-END KHI BẤM LƯU:", error.message);
      alert(`Lỗi kết nối máy chủ không thể lưu: ${error.message}`);
    } finally {
      setIsSaving(false);
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

  // Hệ thống Style giao diện đồng bộ màu Indigo đậm chuẩn mẫu
  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #CBD5E1',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#000000',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginTop: '6px'
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '600' as const,
    color: '#334155',
    display: 'block'
  };

  const asteriskStyle = {
    color: '#EF4444',
    marginLeft: '3px'
  };

  const buttonStyle = {
    color: '#FFFFFF',
    border: 'none',
    padding: '10px 32px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '500' as const,
    cursor: 'pointer'
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>Đang tải thông tin chi tiết sự cố từ Supabase...</div>;
  }

  return (
    <main className='main-content' style={{ boxSizing: 'border-box', backgroundColor: '#F0F4F8', minHeight: '100vh', position: 'relative' }}>
      
      {/* 1. THANH HEADER TOPBAR */}
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
                      {/* CHẤM XANH CHƯA ĐỌC GIỐNG HỆT FILE HÌNH */}
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

      {/* 2. THANH SECONDBAR TIÊU ĐỀ */}
      <div className='second-bar' style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px', padding: '14px 32px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#000000', padding: '0', display: 'flex', alignItems: 'center' }}>←</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#000000', lineHeight: '1.2' }}>Báo cáo sự cố</h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748B', lineHeight: '1.2' }}>Đang chỉnh sửa thông tin của báo cáo: {formData.report_id}</p>
        </div>
      </div>

      {/* 3. KHU VỰC GRID FORM NHẬP LIỆU CHỈNH SỬA */}
      <div className='report-content' style={{ padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px', backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
          
          <div>
            <label style={labelStyle}>Mã báo cáo</label>
            <input type="text" name="report_id" value={formData.report_id} disabled style={{ ...inputStyle, backgroundColor: '#F1F5F9', color: '#64748B', fontWeight: 'bold' }} />
          </div>

          <div>
            <label style={labelStyle}>Loại sự cố<span style={asteriskStyle}>*</span></label>
            <select name="incident_type_id" value={formData.incident_type_id} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="UC">Unsafe Condition</option>
              <option value="NM">Near Miss</option>
              <option value="UA">Unsafe Act</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Địa điểm xảy ra<span style={asteriskStyle}>*</span></label>
            <input type="text" name="location" value={formData.location} onChange={handleChange} style={inputStyle} placeholder="Ví dụ: Khu vực bồn chứa hóa chất A" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Ngày xảy ra<span style={asteriskStyle}>*</span></label>
              <input type="date" name="occurred_date" value={formData.occurred_date} onChange={handleChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Thời gian xảy ra<span style={asteriskStyle}>*</span></label>
              <input type="time" name="occurred_time" value={formData.occurred_time} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Mô tả ngắn sự cố<span style={asteriskStyle}>*</span></label>
            <textarea name="short_description" value={formData.short_description} onChange={handleChange} rows={4} maxLength={255} style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }} />
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>{formData.short_description.length}/255</div>
          </div>

          <div>
            <label style={labelStyle}>Mô tả chi tiết sự cố</label>
            <textarea name="detailed_description" value={formData.detailed_description} onChange={handleChange} rows={4} maxLength={1000} placeholder="Nhập mô tả chi tiết về sự cố..." style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }} />
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>{formData.detailed_description.length}/1000</div>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Ảnh hiện trường<span style={asteriskStyle}>*</span></label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px' }}>
              <div style={{ border: '1px dashed #CBD5E1', borderRadius: '4px', padding: '16px 24px', textAlign: 'center', backgroundColor: '#FFFFFF', width: '240px' }}>
                <div style={{ fontSize: '24px', color: '#4460A0', marginBottom: '4px' }}>☁️</div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>Kéo thả ảnh vào đây hoặc</div>
                <div style={{ fontSize: '13px', color: '#4460A0', fontWeight: '600', margin: '2px 0' }}>Chọn file từ thiết bị</div>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>Định dạng: JPG, PNG (tối đa 5MB/ảnh)</div>
              </div>

              {imageEvidence && (
                <div style={{ position: 'relative', width: '90px', height: '90px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                  <img src={imageEvidence} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={() => setImageEvidence(null)} style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(15, 23, 42, 0.6)', color: 'white', border: 'none', width: '18px', height: '18px', borderRadius: '50%', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              )}
              <div style={{ width: '90px', height: '90px', border: '1px dashed #CBD5E1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', backgroundColor: '#F8FAFC' }}>🖼️+</div>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Biện pháp xử lý ban đầu</label>
            <input type="text" name="initial_action" value={formData.initial_action} onChange={handleChange} placeholder="Cách xử lý tạm thời" style={inputStyle} />
          </div>

        </div>

        {/* Khối nút chức năng dưới cùng */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', marginTop: '24px' }}>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            style={{ ...buttonStyle, backgroundColor: isSaving ? '#94A3B8' : '#4460A0', cursor: isSaving ? 'not-allowed' : 'pointer' }}
          >
            {isSaving ? 'Đang cập nhật...' : 'Lưu'}
          </button>

          <button 
            onClick={() => router.push('/reports/my-reports')}
            disabled={isSaving}
            style={{ ...buttonStyle, backgroundColor: '#4460A0' }}
          >
            Quay về danh sách
          </button>
        </div>
      </div>

      {/* ==================== 4. MODAL THÔNG BÁO THÀNH CÔNG ==================== */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            width: '420px',
            borderRadius: '8px',
            padding: '36px 24px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #CBD5E1'
          }}>
            
            <div style={{ width: '64px', height: '64px', backgroundColor: '#27AE60', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: '#FFFFFF', fontSize: '32px', fontWeight: 'bold' }}>
              ✓
            </div>

            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold', color: '#000000' }}>
              Cập nhật thành công!
            </h3>

            <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#333333' }}>
              Báo cáo sự cố đã chỉnh sửa:
            </p>
            
            <div style={{ backgroundColor: '#F1F5F9', padding: '10px 0', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold', color: '#000000', width: '260px', margin: '0 auto 20px auto', letterSpacing: '0.5px', border: '1px solid #CBD5E1' }}>
              {formData.report_id}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '260px', margin: '0 auto' }}>
              <button
                onClick={() => router.push(`/reports/my-reports/view-report?id=${formData.report_id}`)}
                style={{ backgroundColor: '#4460A0', color: '#FFFFFF', border: 'none', padding: '11px 0', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%' }}
              >
                Xem chi tiết
              </button>

              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push('/reports/my-reports');
                }}
                style={{ backgroundColor: '#64748B', color: '#FFFFFF', border: 'none', padding: '11px 0', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%' }}
              >
                Quay về danh sách chính
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}

export default function EditReportPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Đang cấu hình môi trường chỉnh sửa...</div>}>
      <EditReportFormContent />
    </Suspense>
  );
}