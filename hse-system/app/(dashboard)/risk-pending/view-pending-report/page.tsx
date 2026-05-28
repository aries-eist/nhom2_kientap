"use client"
import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import '@/app/layout-styles.css'; 

interface IncidentReport {
  report_id: string;
  incident_type_id: string;
  location: string;
  short_description: string;
  long_description: string;
  created_at: string;
  created_by: string;
  status: string;
  reviewer_feedback?: string;
}

interface IncidentImage {
  image_id: string;
  report_id: string;
  image_url: string;
  is_original: boolean;
}

interface UserProfile {
  full_name: string;
  department: string;
}

const statusStyleConfig: Record<string, { label: string; bg: string; color: string }> = {
  New: { label: 'Mới', bg: '#FEF08A', color: '#854D0E' },
  Approved: { label: 'Đã phê duyệt', bg: '#EBF3FF', color: '#2F80ED' },
  Rejected: { label: 'Đã hủy', bg: '#FFF0E6', color: '#F2994A' },
  RequestInfo: { label: 'Yêu cầu bổ sung', bg: '#F9E6FA', color: '#B02BB8' },
  Closed: { label: 'Đã đóng', bg: '#E6F9ED', color: '#27AE60' }
};

export default function ViewPendingReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id'); 
  const supabase = createClient();

  const [report, setReport] = useState<IncidentReport | null>(null);
  const [images, setImages] = useState<IncidentImage[]>([]); 
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState(''); // Quản lý ô Ghi chú bên phải
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notiRef = useRef<HTMLDivElement>(null);

  // 🌟 CÁC STATE PHỤC VỤ POPUP/MODAL Ý KIẾN PHẢN HỒI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFeedback, setModalFeedback] = useState('');
  const [pendingAction, setPendingAction] = useState<'Rejected' | 'RequestInfo' | null>(null);

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
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel('realtime-notifications-detail')
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
    if (!reportId) return;

    async function fetchReportAndImages() {
      try {
        setLoading(true);

        const { data: reportData, error: reportError } = await supabase
          .from('INCIDENT_REPORT')
          .select('*')
          .eq('report_id', reportId)
          .maybeSingle();

        if (reportError) throw reportError;
        if (reportData) {
          setReport(reportData);
          // Đồng bộ hiển thị feedback cũ vào ô ghi chú nếu có sẵn
          if (reportData.reviewer_feedback) {
            setNote(reportData.reviewer_feedback);
          }
        }

        const { data: imageData, error: imageError } = await supabase
          .from('INCIDENT_IMAGE')
          .select('*')
          .eq('report_id', reportId);

        if (imageError) throw imageError;
        if (imageData) {
          setImages(imageData);
        }

      } catch (err) {
        console.error("Lỗi hệ thống khi tải dữ liệu báo cáo và hình ảnh:", err);
        alert("Không thể kết nối dữ liệu báo cáo này!");
      } finally {
        setLoading(false);
      }
    }

    fetchReportAndImages();
  }, [reportId]);

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

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('vi-VN', { hour12: false }).replace(',', '');
    } catch (e) {
      return dateString;
    }
  };

  // 🌟 ĐIỀU HƯỚNG CLICK NÚT DUYỆT CHÍNH XÁC
  const handleButtonClick = (actionType: 'Approved' | 'Rejected' | 'RequestInfo') => {
    if (actionType === 'Approved') {
      const confirmAction = window.confirm(`Bạn có chắc chắn muốn thực hiện hành động: [Phê duyệt] cho báo cáo này?`);
      if (confirmAction) {
        executeStatusUpdate('Approved', note); // Phê duyệt lấy ghi chú trực tiếp ở ngoài (không bắt buộc)
      }
    } else {
      // Nếu là Từ chối hoặc Yêu cầu bổ sung -> Bật Modal nhập ý kiến phản hồi bắt buộc
      setPendingAction(actionType);
      setModalFeedback('');
      setIsModalOpen(true);
    }
  };

  // 🌟 HÀM SUBMIT MODAL Ý KIẾN PHẢN HỒI
  const handleModalConfirm = () => {
    if (!modalFeedback.trim()) {
      alert('Vui lòng nhập ý kiến phản hồi bắt buộc!');
      return;
    }
    if (pendingAction) {
      setIsModalOpen(false);
      executeStatusUpdate(pendingAction, modalFeedback);
    }
  };

  // 🌟 HÀM THỰC THI GỬI DỮ LIỆU LÊN SUPABASE
  const executeStatusUpdate = async (actionType: 'Approved' | 'Rejected' | 'RequestInfo', feedbackContent: string) => {
    if (!report) return;

    const actionText = 
      actionType === 'Approved' ? 'Phê duyệt' : 
      actionType === 'Rejected' ? 'Từ chối' : 'Yêu cầu bổ sung';

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('INCIDENT_REPORT')
        .update({ 
          status: actionType,
          reviewer_feedback: feedbackContent, // Đẩy text vào cột reviewer_feedback chuẩn đặc tả
          updated_at: new Date().toISOString()
        })
        .eq('report_id', report.report_id);

      if (error) throw error;

      setReport(prev => prev ? { ...prev, status: actionType, reviewer_feedback: feedbackContent } : null);
      setNote(feedbackContent);

      alert(`Đã hoàn tất xử lý: ${actionText}!`);
      
      router.push('/risk-pending'); 
      router.refresh();
    } catch (err: any) {
      console.error(`Lỗi thực thi dữ liệu hành động ${actionText}:`, err);
      alert(`Thao tác thất bại! Chi tiết lỗi: ${err?.message || err?.details || JSON.stringify(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>Đang nạp dữ liệu từ hệ thống...</div>;
  }

  if (!report) {
    return <div style={{ padding: '32px', textAlign: 'center', color: '#EF4444' }}>Không tìm thấy bản ghi báo cáo phù hợp trên hệ thống!</div>;
  }

  const formattedDate = new Date(report.created_at).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ' ' + new Date(report.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <main className='main-content' style={{ boxSizing: 'border-box', backgroundColor: '#F0F4F8', minHeight: '100vh', position: 'relative' }}>
      
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

      {/* 2. NỘI DUNG CHÍNH CỦA TRANG CHI TIẾT */}
      <div style={{ padding: '24px 32px' }}>
        
        <button 
          onClick={() => router.push('/risk-pending')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', border: 'none', background: 'none', fontSize: '18px', fontWeight: 'bold', color: '#1E293B', cursor: 'pointer', marginBottom: '24px' }}
        >
          <span style={{ fontSize: '24px' }}>←</span> Báo cáo chi tiết
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* KHỐI BÊN TRÁI: THÔNG TIN BÁO CÁO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #CBD5E1', color: '#1E3A8A', fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.5px' }}>
                THÔNG TIN BÁO CÁO
              </div>
              
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '90px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1E293B', width: '120px' }}>{report.report_id}</span>
                    {(() => {
                      const config = statusStyleConfig[report.status] || { label: report.status, bg: '#F1F5F9', color: '#334155' };
                      return (
                        <span style={{ backgroundColor: config.bg, color: config.color, padding: '4px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '500' }}>
                          {config.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '90px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1E293B', width: '120px' }}>Loại sự cố</span>
                  <span style={{ fontSize: '16px', color: '#334155' }}>{report.incident_type_id || 'Unsafe Condition'}</span>
                </div>

                <div style={{ display: 'flex', gap: '90px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1E293B', width: '120px' }}>Địa điểm</span>
                  <span style={{ fontSize: '16px', color: '#334155' }}>{report.location}</span>
                </div>

                <div style={{ display: 'flex', gap: '90px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1E293B', width: '120px' }}>Mô tả ngắn</span>
                  <span style={{ fontSize: '16px', color: '#334155', flex: 1, lineHeight: '1.5' }}>
                    {report.short_description}
                  </span>
                </div>

                {report.long_description && (
                  <div style={{ display: 'flex', gap: '90px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1E293B', width: '120px' }}>Mô tả chi tiết</span>
                    <span style={{ fontSize: '16px', color: '#334155', flex: 1, lineHeight: '1.5' }}>
                      {report.long_description}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '90px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1E293B', width: '120px' }}>Ảnh hiện trường</span>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {images.length > 0 ? (
                      images.map((img) => (
                        <img 
                          key={img.image_id}
                          src={img.image_url} 
                          alt="Ảnh hiện trường sự cố" 
                          style={{ width: '140px', height: '110px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #E2E8F0' }} 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/ong-dan.JPEG'; 
                          }}
                        />
                      ))
                    ) : (
                      <div style={{ width: '140px', height: '110px', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '12px' }}>
                        Không có hình ảnh
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #CBD5E1', color: '#1E3A8A', fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.5px' }}>
                THÔNG TIN KHÁC
              </div>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '16px', color: '#1E293B' }}>
                  <strong>Ngày tạo:</strong> {formattedDate}
                </div>
                <div style={{ fontSize: '16px', color: '#1E293B' }}>
                  <strong>Mã người tạo (UUID):</strong> {report.created_by}
                </div>
              </div>
            </div>

          </div>

          {/* KHỐI BÊN PHẢI: THAO TÁC DUYỆT */}
          <div style={{ backgroundColor: '#F0F7FF', borderRadius: '8px', border: '1px solid #B9DDFF', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', color: '#1E3A8A', fontSize: '18px', fontWeight: 'bold' }}>ĐÁNH GIÁ NỘI DUNG BÁO CÁO</h3>
              <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>Xem xét thông tin và đưa ra quyết định</p>
            </div>

            <button
              disabled={submitting}
              onClick={() => handleButtonClick('Approved')}
              style={{ width: '100%', height: '64px', backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px', padding: '0 20px', cursor: submitting ? 'not-allowed' : 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '16px' }}>✓</div>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>Phê duyệt báo cáo</span>
            </button>

            <button
              disabled={submitting}
              onClick={() => handleButtonClick('Rejected')}
              style={{ width: '100%', height: '64px', backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px', padding: '0 20px', cursor: submitting ? 'not-allowed' : 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '16px' }}>✕</div>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>Từ chối báo cáo</span>
            </button>

            <button
              disabled={submitting}
              onClick={() => handleButtonClick('RequestInfo')}
              style={{ width: '100%', height: '64px', backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px', padding: '0 20px', cursor: submitting ? 'not-allowed' : 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#E9D5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A855F7', fontSize: '18px' }}>📄</div>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>Yêu cầu bổ sung</span>
            </button>

            <div style={{ marginTop: '8px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#1E293B', marginBottom: '8px' }}>
                Ghi chú (không bắt buộc)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập nội dung cần thiết"
                style={{ width: '100%', height: '110px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '12px', fontSize: '14px', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

        </div>

      </div>

      {/* 🌟 3. POPUP MODAL: Ý KIẾN PHẢN HỒI (CHỈ HIỂN THỊ KHI TỪ CHỐI HOẶC YÊU CẦU BỔ SUNG) */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white', width: '440px', borderRadius: '12px',
            padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            boxSizing: 'border-box', position: 'relative'
          }}>
            {/* Tiêu đề Modal */}
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#1E293B' }}>
              Ý kiến phản hồi <span style={{ color: '#EF4444' }}>*</span>
            </h3>

            {/* Ô nhập Nội dung phản hồi */}
            <textarea
              value={modalFeedback}
              onChange={(e) => setModalFeedback(e.target.value)}
              placeholder="Nhập nội dung phản hồi..."
              style={{
                width: '100%', height: '160px', borderRadius: '6px', border: '1px solid #CBD5E1',
                padding: '12px', fontSize: '14px', fontFamily: 'inherit', resize: 'none',
                boxSizing: 'border-box', marginBottom: '24px'
              }}
            />

            {/* Thanh chứa các nút hành động */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  flex: 1, height: '38px', backgroundColor: '#4F73C5', color: 'white',
                  border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleModalConfirm}
                style={{
                  flex: 1, height: '38px', backgroundColor: '#4F73C5', color: 'white',
                  border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}