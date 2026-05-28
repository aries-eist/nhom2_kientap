'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AcceptancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const reportId = searchParams.get('reportId');

  // --- States Dữ liệu ---
  const [reportData, setReportData] = useState<any>(null);
  const [taskData, setTaskData] = useState<any>(null);
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- States Form Nghiệm Thu ---
  const [acceptanceStatus, setAcceptanceStatus] = useState<'passed' | 'failed'>('passed');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- States Header & Profile ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // Helper sinh ID ngẫu nhiên cho bảng kiểm toán dữ liệu (Tương thích PK varchar)
  const generateUUIDLikeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // 1. Fetch thông tin Người dùng & Hồ sơ cá nhân cho Topbar
  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUser(user);
        
        const { data, error } = await supabase
          .from('PROFILES')
          .select('full_name, department')
          .eq('profile_id', user.id)
          .maybeSingle();
          
        if (error) console.error("Lỗi lấy thông tin Profile:", error.message);
        if (data) setProfile(data);
      } catch (err) {
        console.error("Lỗi xác thực người dùng:", err);
      }
    }
    getProfile();
  }, []);

  // 2. Lấy thông tin chi tiết tích hợp hệ thống để nghiệm thu
  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        const { data: report, error: reportError } = await supabase
          .from('INCIDENT_REPORT')
          .select('*')
          .eq('report_id', reportId)
          .maybeSingle();

        if (reportError) {
          console.error("Lỗi truy vấn INCIDENT_REPORT từ Supabase:", reportError.message);
        }

        const { data: task, error: taskError } = await supabase
          .from('CAPA_TASK')
          .select('*')
          .eq('report_id', reportId)
          .maybeSingle();

        if (taskError) {
          console.error("Lỗi truy vấn CAPA_TASK từ Supabase:", taskError.message);
        }

        setReportData(report);
        setTaskData(task);

        if (task) {
          const { data: evidences } = await supabase
            .from('TASK_EVIDENCE')
            .select('image_url')
            .eq('task_id', task.task_id);
          
          if (evidences) {
            setEvidenceImages(evidences.map((e: any) => e.image_url));
          }

          const { data: logs } = await supabase
            .from('ACTIVITY_LOG')
            .select('*')
            .eq('task_id', task.task_id)
            .order('created_at', { ascending: true });

          if (logs && logs.length > 0) {
            setTimelineData(logs);
          }
        }
      } catch (err) {
        console.error("Lỗi không xác định khi lấy hồ sơ nghiệm thu:", err);
      } finally {
        setLoading(false); 
      }
    }
    fetchData();
  }, [reportId]);

  // 3. Xử lý nút Xác nhận Nghiệm thu ghi dữ liệu Đa Bảng (Tích hợp xử lý chèn chuỗi tự động)
  const handleConfirm = async () => {
    if (!taskData?.task_id || !currentUser?.id) {
      alert("⚠️ Thiếu thông tin định danh Task hoặc phiên đăng nhập của bạn đã hết hạn! Vui lòng đăng nhập lại.");
      return;
    }

    if (acceptanceStatus === 'failed' && !comment.trim()) {
      alert("⚠️ Quy định hệ thống: Vui lòng nhập nhận xét/lý do chi tiết khi đánh giá KHÔNG ĐẠT!");
      return;
    }

    setSubmitting(true);
    const nowISO = new Date().toISOString();

    // 💡 LOGIC CHÈN CHỮ TỰ ĐỘNG THEO YÊU CẦU:
    let finalFeedback = "";
    if (acceptanceStatus === 'passed') {
      finalFeedback = comment.trim() 
        ? `Công việc hoàn thành đạt yêu cầu. Ghi chú thêm: ${comment.trim()}` 
        : "Công việc hoàn thành đạt yêu cầu";
    } else {
      finalFeedback = `Công việc chưa đạt yêu cầu. Lý do chi tiết: ${comment.trim()}`;
    }

    try {
      const newStatus = acceptanceStatus === 'passed' ? 'Completed' : 'In_Progress';
      
      // HÀNH ĐỘNG 1: Cập nhật trạng thái và phản hồi tự động vào bảng CAPA_TASK
      const { error: taskError } = await supabase
        .from('CAPA_TASK')
        .update({ 
          status: newStatus,
          coordinator_feedback: finalFeedback,
          updated_at: nowISO
        })
        .eq('task_id', taskData.task_id);

      if (taskError) throw taskError;

      // HÀNH ĐỘNG 2: Nếu nghiệm thu đạt (Passed) -> Tự động đóng Hồ sơ sự cố gốc (INCIDENT_REPORT)
      if (acceptanceStatus === 'passed') {
        const { error: reportError } = await supabase
          .from('INCIDENT_REPORT')
          .update({
            status: 'closed', 
            closed_by: currentUser.id,
            closed_at: nowISO
          })
          .eq('report_id', reportId);

        if (reportError) throw reportError;
      }

      // HÀNH ĐỘNG 3: Ghi nhận vết hành động kèm chuỗi nội dung vào bảng ACTIVITY_LOG
      const { error: logError } = await supabase
        .from('ACTIVITY_LOG')
        .insert({
          log_id: generateUUIDLikeId('LOG'),
          user_id: currentUser.id,
          report_id: reportId,
          task_id: taskData.task_id,
          action: acceptanceStatus === 'passed' ? 'Nghiệm thu Đạt' : 'Từ chối nghiệm thu',
          old_value: taskData.status,
          new_value: newStatus,
          description: `HSE đánh giá kết quả: ${finalFeedback}`,
          created_at: nowISO
        });

      if (logError) throw logError;

      alert("🎉 Đồng bộ dữ liệu nghiệm thu và chèn nội dung đánh giá thành công!");
      router.push('/capa/my-tasks');
    } catch (err: any) {
      alert("❌ Lỗi đồng bộ DB: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '15px', color: '#64748B', fontFamily: 'sans-serif' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTop: '4px solid #4C6FC2', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '15px', fontWeight: '500' }}>Đang tải thông tin hồ sơ nghiệm thu kỹ thuật...</div>
      </div>
    );
  }

  return (
    <main style={{ backgroundColor: '#F0F4F8', minHeight: '100vh', padding: '0 40px 40px 40px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER TOPBAR */}
      <header style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '15px 0', gap: '20px' }}>
        <div style={{ fontSize: '20px', cursor: 'pointer' }}>🔔</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1E293B' }}>{profile?.full_name || 'Thành viên HSE'}</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>{profile?.department || 'HSE Coordinator'}</div>
          </div>
          <div style={{ width: '35px', height: '35px', borderRadius: '50%', overflow: 'hidden' }}>
            <img src="/avatar-pink.JPEG" alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' }}/>
          </div>
        </div>
      </header>

      {/* TIÊU ĐỀ TRANG */}
      <div style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1E293B', margin: 0 }}>
          Quản lý CAPA <span style={{ color: '#64748B', fontWeight: 'normal', margin: '0 4px' }}>&gt;</span> Nghiệm thu tác vụ
        </h2>
      </div>

      {/* GRID CHÍNH: 2 CỘT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* CỘT TRÁI: THÔNG TIN VÀ KẾT QUẢ XỬ LÝ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* KHỐI: THÔNG TIN BÁO CÁO (Đã đổi tên) */}
          <section style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'left' }}>
            <h3 style={{ color: '#00468C', fontSize: '15px', fontWeight: 'bold', borderBottom: '1px solid #EDF2F7', paddingBottom: '12px', marginBottom: '20px', textTransform: 'uppercase' }}>
              Thông tin báo cáo
            </h3>
            {reportData ? (
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '15px', fontSize: '14px' }}>
                <div style={{ fontWeight: 'bold', color: '#374151' }}>Mã báo cáo:</div>
                <div style={{ fontWeight: '600', color: '#00468C' }}>{reportData.report_id}</div>
                
                <div style={{ fontWeight: 'bold', color: '#374151' }}>Loại sự cố:</div>
                <div>{reportData.incident_type_id === 'UC' ? '⚡ Unsafe Condition (Điều kiện không an toàn)' : '⚠️ Unsafe Act (Hành vi không an toàn)'}</div>
                
                <div style={{ fontWeight: 'bold', color: '#374151' }}>Địa điểm:</div>
                <div>{reportData.location || 'Chưa định vị'}</div>
                
                <div style={{ fontWeight: 'bold', color: '#374151' }}>Mô tả ngắn:</div>
                <div style={{ color: '#4A5568' }}>{reportData.short_description || 'Không có mô tả dữ liệu.'}</div>

                <div style={{ fontWeight: 'bold', color: '#374151' }}>Ngày đến hạn:</div>
                <div style={{ color: '#EF4444', fontWeight: '500' }}>{taskData?.due_date ? new Date(taskData.due_date).toLocaleDateString('vi-VN') : 'Chưa thiết lập ngày hạn'}</div>
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: '#EF4444', padding: '10px', backgroundColor: '#FEF2F2', borderRadius: '6px' }}>
                ⚠️ Không tìm thấy thông tin của mã báo cáo <strong>"{reportId}"</strong> trong hệ thống. Vui lòng kiểm tra lại data.
              </div>
            )}
          </section>

          {/* KHỐI: KẾT QUẢ XỬ LÝ (Đã đổi tên) */}
          <section style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'left' }}>
            <h3 style={{ color: '#00468C', fontSize: '15px', fontWeight: 'bold', borderBottom: '1px solid #EDF2F7', paddingBottom: '12px', marginBottom: '20px', textTransform: 'uppercase' }}>
              Kết quả xử lý
            </h3>
            <div style={{ fontSize: '14px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>Nội dung chi tiết phương án khắc phục:</div>
              <p style={{ color: '#4A5568', lineHeight: '1.6', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '6px', border: '1px solid #E2E8F0', margin: 0 }}>
                {taskData?.task_content || "Chưa có ghi chú nội dung khắc phục cụ thể cho tác vụ này từ kỹ sư đảm nhiệm."}
              </p>
              
              <div style={{ fontWeight: 'bold', margin: '20px 0 10px 0', color: '#374151' }}>Hình ảnh minh chứng hiện trường (Evidence):</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {evidenceImages.length > 0 ? (
                  evidenceImages.map((url, i) => (
                    <div key={i} style={{ width: '110px', height: '110px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      <img src={url} alt={`Evidence ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '13px', color: '#94A3B8', fontStyle: 'italic', padding: '10px 0' }}>💡 Chưa tải ảnh minh chứng thực địa lên hệ thống.</div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* CỘT PHẢI: FORM ĐÁNH GIÁ VÀ LỊCH SỬ LOG */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* KHỐI: NGHIỆM THU (Đã đổi tên) */}
          <section style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'left' }}>
            <h3 style={{ color: '#00468C', fontSize: '15px', fontWeight: 'bold', borderBottom: '1px solid #EDF2F7', paddingBottom: '12px', marginBottom: '20px', textTransform: 'uppercase' }}>
              Nghiệm thu
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Option Đạt */}
              <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '6px', border: acceptanceStatus === 'passed' ? '1px solid #10B981' : '1px solid #E2E8F0', backgroundColor: acceptanceStatus === 'passed' ? '#F0FDF4' : 'transparent', transition: 'all 0.2s' }}>
                <input 
                  type="radio" 
                  name="status" 
                  checked={acceptanceStatus === 'passed'} 
                  onChange={() => setAcceptanceStatus('passed')}
                  style={{ marginTop: '4px', accentColor: '#10B981' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#14532D' }}>ĐẠT</div>
                  <div style={{ fontSize: '12px', color: '#15803D', marginTop: '2px' }}>Công việc hoàn thành đạt yêu cầu.</div>
                </div>
              </label>

              {/* Option Không đạt */}
              <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '6px', border: acceptanceStatus === 'failed' ? '1px solid #EF4444' : '1px solid #E2E8F0', backgroundColor: acceptanceStatus === 'failed' ? '#FEF2F2' : 'transparent', transition: 'all 0.2s' }}>
                <input 
                  type="radio" 
                  name="status" 
                  checked={acceptanceStatus === 'failed'} 
                  onChange={() => setAcceptanceStatus('failed')}
                  style={{ marginTop: '4px', accentColor: '#EF4444' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#7A1515' }}>KHÔNG ĐẠT (Từ chối)</div>
                  <div style={{ fontSize: '12px', color: '#991B1B', marginTop: '2px' }}>Công việc chưa đạt yêu cầu</div>
                </div>
              </label>

              {/* Ô Nhận xét */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', color: '#374151' }}>
                  Ý kiến nhận xét bổ sung {acceptanceStatus === 'failed' && <span style={{ color: '#EF4444', fontWeight: 'bold' }}>(Bắt buộc nhập lý do chi tiết)</span>}
                </label>
                <textarea 
                  placeholder={acceptanceStatus === 'passed' ? 'Nhập ghi chú nghiệm thu thêm nếu có (tùy chọn)...' : 'Vui lòng chỉ rõ những lỗi kỹ thuật/vị trí cụ thể cần khắc phục lại...'}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '14px', height: '90px', outline: 'none', boxSizing: 'border-box', resize: 'none', transition: 'border 0.2s' }}
                  onFocus={(e) => e.target.style.border = '1px solid #4C6FC2'}
                  onBlur={(e) => e.target.style.border = '1px solid #E2E8F0'}
                />
              </div>
            </div>
          </section>

          {/* KHỐI: LỊCH SỬ HOẠT ĐỘNG (Đã đổi tên) */}
          <section style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', flexGrow: 1, textAlign: 'left' }}>
            <h3 style={{ color: '#00468C', fontSize: '15px', fontWeight: 'bold', borderBottom: '1px solid #EDF2F7', paddingBottom: '12px', marginBottom: '20px', textTransform: 'uppercase' }}>
              Lịch sử hoạt động
            </h3>

            <div style={{ position: 'relative', paddingLeft: '30px' }}>
              <div style={{ position: 'absolute', left: '11px', top: '5px', bottom: '5px', width: '2px', backgroundColor: '#E2E8F0' }}></div>

              {timelineData.length > 0 ? (
                timelineData.map((log: any, index: number) => (
                  <div key={log.log_id || index} style={{ position: 'relative', marginBottom: '25px' }}>
                    <div style={{ position: 'absolute', left: '-25px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#4C6FC2', border: '4px solid white', boxShadow: '0 0 0 1px #E2E8F0' }}></div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E293B' }}>{log.action}</div>
                    <div style={{ fontSize: '12px', color: '#718096', margin: '2px 0' }}>{new Date(log.created_at).toLocaleString('vi-VN')}</div>
                    <div style={{ fontSize: '13px', color: '#4A5568', backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{log.description}</div>
                  </div>
                ))
              ) : (
                <>
                  <div style={{ position: 'relative', marginBottom: '20px' }}>
                    <div style={{ position: 'absolute', left: '-25px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#4C6FC2', border: '4px solid white', boxShadow: '0 0 0 1px #E2E8F0' }}></div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>Khởi tạo tác vụ thành công</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Hệ thống tự động kích hoạt tiến trình khắc phục CAPA.</div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-25px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#F59E0B', border: '4px solid white', boxShadow: '0 0 0 1px #FDE68A' }}></div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#D97706' }}>Chờ phê duyệt nghiệm thu</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Assignee báo cáo hoàn thành hiện trường, chuyển hồ sơ trạng thái chờ kiểm tra.</div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* NÚT ĐIỀU HƯỚNG CUỐI TRANG */}
      <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px', borderTop: '1px solid #E2E8F0', padding: '20px 0 0 0' }}>
        <button 
          onClick={() => router.back()}
          disabled={submitting}
          style={{ padding: '10px 35px', borderRadius: '6px', border: '1px solid #94A3B8', color: '#475569', backgroundColor: 'white', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#F1F5F9'}
          onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'white'}>
          Quay lại
        </button>
        <button 
          onClick={handleConfirm}
          disabled={submitting || !reportData}
          style={{ padding: '10px 35px', borderRadius: '6px', border: 'none', color: 'white', backgroundColor: !reportData ? '#94A3B8' : '#4C6FC2', cursor: !reportData ? 'not-allowed' : 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(76, 111, 194, 0.2)', transition: 'all 0.2s' }}
          onMouseEnter={(e) => { if(reportData) (e.target as HTMLButtonElement).style.backgroundColor = '#3B5998' }}
          onMouseLeave={(e) => { if(reportData) (e.target as HTMLButtonElement).style.backgroundColor = '#4C6FC2' }}>
          {submitting ? "Đang ghi nhận..." : "Xác nhận kết quả"}
        </button>
      </footer>

    </main>
  );
}