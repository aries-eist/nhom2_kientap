"use client"
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation'; 
import { createClient } from '@/utils/supabase/client'; 
import '@/app/layout-styles.css'; 

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter(); 
  const pathname = usePathname(); 
  const supabase = createClient();

  // State lưu vai trò phân quyền của người dùng (Ví dụ: 'employee', 'reviewer', 'admin')
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true); 

  // =========================================================================
  // HOOK: LẤY VAI TRÒ (ROLE) CỦA USER ĐỂ PHÂN QUYỀN BẢO VỆ URL
  // =========================================================================
  useEffect(() => {
    async function getUserRoleFromSupabase() {
      try {
        setCheckingAuth(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          router.push('/');
          return;
        }

        // Lấy thông tin role từ bảng PROFILES
        let { data: profileData, error: profileError } = await supabase
          .from('PROFILES')
          .select('role') 
          .eq('profile_id', user.id) 
          .maybeSingle();

        if (profileError || !profileData) {
          const { data: fallbackData } = await supabase
            .from('PROFILES')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
          if (fallbackData) {
            profileData = fallbackData;
          }
        }

        const role = profileData?.role || 'employee';
        setUserRole(role);

        // 🔒 VÒNG PHÒNG THỦ CỨNG: Nếu cố tình gõ URL các trang bị khóa
        const allowedPaths = ['/reports/my-reports', '/reports/all-reports'];
        const isAccessingForbiddenPath = !allowedPaths.some(path => pathname.startsWith(path));

        if (role === 'employee' && isAccessingForbiddenPath) {
          alert('Tài khoản Nhân viên không có quyền truy cập vào chức năng này!');
          router.push('/reports/my-reports'); 
        }

      } catch (err) {
        console.error("Lỗi khi kiểm tra phân quyền Sidebar:", err);
      } finally {
        setCheckingAuth(false);
      }
    }

    getUserRoleFromSupabase();
  }, [pathname]); 

  // Hàm xử lý Đăng xuất
  const handleLogout = async () => {
    const confirmLogout = window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?");
    if (!confirmLogout) return;

    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (response.ok) {
        router.push('/'); 
        router.refresh(); 
      } else {
        alert('Đăng xuất thất bại, vui lòng thử lại sau!');
      }
    } catch (error) {
      console.error('Lỗi hệ thống khi đăng xuất:', error);
    }
  };

  const isEmployee = userRole === 'employee';

  // 💡 HÀM HELPER: Chỉ chặn tương tác click chuột (Không làm mờ, không đổi giao diện)
  const getDisabledStyle = (disabled: boolean) => {
    if (disabled) {
      return {
        pointerEvents: 'none' as const, // Ngắt toàn bộ sự kiện click, hover, điều hướng
        userSelect: 'none' as const
      };
    }
    return {};
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
            <div style={{ marginBottom: '14px', ...getDisabledStyle(isEmployee) }}>
              <div className="sidebar-item">
                 <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                  <p style={{ margin: 0 }}>Quản lý rủi ro</p>
              </div>              
              <div className="submenu-container">
                <Link href="/risk-pending" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Phê duyệt báo cáo</p>
                  </div>
                </Link>
                <Link href="/risk-assessment" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                      <img src="/folder-close.JPEG" className="sidebar-img" alt="folder-close"/>
                      <p style={{ margin: 0 }}>Đánh giá rủi ro</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* 3. Danh mục: Quản lý CAPA */}
            <div style={{ marginBottom: '14px', ...getDisabledStyle(isEmployee) }}>
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
            <div style={{ marginBottom: '10px', ...getDisabledStyle(isEmployee) }}>
              <Link href="/analytics" style={{ textDecoration: 'none' }}>
                <div className="sidebar-item">
                   <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                  <p style={{ margin: 0 }}>Biểu đồ nhật ký và sự cố HSE</p>
                </div>
              </Link>
            </div>

          </nav>
        </div>

        {/* Khối nút Đăng xuất */}
        <div onClick={handleLogout} style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <img src='/log-out.JPEG' style={{ width: '20px', height: '20px', objectFit: 'contain' }} alt="logout"/>
          <button type="button" style={{ background: 'none', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
             Đăng xuất
          </button>
        </div>
      </aside>

      {/* Phần hiển thị nội dung trang con */}
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#E9ECF2' }}>
        {checkingAuth ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>Đang xác thực phân quyền hệ thống...</div>
        ) : (
          children
        )}
      </main>

    </div>
  );
}
