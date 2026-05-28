'use client'
import { useState, useRef } from 'react';
import '@/app/layout-styles.css';

// ... (Giữ nguyên Type TrendData và logic helper hàm format)

export default function HSEDashboardPage() {
  const [startDate, setStartDate] = useState('2026-03-31');
  const [endDate, setEndDate] = useState('2026-05-21');
  const [selectedCategory, setSelectedCategory] = useState('Khu vực sản xuất');
  const [trendType, setTrendType] = useState<'month' | 'quarter'>('month');

  const startInputRef = useRef<HTMLInputElement>(null);

  // Styles tối ưu
  const containerStyle = {
    width: '100%',
    maxWidth: '1400px', // Giới hạn chiều rộng để không bị loãng trên màn hình lớn
    margin: '0 auto',
    padding: '16px 24px',
    boxSizing: 'border-box' as const,
  };

  const cardStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    padding: '16px', // Giảm padding từ 20 xuống 16
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%', // Đảm bảo các card trong cùng hàng cao bằng nhau
    boxSizing: 'border-box' as const,
  };

  const cardHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px', // Giảm margin bottom
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#1E293B'
  };

  return (
    <main className="main-content" style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', overflowX: 'hidden' }}>
      
      {/* TOPBAR - Giữ nguyên nhưng thu gọn padding dọc */}
      <header className='topbar' style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', padding: '10px 32px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div className='user-profile' style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className='avatar-box' style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden' }}>
            <img src="/avatar-pink.JPEG" alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          </div>
          <div className='user-info'>
            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>Họ và tên</div>
            <div style={{ fontSize: '10px', color: '#64748B' }}>Quản lý HSE</div>
          </div>
        </div>
      </header>

      <div style={containerStyle}>
        <h2 style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '16px', color: '#0F172A' }}>
          Biểu đồ và Nhật ký sự cố HSE
        </h2>

        {/* GRID HỆ THỐNG - 2 CỘT TỐI ƯU */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '16px' }}>
          
          {/* CARD 1: TRẠNG THÁI */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span>1. SỐ LƯỢNG SỰ CỐ THEO TRẠNG THÁI</span>
              <div style={{ fontSize: '11px', color: '#64748B', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: '4px' }}>
                {startDate} - {endDate}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
              <div style={{ width: '110px', height: '110px', borderRadius: '50%', flexShrink: 0, background: 'conic-gradient(#FFE066 0% 21%, #F3B3F5 21% 29%, #2DD4BF 29% 44%, #F2994A 44% 48%, #648AF5 48% 69%, #4ADE80 69% 95%, #FB7185 95% 100%)' }}></div>
              <div style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%' }}>
                <StatusItem color="#FFE066" label="Mới" percent="21%" />
                <StatusItem color="#F3B3F5" label="Yêu cầu" percent="8%" />
                <StatusItem color="#2DD4BF" label="Duyệt" percent="15%" />
                <StatusItem color="#648AF5" label="Xử lý" percent="21%" />
                <StatusItem color="#4ADE80" label="Đóng" percent="26%" />
                <StatusItem color="#FB7185" label="Quá hạn" percent="5%" />
              </div>
            </div>
          </div>

          {/* CARD 2: CAPA & XUẤT BÁO CÁO (Gom nhóm để bớt cao) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
               <div style={{ fontSize: '12px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>2. TỶ LỆ HOÀN THÀNH CAPA</div>
                  <div style={{ color: '#64748B' }}>Tổng: <b>52</b> | Xong: <b style={{ color: '#22C55E' }}>33</b></div>
               </div>
               <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="60" height="60" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#3B82F6" strokeWidth="12" strokeDasharray="188 251" strokeLinecap="round" transform="rotate(-90 50 50)" />
                  </svg>
                  <b style={{ position: 'absolute', fontSize: '12px' }}>75%</b>
               </div>
            </div>
            <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', color: '#475569' }}>XUẤT BÁO CÁO NHANH</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="date" style={{ flex: 1, fontSize: '11px', padding: '4px' }} value={startDate} readOnly />
                <input type="date" style={{ flex: 1, fontSize: '11px', padding: '4px' }} value={endDate} readOnly />
                <button style={{ backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: '4px', padding: '0 12px', fontSize: '11px', cursor: 'pointer' }}>Tải file</button>
              </div>
            </div>
          </div>

          {/* CARD 3: XU HƯỚNG */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span>3. XU HƯỚNG SỰ CỐ</span>
              <div style={{ display: 'flex', gap: '2px', backgroundColor: '#F1F5F9', padding: '2px', borderRadius: '4px' }}>
                <button onClick={() => setTrendType('month')} style={{ padding: '2px 8px', fontSize: '10px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: trendType === 'month' ? '#FFF' : 'transparent', boxShadow: trendType === 'month' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>Tháng</button>
                <button onClick={() => setTrendType('quarter')} style={{ padding: '2px 8px', fontSize: '10px', border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: trendType === 'quarter' ? '#FFF' : 'transparent', boxShadow: trendType === 'quarter' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>Quý</button>
              </div>
            </div>
            <div style={{ height: '100px', width: '100%', borderLeft: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', position: 'relative', marginTop: '10px' }}>
              <svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none">
                <path d="M 20 80 Q 200 10 380 50" fill="none" stroke="#3B82F6" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* CARD 4: TOP 5 & THỜI GIAN TRUNG BÌNH (Gộp ngang) */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span>4. TOP 5 LOẠI SỰ CỐ & TG TRUNG BÌNH</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <BarRow label="Vật lý" value={15} color="#4ADE80" max={20} />
                <BarRow label="Hóa học" value={8} color="#3B82F6" max={20} />
                <BarRow label="Cháy nổ" value={3} color="#F43F5E" max={20} />
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px dashed #E2E8F0' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1E293B' }}>4.3 <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748B' }}>Ngày</span></div>
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>Tốc độ xử lý TB</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

// Helper components thu gọn
function StatusItem({ color, label, percent }: { color: string, label: string, percent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }}></span>
      <span style={{ color: '#475569' }}>{label}: <b>{percent}</b></span>
    </div>
  );
}

function BarRow({ label, value, color, max }: { label: string, value: number, color: string, max: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '50px', fontSize: '10px', color: '#64748B' }}>{label}</div>
      <div style={{ flex: 1, height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${(value/max)*100}%`, height: '100%', backgroundColor: color }}></div>
      </div>
      <div style={{ fontSize: '10px', fontWeight: 'bold', width: '15px' }}>{value}</div>
    </div>
  );
}