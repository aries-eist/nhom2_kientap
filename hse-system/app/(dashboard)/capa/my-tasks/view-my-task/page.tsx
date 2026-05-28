'use client'
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function ViewMyTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const idParam = searchParams.get('id'); // Nhận task_id hoặc report_id từ URL

  // --- States Dữ liệu từ các bảng ---
  const [taskData, setTaskData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- States Thao tác hiện trường ---
  const [currentStatus, setCurrentStatus] = useState('Not_Started');
  const [progressNote, setProgressNote] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- States Thông tin Người dùng Đăng nhập ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' };
  const asteriskStyle = { color: '#EF4444', marginLeft: '4px' };

  // Helper sinh ID ngẫu nhiên cho các bảng kiểm toán dữ liệu (Tương thích PK varchar)
  const generateUUIDLikeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // --- 1. Fetch thông tin Người dùng & Hồ sơ cá nhân ---
  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);
      
      const { data } = await supabase
        .from('PROFILES')
        .select('full_name, department')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (data) setProfile(data);
    }
    getProfile();
  }, []);

  // --- 2. Fetch tích hợp dữ liệu hệ thống tương thích DB ---
  useEffect(() => {
    if (!idParam) return;

    async function fetchTaskDetails() {
      setLoading(true);
      try {
        // Bước A: Lấy thông tin từ bảng CAPA_TASK
        let { data: task } = await supabase
          .from('CAPA_TASK')
          .select('*')
          .or(`task_id.eq.${idParam},report_id.eq.${idParam}`)
          .maybeSingle();

        if (task) {
          setTaskData(task);
          setCurrentStatus(task.status || 'Not_Started');
          setProgressNote(task.task_content || '');

          // Bước B: Lấy danh sách ảnh minh chứng tương ứng từ bảng TASK_EVIDENCE
          const { data: evidences } = await supabase
            .from('TASK_EVIDENCE')
            .select('image_url')
            .eq('task_id', task.task_id);
          
          if (evidences) {
            setUploadedImages(evidences.map((e: any) => e.image_url));
          }

          // Bước C: Lấy thông tin báo cáo cốt lõi từ INCIDENT_REPORT
          if (task.report_id) {
            const { data: report } = await supabase
              .from('INCIDENT_REPORT')
              .select('*')
              .eq('report_id', task.report_id)
              .maybeSingle();
            setReportData(report);

            // Bước D: Lấy Mức độ ưu tiên & Mô tả từ RISK_ASSESSMENT
            const { data: risk } = await supabase
              .from('RISK_ASSESSMENT')
              .select('priority, description')
              .eq('report_id', task.report_id)
              .maybeSingle();
            setRiskData(risk);
          }

          // Bước E: Đồng bộ dữ liệu Lịch sử log động lên giao diện
          const { data: logs } = await supabase
            .from('ACTIVITY_LOG')
            .select('*')
            .eq('task_id', task.task_id)
            .order('created_at', { ascending: true });

          if (logs && logs.length > 0) {
            setTimelineData(logs.map((log: any, index: number) => ({
              id: index + 1,
              title: log.action,
              detail: log.description,
              actor: 'User/Hệ thống',
              time: new Date(log.created_at).toLocaleString('vi-VN'),
              done: true
            })));
          } else {
            setTimelineData([
              { id: 1, title: 'Not_Started', detail: 'Nhiệm vụ hệ thống khởi tạo', actor: 'Hệ thống', time: task.created_at ? new Date(task.created_at).toLocaleString('vi-VN') : '', done: true },
              { id: 2, title: 'In_Progress', detail: 'Assignee đang xử lý hiện trường', actor: 'Assignee', time: '', done: task.status !== 'Not_Started' },
              { id: 3, title: 'Pending_Approval', detail: 'Chờ nghiệm thu an toàn', actor: 'Assignee', time: '', done: task.status === 'Pending_Approval' || task.status === 'Completed' },
              { id: 4, title: 'Completed', detail: 'Nhiệm vụ hoàn thành', actor: 'HSE', time: '', done: task.status === 'Completed' }
            ]);
          }
        }
      } catch (err) {
        console.error("Lỗi liên kết dữ liệu hệ thống:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTaskDetails();
  }, [idParam]);

  // --- 3. Xử lý tải ảnh minh chứng lên Storage (Đã đổi tên sang bucket 'reports') ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    
    try {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `evidence-${Date.now()}.${fileExt}`; 

      // Gọi chuẩn xác đến tên bucket 'reports' của bồ
      const { error: uploadError } = await supabase.storage
        .from('reports') 
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // Lấy URL công khai chuẩn xác từ bucket 'reports'
      const { data: { publicUrl } } = supabase.storage
        .from('reports')
        .getPublicUrl(fileName);

      setUploadedImages(prev => [...prev, publicUrl]);
      
    } catch (err: any) {
      console.error("Lỗi upload thực tế:", err);
      alert(`Không thể tải ảnh lên: ${err.message || JSON.stringify(err)}`);
    } finally {
      setUploading(false);
    }
  };

  // --- 4. Thao tác ghi dữ liệu Đa Bảng (CAPA_TASK, TASK_EVIDENCE, ACTIVITY_LOG) ---
  const handleUpdateTask = async (forceToNghiemThu: boolean) => {
    if (!taskData?.task_id || !currentUser?.id) {
      alert("Thiếu thông tin định danh Task hoặc User Session! Vui lòng đăng nhập lại.");
      return;
    }

    // Chuyển đổi trạng thái tương thích ENUM Database
    const targetStatus = forceToNghiemThu ? 'Pending_Approval' : currentStatus;

    // Kiểm tra ràng buộc nghiệp vụ khi chuyển trạng thái Pending_Approval
    if (targetStatus === 'Pending_Approval' && uploadedImages.length === 0) {
      alert("⚠️ Quy định hệ thống: Bạn phải cung cấp ít nhất 1 hình ảnh hiện trường đã xử lý tại khung Ảnh minh chứng trước khi xin nghiệm thu!");
      return;
    }

    setSubmitting(true);
    try {
      const nowISO = new Date().toISOString();

      // HÀNH ĐỘNG 1: Cập nhật thông tin vào bảng CAPA_TASK
      const { error: taskError } = await supabase
        .from('CAPA_TASK')
        .update({
          status: targetStatus,
          task_content: progressNote,
          updated_at: nowISO
        })
        .eq('task_id', taskData.task_id);

      if (taskError) throw taskError;

      // HÀNH ĐỘNG 2: Xử lý dữ liệu ảnh minh chứng đồng bộ sang bảng TASK_EVIDENCE
      // Xóa các liên kết ảnh cũ của Task này để cập nhật lại danh sách mới chống trùng lặp
      await supabase.from('TASK_EVIDENCE').delete().eq('task_id', taskData.task_id);

      if (uploadedImages.length > 0) {
        const evidenceRecords = uploadedImages.map(url => ({
          evidence_id: generateUUIDLikeId('EVI'),
          task_id: taskData.task_id,
          image_url: url,
          uploaded_by: currentUser.id,
          uploaded_at: nowISO
        }));

        const { error: evidenceError } = await supabase.from('TASK_EVIDENCE').insert(evidenceRecords);
        if (evidenceError) throw evidenceError;
      }

      // HÀNH ĐỘNG 3: Ghi nhận vết hành động vào bảng ACTIVITY_LOG để minh bạch dữ liệu
      const { error: logError } = await supabase
        .from('ACTIVITY_LOG')
        .insert({
          log_id: generateUUIDLikeId('LOG'),
          user_id: currentUser.id,
          report_id: taskData.report_id || null,
          task_id: taskData.task_id,
          action: forceToNghiemThu ? 'Xin nghiệm thu' : 'Cập nhật tiến độ',
          old_value: taskData.status,
          new_value: targetStatus,
          description: `User thực hiện cập nhật nội dung ghi chú: "${progressNote}". Trạng thái chuyển đổi từ [${taskData.status}] sang [${targetStatus}].`,
          created_at: nowISO
        });

      if (logError) throw logError;

      alert(`Đồng bộ dữ liệu xử lý tác vụ thành công sang hệ thống cơ sở dữ liệu!`);
      router.push('/capa/my-tasks');
    } catch (err: any) {
      console.error("Lỗi đồng bộ DB:", err);
      alert(`Thao tác thất bại: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Đang kết xuất thông tin nhiệm vụ của bạn...</div>;
  }

  return (
    <main className='main-content' style={{ boxSizing: 'border-box', backgroundColor: '#F0F4F8', minHeight: '100vh', padding: '0 40px 40px 40px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER TOPBAR */}
      <header className='topbar' style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 0', backgroundColor: 'transparent', gap: '24px' }}>
        <div className='user-profile' style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className='avatar-box' style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden' }}>
            <img src="/avatar-pink.JPEG" alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' }}/>
          </div>
          <div className='user-info' style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <div className='user-name' style={{ fontWeight: 'bold', fontSize: '13px', color: '#1E293B' }}>{profile?.full_name || 'Họ và tên'}</div>
            <div className='user-role' style={{ fontSize: '11px', color: '#64748B' }}>{profile?.department || 'Vị trí'}</div>
          </div>
        </div>
      </header>

      {/* CONTAINER CHÍNH */}
      <div style={{ padding: '0 8px', boxSizing: 'border-box' }}>
        
        {/* TIÊU ĐỀ ĐIỀU HƯỚNG VỀ TRANG DANH SÁCH KHÁCH HÀNG */}
        <div className='second-bar' style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 0 24px 0' }}>
          <button onClick={() => router.push('/capa/my-tasks')} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', fontSize: '18px', fontWeight: 'bold', color: '#1E293B', cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: '24px', lineHeight: '1' }}>←</span> Quản lý CAPA <span style={{ color: '#64748B', fontWeight: 'normal', margin: '0 4px' }}>&gt;</span> Nhiệm vụ của tôi
          </button>
        </div>

        {/* KHU VỰC GRID CHIA 2 CỘT EQUAL LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* ==================== CỘT TRÁI ==================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* KHỐI: THÔNG TIN BÁO CÁO (INCIDENT_REPORT) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'left' }}>
              <h3 style={{ color: '#00468C', fontWeight: 'bold', fontSize: '16px', margin: '0 0 20px 0', letterSpacing: '0.5px' }}>THÔNG TIN BÁO CÁO</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', color: '#111827' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}><strong style={{ color: '#374151' }}>Mã báo cáo:</strong> <span>{reportData?.report_id || 'N/A'}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}><strong style={{ color: '#374151' }}>Loại sự cố:</strong> <span>{reportData?.incident_type_id || 'Unsafe Condition'}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}><strong style={{ color: '#374151' }}>Địa điểm:</strong> <span>{reportData?.location || 'Khu vực bồn chứa'}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}><strong style={{ color: '#374151' }}>Ngày đến hạn:</strong> <span>{reportData?.due_date ? new Date(reportData.due_date).toLocaleDateString('vi-VN') : '18/05/2026'}</span></div>
              </div>
            </div>

            {/* KHỐI: CẬP NHẬT TRẠNG THÁI (Ghi vào CAPA_TASK & TASK_EVIDENCE) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'left' }}>
              <h3 style={{ color: '#00468C', fontWeight: 'bold', fontSize: '16px', margin: '0 0 20px 0', letterSpacing: '0.5px' }}>CẬP NHẬT TRẠNG THÁI</h3>
              
              {/* Dropdown Trạng thái chuẩn ENUM DB */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Trạng thái hệ thống: <span style={asteriskStyle}>*</span></label>
                <select
                  value={currentStatus}
                  onChange={(e) => setCurrentStatus(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', backgroundColor: '#FFFFFF', color: '#374151', outline: 'none' }}
                >
                  <option value="Not_Started">Chưa thực hiện (Not_Started)</option>
                  <option value="In_Progress">Đang xử lý (In_Progress)</option>
                  <option value="Pending_Approval">Chờ nghiệm thu (Pending_Approval)</option>
                  <option value="Overdue">Quá hạn xử lý (Overdue)</option>
                  <option value="Completed">Hoàn thành nhiệm vụ (Completed)</option>
                </select>
              </div>

              {/* Ghi chú tiến độ (Lưu vào task_content) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Ghi chú tiến độ hành động: <span style={asteriskStyle}>*</span></label>
                <textarea
                  placeholder="Nhập diễn giải tiến độ thực tế xử lý sự cố tại hiện trường..."
                  rows={4}
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  style={{ width: '100%', padding: '12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Ảnh minh chứng hiện trường đã xử lý:<span style={asteriskStyle}>*</span></label>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                  
                  <label style={{ 
                    border: '1px dashed #CBD5E1', 
                    borderRadius: '4px', 
                    padding: '16px 24px', 
                    textAlign: 'center', 
                    backgroundColor: '#FFFFFF', 
                    width: '240px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    display: 'block'
                  }}>
                    <div style={{ fontSize: '24px', color: '#4460A0', marginBottom: '4px' }}>☁️</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{uploading ? 'Đang đẩy ảnh lên...' : 'Kéo thả ảnh vào đây hoặc'}</div>
                    <div style={{ fontSize: '13px', color: '#4460A0', fontWeight: '600', margin: '2px 0' }}>Chọn file từ thiết bị</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>Định dạng: JPG, PNG (tối đa 5MB)</div>
                    
                    {/* Thẻ input loại file ẩn quyết định mở tệp thiết bị */}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      disabled={uploading} 
                      style={{ display: 'none' }} 
                    />
                  </label>

                  {/* Vòng lặp kết xuất mảng ảnh Preview sau khi upload thành công */}
                  {uploadedImages.map((url, i) => (
                    <div key={i} style={{ position: 'relative', width: '90px', height: '90px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                      <img src={url} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        type="button" 
                        onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))} 
                        style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(15, 23, 42, 0.6)', color: 'white', border: 'none', width: '18px', height: '18px', borderRadius: '50%', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Khung vuông tượng trưng giữ nguyên layout */}
                  <div style={{ width: '90px', height: '90px', border: '1px dashed #CBD5E1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', backgroundColor: '#F8FAFC' }}>🖼️+</div>
                </div>
              </div>
            </div>

          </div>

          {/* ==================== CỘT PHẢI ==================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* KHỐI: MỨC ĐỘ & MÔ TẢ (RISK_ASSESSMENT) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'left' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#00468C', fontWeight: 'bold', fontSize: '16px', margin: '0 0 12px 0', letterSpacing: '0.5px' }}>MỨC ĐỘ ƯU TIÊN Biện Pháp</h3>
                <span style={{ display: 'inline-block', padding: '6px 16px', backgroundColor: '#FEF08A', color: '#854D0E', border: '1px solid #FDE047', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>
                  {riskData?.priority || 'Medium'}
                </span>
              </div>
              
              <div>
                <h3 style={{ color: '#00468C', fontWeight: 'bold', fontSize: '16px', margin: '0 0 12px 0', letterSpacing: '0.5px' }}>MÔ TẢ YÊU CẦU CÔNG VIỆC</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#4B5563', lineHeight: '1.6' }}>
                  {riskData?.description || 'Kiểm tra hệ thống van áp suất và khớp nối bồn chứa, tiến hành gia cố an toàn lao động.'}
                </p>
              </div>
            </div>

            {/* KHỐI: LỊCH SỬ TRẠNG THÁI (Mã hóa động kết xuất tự động từ ACTIVITY_LOG) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'left' }}>
              <h3 style={{ color: '#00468C', fontWeight: 'bold', fontSize: '16px', margin: '0 0 24px 0', letterSpacing: '0.5px' }}>LỊCH SỬ TRUY VẾT HỆ THỐNG</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '12px' }}>
                {timelineData.map((node) => (
                  <div key={node.id} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                    <div style={{ 
                      width: '24px', height: '24px', borderRadius: '50%', 
                      backgroundColor: node.done ? '#4C6FC2' : '#CBD5E1', 
                      color: node.done ? 'white' : '#64748B', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', zIndex: 2, fontWeight: 'bold' 
                    }}>
                      {node.id}
                    </div>
                    <div style={{ fontSize: '13px', color: node.done ? '#1E293B' : '#64748B' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold' }}>{node.title}</span>
                        <span style={{ fontSize: '11px', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>{node.actor}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{node.detail}</div>
                      {node.time && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', fontWeight: '500' }}>⏱ {node.time}</div>}
                    </div>
                  </div>
                ))}
                <div style={{ position: 'absolute', left: '23px', top: '12px', bottom: '12px', width: '2px', backgroundColor: '#E2E8F0', zIndex: 1 }} />
              </div>
            </div>

          </div>
        </div>

        {/* NÚT THAO TÁC ĐIỀU HƯỚNG CUỐI TRANG */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
          <button 
            onClick={() => router.push('/capa/my-tasks')} 
            style={{ padding: '10px 28px', backgroundColor: '#94A3B8', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
          >
            Hủy
          </button>
          
          <button 
            onClick={() => handleUpdateTask(false)}
            disabled={submitting} 
            style={{ padding: '10px 28px', backgroundColor: '#4C6FC2', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
          >
            {submitting ? 'Đang lưu...' : 'Cập nhật'}
          </button>

          <button 
            onClick={() => handleUpdateTask(true)}
            disabled={submitting} 
            style={{ padding: '10px 28px', backgroundColor: '#1E3A8A', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
          >
            {submitting ? 'Đang gửi...' : 'Nghiệm thu'}
          </button>
        </div>

      </div>
    </main>
  );
}