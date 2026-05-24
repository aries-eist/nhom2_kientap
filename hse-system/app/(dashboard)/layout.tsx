'use client'
import React from 'react';
import Link from 'next/link';
import '@/app/layout-styles.css'; // Đảm bảo đường dẫn này trỏ đúng file CSS dùng chung của bạn

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-container">
      
      {/* ==================== THANH SIDEBAR  ==================== */}
      <aside className="sidebar">
        <div>
          {/* Cụm Logo và chữ HSE */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px', padding: '10px' }}>
            <img src='/logo.JPEG' style={{ width: '100px', height: 'auto', display: 'block' }} alt="Logo" />
            <p style={{ margin: 0, fontSize: '25px', fontWeight: 'bold', letterSpacing: '1px', color: 'white', lineHeight: '1', alignItems: 'center' }}>HSE</p>
          </div>
          <hr style={{ border: 'none', borderBottom: '1px solid white', margin: '0' }} />

          {/* Cây danh mục tính năng */}
          <nav style={{ padding: '16px' }}>
            
            {/* 1. Danh mục: Quản lý sự cố */}
            <div style={{ marginBottom: '14px' }}>
              <div className="sidebar-item">  
                <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                <p style={{ margin: 0 }}>Quản lý sự cố</p>            
              </div>
            
              <div className="submenu-container">
                <Link href="/reports/my-reports" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Báo cáo của tôi</p>
                  </div>
                </Link>
                {/* Đã bọc Link cho Báo cáo toàn hệ thống */}
                <Link href="/reports/all-reports" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Báo cáo toàn hệ thống</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* 2. Danh mục: Quản lý rủi ro */}
            <div style={{ marginBottom: '14px' }}>
              <div className="sidebar-item">
                 <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                  <p style={{ margin: 0 }}>Quản lý rủi ro</p>
              </div>              
              <div className="submenu-container">
                <Link href="/risks/pending-review" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Danh sách chờ đánh giá</p>
                  </div>
                </Link>
                <Link href="/risks/assessment" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Đánh giá rủi ro</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* 3. Danh mục: Quản lý CAPA */}
            <div style={{ marginBottom: '14px' }}>
              <div className="sidebar-item">
                 <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                <p style={{ margin: 0 }}>Quản lý CAPA</p>
              </div>
              <div className="submenu-container">
                <Link href="/capa/add-task" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Thêm nhiệm vụ</p>
                  </div>
                </Link>
                <Link href="/capa/my-tasks" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Nhiệm vụ của tôi</p>
                  </div>
                </Link>
                <Link href="/capa/acceptance" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Nghiệm thu</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* 4. Danh mục: Báo cáo & Biểu đồ phân tích */}
            <div style={{ marginBottom: '10px' }}>
              <Link href="/analytics" style={{ textDecoration: 'none' }}>
                <div className="sidebar-item">
                   <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                  <p style={{ margin: 0 }}>Dashboard & Phân tích</p>
                </div>
              </Link>
            </div>
          </nav>
        </div>

        {/* Khối nút Đăng xuất nằm dưới đáy */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src='/log-out.JPEG' style={{ width: '20px', height: '20px', objectFit: 'contain' }} alt="logout"/>
          <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: 0, fontWeight: 'bold' }}>
             Đăng xuất
          </button>
        </div>
      </aside>
      {/* ==================== HẾT THANH SIDEBAR ==================== */}

      {/* */}
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#E9ECF2' }}>
        {children}
      </main>

    </div>
  );
}