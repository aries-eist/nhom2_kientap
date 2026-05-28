'use client'
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import '@/app/layout-styles.css';

interface UserProfile {
  full_name: string;
  department: string;
}

// CẤP NHẬT QUY TẮC ĐỔI MÀU & ĐỒNG BỘ GIÁ TRỊ ENUM TIẾNG ANH CHO DATABASE
const getPriorityConfig = (score: number) => {
  if (score >= 20) return { dbValue: 'Critical', label: 'Khẩn cấp', color: '#EF4444', bg: '#FEE2E2' };   // 20 - 25: Đỏ
  if (score >= 13) return { dbValue: 'High', label: 'Cao', color: '#F97316', bg: '#FFEDD5' };        // 13 - 19: Cam
  if (score >= 6) return { dbValue: 'Medium', label: 'Trung bình', color: '#EAB308', bg: '#FEF08A' };   // 6 - 12: Vàng
  return { dbValue: 'Low', label: 'Thấp', color: '#22C55E', bg: '#DCFCE7' };                         // 1 - 5: Xanh lá
};

function ViewRiskAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');
  const supabase = createClient();

  // States dữ liệu hệ thống
  const [report, setReport] = useState<any>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // States Profile & Thông báo Topbar
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  // States nghiệp vụ Đánh giá rủi ro (Mặc định chọn HZ-02 tương ứng với Rò rỉ khí gas)
  const [hazard, setHazard] = useState('HZ-02');
  const [likelihood, setLikelihood] = useState(3);
  const [severity, setSeverity] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // States quản lý Popup thành công
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [saveTimestamp, setSaveTimestamp] = useState('');

  // Tự động tính điểm
  const riskScore = likelihood * severity;
  const priority = getPriorityConfig(riskScore);

  // Click-outside đóng menu thông báo
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setIsNotiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch dữ liệu Profile người dùng
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
        console.error("Lỗi lấy profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchUserProfile();
  }, [supabase]);

  // Realtime thông báo hệ thống đồng bộ
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
      .channel('realtime-notifications-assessment')
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
  }, [currentUserId, supabase]);

  // Xử lý đọc thông báo
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

  // Đánh dấu đọc toàn bộ thông báo
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

  // Fetch chi tiết báo cáo sự cố cần đánh giá
  useEffect(() => {
    if (!reportId) return;

    async function fetchReportDetail() {
      try {
        setLoading(true);
        const { data: reportData, error: reportError } = await supabase
          .from('INCIDENT_REPORT')
          .select('*')
          .eq('report_id', reportId)
          .single();

        if (reportError) throw reportError;
        setReport(reportData);

        const { data: imageData } = await supabase
          .from('INCIDENT_IMAGE')
          .select('image_url')
          .eq('report_id', reportId);

        if (imageData) {
          setImages(imageData.map(img => img.image_url));
        }
      } catch (error) {
        console.error('Lỗi fetch chi tiết sự cố:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchReportDetail();
  }, [reportId, supabase]);

  // HÀM LƯU MỚI: ĐỒNG BỘ CHÍNH XÁC VỚI BẢNG RISK_ASSESSMENT TRÊN SUPABASE
  const handleSaveAssessment = async () => {
    try {
      setIsSubmitting(true);
      
      if (!currentUserId) {
        alert('Không tìm thấy thông tin tài khoản người đánh giá. Vui lòng đăng nhập lại!');
        return;
      }

      // Sinh mã assessment_id tự động dạng ASM-Timestamp
      const generatedAssessmentId = `ASM-${Date.now()}`;

      // Thực hiện lưu dữ liệu đánh giá rủi ro (Sử dụng upsert phòng trường hợp muốn ghi đè do dính Unique report_id)
      const { error } = await supabase
        .from('RISK_ASSESSMENT')
        .upsert([{
          assessment_id: generatedAssessmentId,
          report_id: reportId,
          hazard_id: hazard,
          likelihood: likelihood,
          severity: severity,
          risk_level: riskScore,
          priority: priority.dbValue,
          assessed_by: currentUserId,
          assessed_at: new Date().toISOString()
        }], { onConflict: 'report_id' });

      if (error) throw error;
      
      // Định dạng ngày giờ hiển thị lên Popup Modal thành công
      const now = new Date();
      const formattedTime = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
      setSaveTimestamp(formattedTime);
      
      setIsSuccessOpen(true);
    } catch (error: any) {
      console.error("Lỗi Supabase chi tiết:", error);
      alert(`Đã xảy ra lỗi hệ thống: ${error.message || 'Vui lòng kiểm tra lại kết nối.'}`);
    } finally {
      setIsSubmitting(false);
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: '#64748B', fontStyle: 'italic', fontSize: '14px' }}>
        Đang tải thông tin chi tiết dữ liệu...
      </div>
    );
  }

  // Mức màu ma trận rủi ro chuẩn hóa theo quy tắc điểm mới
  const matrixCells = [
    ['#EAB308', '#F97316', '#F97316', '#EF4444', '#EF4444'], // Hàng 5
    ['#22C55E', '#EAB308', '#EAB308', '#F97316', '#EF4444'], // Hàng 4
    ['#22C55E', '#EAB308', '#EAB308', '#EAB308', '#F97316'], // Hàng 3
    ['#22C55E', '#22C55E', '#EAB308', '#EAB308', '#EAB308'], // Hàng 2
    ['#22C55E', '#22C55E', '#22C55E', '#22C55E', '#22C55E'], // Hàng 1
  ];

  return (
    <main className='main-content' style={{ boxSizing: 'border-box', backgroundColor: '#F0F4F8', minHeight: '100vh', position: 'relative', fontFamily: 'sans-serif' }}>
      
      {/* 1. TOPBAR HEADER */}
      <header className='topbar'>
        <div className='bell' ref={notiRef} style={{ position: 'relative', cursor: 'pointer', userSelect: 'none' }}>
          <span onClick={() => setIsNotiOpen(!isNotiOpen)} style={{ fontSize: '20px' }}>🔔</span>
          {unreadCount > 0 && (
            <span className='notice-number' onClick={() => setIsNotiOpen(!isNotiOpen)}>{unreadCount}</span>
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

        <div className='user-profile'>
          <div className='avatar-box'>
            <img src="/avatar-pink.JPEG" alt="avatar" className='avatar-img'/>
          </div>
          <div className='user-info' style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <div className='user-name' style={{ fontWeight: 'bold', fontSize: '13px', color: '#1E293B' }}>
              {loadingProfile ? 'Đang tải...' : (profile?.full_name || 'Người phê duyệt')}
            </div>
            <div className='user-role' style={{ fontSize: '11px', color: '#64748B' }}>
              {loadingProfile ? '...' : (profile?.department || 'Ban HSE')}
            </div>
          </div>
        </div>
      </header>

      {/* 2. SECONDBAR TIÊU ĐỀ NỀN TRẮNG CHUẨN FLAT UI (CĂN TRÁI TUYỆT ĐỐI) */}
      <div className='second-bar' style={{ 
        backgroundColor: '#FFFFFF', 
        borderBottom: '1px solid #E2E8F0', 
        padding: '16px 32px', 
        marginBottom: '24px', 
        display: 'flex',
        alignItems: 'left',
        justifyContent: 'flex-start'
      }}>
         <button 
          onClick={() => router.push('/risk-assessment')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            border: 'none', 
            background: 'none', 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: '#1E293B', 
            cursor: 'pointer',
            padding: 0
          }}
        >
          <span style={{ fontSize: '24px', lineHeight: '1' }}>←</span> Báo cáo chi tiết
        </button>
      </div>

      {/* 3. VÙNG HIỂN THỊ CHÍNH */}
      <div style={{ padding: '0 32px 32px 32px', display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* CỘT TRÁI: THÔNG TIN BÁO CÁO */}
        <div style={{ backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '24px', textAlign: 'left' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '14px', fontWeight: '700', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Thông tin báo cáo
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px', color: '#0F172A', marginBottom: '8px' }}>{report?.report_id}</div>
              <span style={{ backgroundColor: '#D1FAE5', color: '#10B981', padding: '5px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                Đã phê duyệt
              </span>
            </div>

            <div style={{ marginTop: '8px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#000000', marginBottom: '4px' }}>Loại sự cố:</div>
              <div style={{ fontSize: '14px', color: '#334155' }}>
                {report?.incident_type_id === 'UC' ? 'Unsafe Condition' : report?.incident_type_id === 'UA' ? 'Unsafe Act' : 'Near Miss'}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#000000', marginBottom: '4px' }}>Địa điểm:</div>
              <div style={{ fontSize: '14px', color: '#334155' }}>{report?.location}</div>
            </div>

            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#000000', marginBottom: '4px' }}>Mô tả sự cố:</div>
              <div style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>{report?.description || report?.short_description}</div>
            </div>

            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#000000', marginBottom: '8px' }}>Ảnh hiện trường:</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {images.length === 0 ? (
                  <img src="/pipe-sample.png" alt="Mẫu" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px' }} />
                ) : (
                  images.map((url, index) => (
                    <img key={index} src={url} alt="Hiện trường" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #E2E8F0' }} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: ĐÁNH GIÁ RỦI RO & MA TRẬN */}
        <div style={{ backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '445px' }}>
          
          <div>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '14px', fontWeight: '700', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'left' }}>
              Đánh giá rủi ro
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
              
              {/* Bên trái: Input Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', color: '#000000', marginBottom: '6px' }}>Mối nguy <span style={{ color: '#EF4444' }}>*</span></label>
                  <select 
                    value={hazard}
                    onChange={(e) => setHazard(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: 'white', fontSize: '13px', outline: 'none' }}
                  >
                    <option value="HZ-01">Làm việc trên cao (Vật lý)</option>
                    <option value="HZ-02">Rò rỉ khí gas (Hóa học)</option>
                    <option value="HZ-03">Bề mặt thiết bị cao (Nhiệt độ)</option>
                    <option value="HZ-04">Làm việc trong bồn chứa (Không gian)</option>
                    <option value="HZ-05">Tích tụ tĩnh điện (Cháy nổ)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', color: '#000000', marginBottom: '6px' }}>Khả năng xảy ra <span style={{ color: '#EF4444' }}>*</span></label>
                  <select 
                    value={likelihood}
                    onChange={(e) => setLikelihood(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: 'white', fontSize: '13px', outline: 'none' }}
                  >
                    {[5, 4, 3, 2, 1].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', color: '#000000', marginBottom: '6px' }}>Mức độ nghiêm trọng <span style={{ color: '#EF4444' }}>*</span></label>
                  <select 
                    value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: 'white', fontSize: '13px', outline: 'none' }}
                  >
                    {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Bên phải: Ma trận rủi ro */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#000000', marginBottom: '16px' }}>Ma trận rủi ro</div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '9px', color: '#64748B', fontWeight: '500' }}>Khả năng xảy ra</div>
                  
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 32px)', gap: '1px', backgroundColor: '#E2E8F0', border: '1px solid #E2E8F0' }}>
                      {matrixCells.map((row, rIdx) => {
                        const rowValue = 5 - rIdx;
                        return row.map((color, cIdx) => {
                          const colValue = cIdx + 1;
                          const cellScore = rowValue * colValue;
                          const isCurrentActive = (likelihood === rowValue && severity === colValue);

                          return (
                            <div 
                              key={`${rIdx}-${cIdx}`} 
                              style={{ 
                                backgroundColor: color, height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 'bold', color: 'rgba(0,0,0,0.35)', position: 'relative'
                              }}
                            >
                              {cellScore}
                              {isCurrentActive && (
                                <div style={{ position: 'absolute', width: '10px', height: '10px', backgroundColor: '#000000', borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 4px rgba(0,0,0,0.4)' }}></div>
                              )}
                            </div>
                          );
                        });
                      })}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 32px)', marginTop: '4px', justifyItems: 'center', fontSize: '11px', fontWeight: '600', color: '#334155' }}>
                      <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748B', marginTop: '4px', fontWeight: '500' }}>Mức độ nghiêm trọng</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '134px', fontSize: '11px', fontWeight: '600', color: '#334155', paddingBottom: '18px' }}>
                    <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Khối kết quả */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden', marginTop: '32px' }}>
              <div style={{ padding: '12px', borderRight: '1px solid #CBD5E1', textAlign: 'center', backgroundColor: '#F8FAFC' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px', textTransform: 'uppercase' }}>Mức độ rủi ro</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1E293B' }}>{riskScore}</div>
              </div>
              <div style={{ padding: '12px', textAlign: 'center', backgroundColor: priority.bg, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(0,0,0,0.45)', marginBottom: '4px', textTransform: 'uppercase' }}>Mức độ ưu tiên</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: priority.color }}>{priority.label}</div>
              </div>
            </div>
          </div>

          {/* Nút lưu */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button
              onClick={handleSaveAssessment}
              disabled={isSubmitting}
              style={{
                backgroundColor: '#2F80ED', color: 'white', border: 'none', padding: '10px 36px',
                borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(47, 128, 237, 0.15)'
              }}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>

        </div>

      </div>

      {/* 4. POPUP MODAL THÔNG BÁO LƯU THÀNH CÔNG (Chuẩn UI Mockup) */}
      {isSuccessOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '32px 40px',
            width: '420px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            {/* Icon tích xanh */}
            <div style={{
              width: '56px', height: '56px', backgroundColor: '#22C55E', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px'
            }}>
              <span style={{ color: 'white', fontSize: '28px', fontWeight: 'bold' }}>✓</span>
            </div>

            {/* Tiêu đề */}
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1E293B', margin: '0 0 8px 0' }}>
              Lưu kết quả đánh giá thành công!
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 12px 0' }}>
              Mã báo cáo của bạn là:
            </p>

            {/* Hộp chứa mã báo cáo */}
            <div style={{
              backgroundColor: '#E2E8F0', color: '#334155', fontWeight: '700',
              fontSize: '14px', padding: '8px 48px', borderRadius: '4px', marginBottom: '8px'
            }}>
              {report?.report_id || reportId}
            </div>

            {/* Timestamp ngày giờ */}
            <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '24px' }}>
              {saveTimestamp}
            </div>

            {/* Nhóm các nút hành động */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <button
                onClick={() => setIsSuccessOpen(false)}
                style={{
                  backgroundColor: '#4C6FC2', color: 'white', border: 'none', padding: '10px 0',
                  borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%'
                }}
              >
                Xem chi tiết
              </button>
              <button
                onClick={() => router.push('/risk-assessment')}
                style={{
                  backgroundColor: '#4C6FC2', color: 'white', border: 'none', padding: '10px 0',
                  borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%'
                }}
              >
                Quay về danh sách
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ViewRiskAssessmentPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px' }}>Đang tải trang...</div>}>
      <ViewRiskAssessmentContent />
    </Suspense>
  );
}