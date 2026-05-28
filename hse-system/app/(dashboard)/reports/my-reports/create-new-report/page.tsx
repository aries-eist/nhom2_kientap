'use client'
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { createClient } from '@/utils/supabase/client'; 
import { uploadFile } from '@/lib/storage'; 
import '@/app/layout-styles.css'; 

interface UserProfile {
  full_name: string;
  department: string;
}

export default function CreateReportPage() {
  const router = useRouter();
  const supabase = createClient();

  // State quản lý dữ liệu form thông thường
  const [reportId, setReportId] = useState('REP-0000'); 
  const [incidentTypeId, setIncidentTypeId] = useState(''); 
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(''); 
  const [time, setTime] = useState(''); 
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [actionTaken, setActionTaken] = useState(''); 
  
  // State quản lý ID của người dùng đang đăng nhập thực tế
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // State quản lý thông tin Profile cá nhân hiển thị lên thanh Topbar
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // 🔔 STATE BỔ SUNG CHO CHUÔNG THÔNG BÁO ĐỘNG
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  // State quản lý File Ảnh đính kèm
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // State quản lý trạng thái UI & Cửa sổ Thông báo
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false); 
  const [showErrorModal, setShowErrorModal] = useState(false);     
  const [successTime, setSuccessTime] = useState(''); 

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Đóng cụm dropdown thông báo khi click ra ngoài vùng chuông
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // HÀM TÌM MÃ TIẾP THEO BẰNG CÁCH LẤY MAX(REPORT_ID) TRONG DATABASE
  const generateNextReportId = async () => {
    try {
      const { data, error } = await supabase
        .from('INCIDENT_REPORT')
        .select('report_id')
        .order('report_id', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const lastReportId = data[0].report_id; 
        const lastSequence = parseInt(lastReportId.replace('REP-', ''), 10);
        const nextSequence = lastSequence + 1;
        return `REP-${String(nextSequence).padStart(4, '0')}`;
      } else {
        return 'REP-0001';
      }
    } catch (err) {
      console.error('Lỗi tính mã báo cáo:', err);
      return `REP-${String(Math.floor(1000 + Math.random() * 9000))}`;
    }
  };

  // Khởi chạy khi load trang: Lấy User thực tế đang đăng nhập + Mã báo cáo tạm tính + Dữ liệu Topbar
  useEffect(() => {
    const initPageData = async () => {
      const nextId = await generateNextReportId();
      setReportId(nextId);

      try {
        setLoadingProfile(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);

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
            
            if (fallbackData) {
              profileData = fallbackData;
            }
          }

          if (profileData) {
            setProfile(profileData);
          }
        }
      } catch (err) {
        console.error('Lỗi khởi tạo cấu trúc trang:', err);
      } finally {
        setLoadingProfile(false);
      }
    };
    initPageData();
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

    const channel = supabase
      .channel('realtime-notifications-create-page')
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

  // Hàm bấm vào đọc từng thông báo
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

  // Hàm đánh dấu đọc tất cả thông báo
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

  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#1E293B' };
  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '13px', outline: 'none', color: '#000000', backgroundColor: '#FFFFFF', boxSizing: 'border-box' as const };
  const starStyle = { color: '#EF4444', marginLeft: '4px' };

  const validateAndSetFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert('Định dạng file không hợp lệ! Vui lòng chỉ chọn ảnh JPG hoặc PNG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh vượt quá 5MB! Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file)); 
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
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

  const handleSubmit = async () => {
    if (!incidentTypeId || !location || !date || !time || !shortDescription || !selectedFile) {
      setShowErrorModal(true);
      return;
    }

    if (!currentUserId) {
      alert('Không thể gửi báo cáo vì hệ thống không xác định được danh tính tài khoản của bạn. Vui lòng thử đăng nhập lại!');
      return;
    }

    setIsSubmitting(true);

    try {
      const occurredAt = new Date(`${date}T${time}:00`).toISOString();
      const finalReportId = await generateNextReportId();
      setReportId(finalReportId); 

      const { error: dbError } = await supabase
        .from('INCIDENT_REPORT') 
        .insert([
          {
            report_id: finalReportId, 
            incident_type_id: incidentTypeId,
            location: location,
            occurred_at: occurredAt,
            short_description: shortDescription,
            long_description: longDescription,
            reviewer_feedback: actionTaken, 
            status: 'New', 
            created_by: currentUserId, 
            created_at: new Date().toISOString()
          }
        ]);

      if (dbError) throw dbError;

      const uploadResult = await uploadFile(selectedFile, 'evidence');
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error?.message || 'Lỗi xảy ra trong quá trình upload ảnh minh chứng.');
      }

      const generatedImageId = 'IMG' + Math.random().toString(36).substring(2, 11).toUpperCase();
      
      const { error: imgDbError } = await supabase
        .from('INCIDENT_IMAGE') 
        .insert([
          {
            image_id: generatedImageId,
            report_id: finalReportId, 
            image_url: uploadResult.url,  
            is_original: true,
            uploaded_by: currentUserId, 
            uploaded_at: new Date().toISOString()
          }
        ]);

      if (imgDbError) throw imgDbError;

      const now = new Date();
      const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setSuccessTime(formattedDate);

      setShowSuccessModal(true);
      
    } catch (error: any) {
      console.error('🔴 Lỗi tích hợp hệ thống:', error);
      const errorMessage = error?.message || 'Lỗi không xác định';
      alert('Không thể hoàn tất lưu báo cáo: ' + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
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
                      {/* CHẤM XANH CHƯA ĐỌC */}
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
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#000000', padding: '0', display: 'flex', alignItems: 'center' }}>←</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#000000', lineHeight: '1.2' }}>Báo cáo sự cố</h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748B', lineHeight: '1.2' }}>Vui lòng cung cấp thông tin sự cố/ quan sát</p>
        </div>
      </div>

      {/* 3. KHÔNG GIAN BẢNG FORM ĐIỀN THÔNG TIN */}
      <div className='report-content' style={{ padding: '24px 32px' }}>
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
          
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '32px 20px', margin: '-20px -32px' }}>
            <tbody>
              
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <label style={labelStyle}>Mã báo cáo:</label>
                  <input 
                    type="text" 
                    style={{ ...inputStyle, backgroundColor: '#F1F5F9', color: '#64748B', cursor: 'not-allowed', fontWeight: 'bold', letterSpacing: '0.5px' }} 
                    value={reportId} 
                    disabled 
                  />
                </td>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <label style={labelStyle}>Loại sự cố<span style={starStyle}>*</span></label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={incidentTypeId} onChange={(e) => setIncidentTypeId(e.target.value)}>
                    <option value="">Chọn loại sự cố phù hợp</option>
                    <option value="UC">Unsafe Condition</option>
                    <option value="NM">Near Miss</option>
                    <option value="UA">Unsafe Act</option>
                  </select>
                </td>
              </tr>

              <tr>
                <td style={{ verticalAlign: 'top' }}>
                  <label style={labelStyle}>Địa điểm xảy ra<span style={starStyle}>*</span></label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={location} onChange={(e) => setLocation(e.target.value)}>
                    <option value="">Chọn hoặc nhập địa điểm xảy ra sự cố</option>
                    <option value="Khu đường ống">Khu đường ống dẫn khí</option>
                    <option value="Khu vực điện">Khu vực trạm điện bể chứa</option>
                    <option value="Khu bồn chứa">Khu vực bồn chứa dung môi</option>
                  </select>
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', width: '100%', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Ngày xảy ra<span style={starStyle}>*</span></label>
                      <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Thời gian xảy ra<span style={starStyle}>*</span></label>
                      <input type="time" style={inputStyle} value={time} onChange={(e) => setTime(e.target.value)} />
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td style={{ verticalAlign: 'top' }}>
                  <label style={labelStyle}>Mô tả ngắn sự cố<span style={starStyle}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <textarea 
                      style={{ ...inputStyle, resize: 'none', height: '110px', fontFamily: 'inherit' }} 
                      placeholder="Nhập mô tả về sự cố/ quan sát..." 
                      maxLength={255} 
                      value={shortDescription} 
                      onChange={(e) => setShortDescription(e.target.value)} 
                    />
                    <div style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '11px', color: '#94A3B8' }}>{shortDescription.length}/255</div>
                  </div>
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <label style={labelStyle}>Mô tả chi tiết sự cố</label>
                  <div style={{ position: 'relative' }}>
                    <textarea 
                      style={{ ...inputStyle, resize: 'none', height: '110px', fontFamily: 'inherit' }} 
                      placeholder="Nhập mô tả chi tiết về sự cố/ quan sát..." 
                      maxLength={1000} 
                      value={longDescription} 
                      onChange={(e) => setLongDescription(e.target.value)} 
                    />
                    <div style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '11px', color: '#94A3B8' }}>{longDescription.length}/1000</div>
                  </div>
                </td>
              </tr>

              <tr>
                <td colSpan={2} style={{ paddingTop: '12px' }}>
                  <label style={labelStyle}>Ảnh hiện trường<span style={starStyle}>*</span></label>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".jpg,.jpeg,.png" style={{ display: 'none' }} />

                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div 
                      onClick={triggerFileInput}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { 
                        e.preventDefault(); 
                        setIsDragging(false); 
                        if (e.dataTransfer?.files?.[0]) { validateAndSetFile(e.dataTransfer.files[0]); }
                      }}
                      style={{ 
                        flex: 1, border: isDragging ? '2px dashed #4460A0' : '2px dashed #CBD5E1', borderRadius: '4px', padding: '24px', textAlign: 'center', backgroundColor: isDragging ? '#EFF6FF' : '#F8FAFC', cursor: 'pointer', transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ fontSize: '28px', color: '#4460A0', marginBottom: '8px' }}>📤</div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>Kéo thả ảnh vào đây hoặc <span style={{ color: '#4460A0', fontWeight: '600' }}>Chọn file từ thiết bị</span></p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94A3B8' }}>Định dạng: JPG, PNG (tối đa 5MB/ảnh)</p>
                      {selectedFile && <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#27AE60', fontWeight: '500' }}>✔️ Đã chọn: {selectedFile.name}</p>}
                    </div>

                    <div style={{ width: '106px', height: '106px', border: '1px dashed #CBD5E1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', overflow: 'hidden' }}>
                      {imagePreview ? <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '20px', color: '#94A3B8' }}>🖼️</span>}
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td colSpan={2} style={{ paddingTop: '12px' }}>
                  <label style={labelStyle}>Biện pháp xử lý ban đầu (Tùy chọn)</label>
                  <input type="text" style={inputStyle} placeholder="Cách xử lý tạm thời" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} />
                </td>
              </tr>

            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
            <button 
              onClick={handleSubmit} 
              disabled={isSubmitting} 
              style={{ backgroundColor: isSubmitting ? '#94A3B8' : '#4460A0', color: 'white', border: 'none', padding: '10px 36px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {isSubmitting ? 'Đang xử lý...' : 'Gửi báo cáo'}
            </button>
          </div>

        </div>
      </div>

      {/* MODAL THÔNG BÁO THÀNH CÔNG */}
      {showSuccessModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#FFFFFF', width: '440px', borderRadius: '8px', padding: '40px 32px 32px 32px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', textAlign: 'center', boxSizing: 'border-box', border: '1px solid #CBD5E1' }}>
            <div style={{ width: '72px', height: '72px', backgroundColor: '#27AE60', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', color: '#FFFFFF', fontSize: '36px', fontWeight: 'bold' }}>✓</div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#000000' }}>Gửi báo cáo thành công!</h3>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#333333', fontWeight: '500' }}>Mã báo cáo của bạn là:</p>
            <div style={{ backgroundColor: '#F1F5F9', padding: '10px 24px', borderRadius: '4px', fontSize: '16px', fontWeight: '700', color: '#000000', display: 'inline-block', marginBottom: '12px', border: '1px solid #CBD5E1' }}>{reportId}</div>
            <p style={{ margin: '0 0 32px 0', fontSize: '13px', color: '#64748B' }}>{successTime}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => router.push(`/reports/my-reports/view-report?id=${reportId}`)} style={{ width: '100%', backgroundColor: '#4460A0', color: '#FFFFFF', border: 'none', padding: '12px 0', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Xem chi tiết</button>
              <button onClick={() => router.push('/reports/my-reports')} style={{ width: '100%', backgroundColor: '#EFF6FF', color: '#4460A0', border: '1px solid #B3D4FF', padding: '12px 0', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Quay về danh sách</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÔNG BÁO LỖI THIẾU TRƯỜNG */}
      {showErrorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#FFFFFF', width: '420px', borderRadius: '8px', padding: '40px 32px 32px 32px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', textAlign: 'center', boxSizing: 'border-box', border: '1px solid #CBD5E1' }}>
            <div style={{ width: '72px', height: '72px', backgroundColor: '#EF4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', color: '#FFFFFF', fontSize: '38px', fontWeight: 'bold' }}>!</div>
            <h3 style={{ margin: '0 0 32px 0', fontSize: '18px', fontWeight: '700', color: '#000000', lineHeight: '1.5' }}>Vui lòng điền đầy đủ<br />các trường bắt buộc!</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => setShowErrorModal(false)} style={{ width: '100%', backgroundColor: '#4460A0', color: '#FFFFFF', border: 'none', padding: '12px 0', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Đóng</button>
              <button onClick={() => router.push('/reports/my-reports')} style={{ width: '100%', backgroundColor: '#EFF6FF', color: '#4460A0', border: '1px solid #B3D4FF', padding: '12px 0', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Quay về danh sách</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}