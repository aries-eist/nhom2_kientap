'use client'
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import '@/app/layout-styles.css';

function EditReportFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Bóc tách mã báo cáo từ thanh URL (Ví dụ: ?id=REP-0005)
  const reportIdFromUrl = searchParams.get('id');

  // Quản lý trạng thái tải form và trạng thái nút bấm gửi
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Khởi tạo State lưu trữ dữ liệu form trống ban đầu
  const [formData, setFormData] = useState({
    report_id: '',
    incident_type_id: 'UC', // Mặc định khớp mã khóa ngoại UC, UA, NM trong database
    location: '',
    occurred_date: '',
    occurred_time: '',
    short_description: '',
    detailed_description: '',
    initial_action: ''
  });

  const [imageEvidence, setImageEvidence] = useState<string | null>(null);

  // 1. useEffect kéo dữ liệu thật từ database đổ vào Form khi mở trang
  useEffect(() => {
    if (!reportIdFromUrl) return;

    async function fetchReportDetail() {
      try {
        setLoading(true);
        // Gọi tới API lấy chi tiết báo cáo chuẩn chỉnh (không có s)
        const res = await fetch(`/api/reports/detail?id=${reportIdFromUrl}`);
        if (!res.ok) throw new Error("Không thể tải thông tin báo cáo");
        
        const data = await res.json();
        
        // Tách chuỗi thời gian occurred_at từ Database (YYYY-MM-DDTHH:mm:ss...) thành Ngày và Giờ riêng lẻ cho form
        const rawDate = data.occurred_at ? data.occurred_at.split('T')[0] : '';
        const rawTime = data.occurred_at ? data.occurred_at.split('T')[1]?.substring(0, 5) : '';

        // Đổ toàn bộ dữ liệu thật vào State form đúng thuộc tính của bảng
        setFormData({
          report_id: data.report_id,
          incident_type_id: data.incident_type_id || 'UC',
          location: data.location || '',
          occurred_date: rawDate,
          occurred_time: rawTime,
          short_description: data.short_description || '',
          detailed_description: data.long_description || '', // Khớp với trường long_description trong DB
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 2. Hàm Lưu - Sửa triệt để lỗi 404 bằng cách đẩy trúng về API detail phương thức PUT
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
      
      // Gộp ngày và giờ lại thành chuỗi ISO chuẩn cơ sở dữ liệu timestamp để thỏa mãn cột datetime NOT NULL
      let combinedOccurredAt = '';
      try {
        combinedOccurredAt = new Date(`${formData.occurred_date}T${formData.occurred_time}:00`).toISOString();
      } catch (e) {
        alert("Định dạng ngày giờ không hợp lệ, vui lòng kiểm tra lại!");
        setIsSaving(false);
        return;
      }

      // 💡 ĐÃ ĐỔI: Gọi chính xác vào link /api/reports/detail?id=... (Đồng bộ khớp API xử lý của bạn)
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
        // Nếu database cập nhật thành công, mở Modal thông báo cho người dùng
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
    <main className='main-content' style={{ backgroundColor: '#F0F4F8', minHeight: '100vh', position: 'relative', boxSizing: 'border-box' }}>
      
      {/* 1. THANH HEADER TOPBAR */}
      <header className='topbar'>
        <div className='bell'>
          🔔<span className='notice-number'>1</span>
        </div>
        <div className='user-profile'>
          <div className='avatar-box'>
            <img src="/avatar-pink.JPEG" alt="avatar" className='avatar-img'/>
          </div>
          <div className='user-info'>
            <div className='user-name'>Họ và tên</div>
            <div className='user-role'>Vị trí</div>
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
      <div style={{ padding: '24px 32px' }}>
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

        {/* 💡 ĐÃ SỬA: Khối nút chức năng dưới cùng căn phải luôn chứa cả 2 nút Lưu và Quay về danh sách màu Indigo (#4460A0) */}
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