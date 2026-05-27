'use client'
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // 👈 1. Thêm useRouter để điều hướng
import '@/app/layout-styles.css'; 

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter(); // Khởi tạo router

  // 👈 2. Hàm xử lý Đăng xuất thực tế gọi qua API Backend
  const handleLogout = async () => {
    const confirmLogout = window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?");
    if (!confirmLogout) return;

    try {
      // Gọi đến API đăng xuất để xóa Session lưu trong Cookie của Supabase
      const response = await fetch('/api/logout', {
        method: 'POST',
      });

      if (response.ok) {
        // Sau khi xóa xong session, đẩy người dùng quay lại màn hình đăng nhập gốc
        router.push('/'); 
        router.refresh(); // Làm tươi hệ thống để xóa sạch các trạng thái cũ
      } else {
        alert('Đăng xuất thất bại, vui lòng thử lại sau!');
      }
    } catch (error) {
      console.error('Lỗi hệ thống khi đăng xuất:', error);
      alert('Không thể kết nối đến máy chủ!');
    }
  };

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
                <Link href="/risks/pending-evaluations" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Danh sách chờ đánh giá</p>
                  </div>
                </Link>
                <Link href="/risks/pending-evaluations/risk-assessment" style={{ textDecoration: 'none' }}>
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

        {/* 👈 3. ĐÃ CẬP NHẬT: Khối nút Đăng xuất kích hoạt hàm xóa session */}
        <div 
          onClick={handleLogout}
          style={{ 
            padding: '16px', 
            borderTop: '1px solid rgba(255,255,255,0.1)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            cursor: 'pointer' // Tạo hiệu ứng bàn tay khi di chuột vào khối đăng xuất
          }} 
        >
          <img src='/log-out.JPEG' style={{ width: '20px', height: '20px', objectFit: 'contain' }} alt="logout"/>
          <button 
            type="button"
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'white', 
              fontSize: '13px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: 0, 
              fontWeight: 'bold' 
            }}
          >
             Đăng xuất
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#E9ECF2' }}>
        {children}
      </main>

    </div>
  );
}