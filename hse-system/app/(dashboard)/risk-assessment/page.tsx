'use client'
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import '@/app/layout-styles.css';

function RiskAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id') || 'REP-0005';

  // 1. Quản lý các State dữ liệu hệ thống
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [hazard, setHazard] = useState('Rò rỉ khí gas');
  const [likelihood, setLikelihood] = useState(3);
  const [severity, setSeverity] = useState(3);

  // 2. Tự động tải thông tin chi tiết báo cáo dựa trên reportId
  useEffect(() => {
    async function fetchReportDetail() {
      setLoading(true);
      try {
        const response = await fetch(`/api/reports/detail?id=${reportId}`);
        if (!response.ok) throw new Error('Không thể tải dữ liệu');
        const data = await response.json();
        setReport(data);
      } catch (error) {
        console.error('Lỗi fetch API:', error);
        // Fallback dữ liệu mẫu hiển thị trực quan nếu chưa có API backend
        setReport({
          report_id: reportId,
          status: 'Approved',
          incident_type_id: 'Unsafe Condition',
          location: 'Khu đường ống',
          description: 'Phát hiện có mùi khí lạ gần van số 03.',
          image_url: '/avatar-pink.JPEG'
        });
      } finally {
        setLoading(false);
      }
    }
    fetchReportDetail();
  }, [reportId]);

  // 3. Logic tính toán điểm rủi ro (Khả năng xảy ra x Mức độ nghiêm trọng)
  const riskScore = likelihood * severity;

  // Cấu hình phân bổ dải điểm mới: 
  // 1-5: Thấp (Xanh lá), 6-12: Trung bình (Vàng), 13-19: Cao (Cam), 20-25: Khẩn cấp (Đỏ)
  const getPriorityConfig = (score: number) => {
    if (score >= 20) return { label: 'Khẩn cấp', color: '#FF0000', bg: '#FFEBEB' };
    if (score >= 13) return { label: 'Cao', color: '#E25822', bg: '#FFF0E6' };
    if (score >= 6) return { label: 'Trung bình', color: '#CC9A00', bg: '#FFFCE6' };
    return { label: 'Thấp', color: '#27AE60', bg: '#E6F9ED' };
  };

  const priority = getPriorityConfig(riskScore);

  // 4. Bản đồ màu ma trận lưới 5x5 động khớp chính xác theo từng giá trị tích số điểm số mới
  const matrixColorMap: Record<string, string> = {
    // Hàng 5 (Khả năng xảy ra = 5)
    '5-1': '#27AE60', // 5  -> Thấp
    '5-2': '#FFF59D', // 10 -> Trung bình
    '5-3': '#E25822', // 15 -> Cao
    '5-4': '#FF0000', // 20 -> Khẩn cấp
    '5-5': '#FF0000', // 25 -> Khẩn cấp

    // Hàng 4 (Khả năng xảy ra = 4)
    '4-1': '#27AE60', // 4  -> Thấp
    '4-2': '#FFF59D', // 8  -> Trung bình
    '4-3': '#FFF59D', // 12 -> Trung bình
    '4-4': '#E25822', // 16 -> Cao
    '4-5': '#FF0000', // 20 -> Khẩn cấp

    // Hàng 3 (Khả năng xảy ra = 3)
    '3-1': '#27AE60', // 3  -> Thấp
    '3-2': '#FFF59D', // 6  -> Trung bình
    '3-3': '#FFF59D', // 9  -> Trung bình
    '3-4': '#FFF59D', // 12 -> Trung bình
    '3-5': '#E25822', // 15 -> Cao

    // Hàng 2 (Khả năng xảy ra = 2)
    '2-1': '#27AE60', // 2  -> Thấp
    '2-2': '#27AE60', // 4  -> Thấp
    '2-3': '#FFF59D', // 6  -> Trung bình
    '2-4': '#FFF59D', // 8  -> Trung bình
    '2-5': '#FFF59D', // 10 -> Trung bình

    // Hàng 1 (Khả năng xảy ra = 1)
    '1-1': '#27AE60', // 1  -> Thấp
    '1-2': '#27AE60', // 2  -> Thấp
    '1-3': '#27AE60', // 3  -> Thấp
    '1-4': '#27AE60', // 4  -> Thấp
    '1-5': '#27AE60', // 5  -> Thấp
  };

  // 5. Hàm xử lý nút Lưu dữ liệu
  const handleSaveAssessment = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/risks/save-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: reportId,
          hazard,
          likelihood,
          severity,
          risk_score: riskScore,
          priority: priority.label
        })
      });
      alert('Lưu thông tin đánh giá rủi ro thành công!');
      router.push('/risks/pending-evaluations');
    } catch (error) {
      console.error(error);
      alert('[Giả lập] Đã lưu thông tin đánh giá thành công!');
      router.push('/risks/pending-evaluations');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className='main-content'>
      {/* Khối Topbar */}
      <header className='topbar'>
        <div className='bell'>🔔<span className='notice-number'>1</span></div>
        <div className='user-profile'>
          <div className='avatar-box'><img src="/avatar-pink.JPEG" alt="avatar" className='avatar-img'/></div>
          <div className='user-info'>
            <div className='user-name'>Họ và tên</div>
            <div className='user-role'>Vị trí</div>
          </div>
        </div>
      </header>

      {/* Khối điều hướng phụ (Second Bar) */}
      <div className='second-bar' style={{ padding: '14px 32px' }}>
        <h2 className='second-bar-content' style={{ margin: 0, fontWeight: 'bold', color: '#000000', fontSize: '15px' }}>
          Quản lý rủi ro &gt; Đánh giá rủi ro
        </h2>
      </div>

      {/* Vùng Content chính */}
      <div className='report-content' style={{ padding: '24px 32px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontStyle: 'italic', fontSize: '13px' }}>
            Đang tải dữ liệu báo cáo...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px', alignItems: 'start', width: '100%' }}>
            
            {/* PHẦN BÊN TRÁI: THÔNG TIN TÓM TẮT BÁO CÁO */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ color: '#004B87', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', margin: '0 0 20px 0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Thông tin báo cáo
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', color: '#1E293B' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{report?.report_id}</span>
                  <span style={{ backgroundColor: '#EBF3FF', color: '#2F80ED', border: '1px solid #B3D4FF', padding: '3px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                    Đã phê duyệt
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0F172A' }}>Loại sự cố:</span>
                  <span style={{ color: '#475569' }}>{report?.incident_type_id}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0F172A' }}>Địa điểm:</span>
                  <span style={{ color: '#475569' }}>{report?.location}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0F172A' }}>Mô tả sự cố:</span>
                  <span style={{ color: '#475569', lineHeight: '1.5' }}>{report?.description}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0F172A' }}>Ảnh hiện trường:</span>
                  <img 
                    src={report?.image_url} 
                    alt="Hiện trường" 
                    style={{ width: '100px', height: '100px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #E2E8F0' }} 
                  />
                </div>
              </div>
            </div>

            {/* PHẦN BÊN PHẢI: KHỐI FORM ĐÁNH GIÁ & ĐỒ HỌA MA TRẬN ĐỘNG */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: '32px', alignItems: 'start' }}>
                
                {/* Khu vực Input điều khiển select-box */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ color: '#004B87', margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Đánh giá rủi ro
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1E293B' }}>Mối nguy <span style={{ color: 'red' }}>*</span></label>
                    <select value={hazard} onChange={(e) => setHazard(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13.5px', backgroundColor: 'white', color: '#334155', outline: 'none' }}>
                      <option value="Rò rỉ khí gas">Rò rỉ khí gas</option>
                      <option value="Chập điện">Chập điện đầu van</option>
                      <option value="Trơn trượt">Trơn trượt cơ học</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1E293B' }}>Khả năng xảy ra <span style={{ color: 'red' }}>*</span></label>
                    <select value={likelihood} onChange={(e) => setLikelihood(Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13.5px', backgroundColor: 'white', color: '#334155', outline: 'none', fontWeight: '500' }}>
                      {[1, 2, 3, 4, 5].map((num) => <option key={num} value={num}>{num}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1E293B' }}>Mức độ nghiêm trọng <span style={{ color: 'red' }}>*</span></label>
                    <select value={severity} onChange={(e) => setSeverity(Number(e.target.value))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13.5px', backgroundColor: 'white', color: '#334155', outline: 'none', fontWeight: '500' }}>
                      {[1, 2, 3, 4, 5].map((num) => <option key={num} value={num}>{num}</option>)}
                    </select>
                  </div>
                </div>

                {/* Khu vực hiển thị Ma trận 5x5 trực quan */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '20px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '16px', color: '#1E293B' }}>Ma trận rủi ro</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', fontSize: '10px', color: '#64748B', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      Khả năng xảy ra
                    </div>
                    <div>
                      <div style={{ display: 'grid', gridTemplateRows: 'repeat(5, 36px)', gap: '4px' }}>
                        {[5, 4, 3, 2, 1].map((rowY) => (
                          <div key={rowY} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ width: '14px', fontSize: '11px', color: '#64748B', fontWeight: 'bold', textAlign: 'right', marginRight: '4px' }}>{rowY}</span>
                            {[1, 2, 3, 4, 5].map((colX) => {
                              const cellColor = matrixColorMap[`${rowY}-${colX}`];
                              const isCurrentSelection = likelihood === rowY && severity === colX;
                              return (
                                <div
                                  key={colX}
                                  style={{
                                    width: '42px', height: '36px', backgroundColor: cellColor, borderRadius: '3px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold',
                                    color: isCurrentSelection ? '#000000' : 'rgba(0,0,0,0.25)',
                                    border: isCurrentSelection ? '3px solid #000000' : 'none', boxSizing: 'border-box',
                                    transition: 'all 0.1s ease'
                                  }}
                                >
                                  {rowY * colX}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', paddingLeft: '22px', marginTop: '6px' }}>
                        {[1, 2, 3, 4, 5].map((num) => <span key={num} style={{ width: '42px', textAlign: 'center', fontSize: '11px', color: '#64748B', fontWeight: 'bold' }}>{num}</span>)}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748B', fontWeight: 'bold', letterSpacing: '1px', marginTop: '4px', textTransform: 'uppercase', paddingLeft: '20px' }}>
                        Mức độ nghiêm trọng
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bảng tổng hợp Kết quả Điểm & Mức độ ưu tiên */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #E2E8F0', borderRadius: '6px', overflow: 'hidden', marginTop: '8px' }}>
                <div style={{ padding: '16px', borderRight: '1px solid #E2E8F0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#004B87', textTransform: 'uppercase' }}>Mức độ rủi ro</span>
                  <span style={{ fontSize: '32px', fontWeight: 'bold', color: priority.color }}>{riskScore}</span>
                </div>
                <div style={{ padding: '16px', backgroundColor: priority.bg, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#004B87', textTransform: 'uppercase' }}>Mức độ ưu tiên</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: priority.color }}>{priority.label}</span>
                </div>
              </div>

              {/* Thanh công cụ lưu */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  disabled={submitting} onClick={handleSaveAssessment}
                  style={{ backgroundColor: '#4F46E5', color: 'white', border: 'none', padding: '10px 36px', fontSize: '13.5px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {submitting ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Khử lỗi routing bằng Suspense
export default function RiskAssessmentPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Đang khởi tạo cấu trúc...</div>}>
      <RiskAssessmentContent />
    </Suspense>
  );
}