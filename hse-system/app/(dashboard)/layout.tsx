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

  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true); 

  useEffect(() => {
    async function getUserRoleFromSupabase() {
      try {
        setCheckingAuth(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          window.location.href = '/'; 
          return;
        }

        let { data: profileData, error: profileError } = await supabase
          .from('PROFILES')
          .select('role_id') 
          .eq('profile_id', user.id) 
          .maybeSingle();

        if (profileError || !profileData) {
          const { data: fallbackData } = await supabase
            .from('PROFILES')
            .select('role_id') 
            .eq('id', user.id)
            .maybeSingle();
          if (fallbackData) {
            profileData = fallbackData;
          }
        }

        const role = (profileData?.role_id || 'employee').toLowerCase().trim();
        setUserRole(role);

        // --- ĐIỀU HƯỚNG TỰ ĐỘNG THEO VAILID URL CHUẨN ---
        if (role === 'reviewer' && (pathname === '/' || pathname.startsWith('/reports'))) {
          router.push('/risk-pending');
          return;
        }
        
        if (role === 'assessor' && (pathname === '/' || pathname.startsWith('/reports') || pathname.startsWith('/risk-pending'))) {
          router.push('/risk-assessment');
          return;
        }

        if (role === 'coordinator' && (pathname === '/' || pathname === '/capa' || pathname.startsWith('/reports') || pathname.startsWith('/risk-pending') || pathname.startsWith('/risk-assessment'))) {
          router.push('/capa/add-task');
          return;
        }

        if (role === 'assignee' && (pathname === '/' || pathname === '/capa' || pathname.startsWith('/reports') || pathname.startsWith('/risk-pending') || pathname.startsWith('/risk-assessment'))) {
          router.push('/capa/my-tasks');
          return;
        }

        if (role === 'manager' && (pathname === '/' || pathname.startsWith('/reports') || pathname.startsWith('/risk-pending') || pathname.startsWith('/risk-assessment') || pathname.startsWith('/capa'))) {
          router.push('/charts');
          return;
        }

        // --- PHÒNG THỦ URL CỨNG CHẶN TRUY CẬP LẬU ---
        const isPathAllowed = (allowedPaths: string[]) => {
          return allowedPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
        };

        if (role === 'employee') {
          const employeeAllowed = ['/reports/my-reports', '/reports/all-reports'];
          if (!isPathAllowed(employeeAllowed)) {
            alert('Tài khoản Nhân viên không có quyền truy cập vào chức năng này!');
            router.push('/reports/my-reports'); 
            return;
          }
        } 
        else if (role === 'reviewer') {
          const reviewerAllowed = ['/risk-pending', '/risk-pending/review-detail'];
          if (!isPathAllowed(reviewerAllowed)) {
            alert('Tài khoản Người phê duyệt không có quyền truy cập chức năng này!');
            router.push('/risk-pending'); 
            return;
          }
        }
        else if (role === 'assessor') {
          const assessorAllowed = ['/risk-assessment'];
          if (!isPathAllowed(assessorAllowed)) {
            alert('Tài khoản Người đánh giá rủi ro không có quyền truy cập chức năng này!');
            router.push('/risk-assessment'); 
            return;
          }
        }
        else if (role === 'coordinator') {
          const coordinatorAllowed = ['/capa/add-task', '/capa/acceptance'];
          if (!isPathAllowed(coordinatorAllowed)) {
            alert('Tài khoản Điều phối không có quyền truy cập chức năng này!');
            router.push('/capa/add-task'); 
            return;
          }
        }
        else if (role === 'assignee') {
          const assigneeAllowed = ['/capa/my-tasks'];
          if (!isPathAllowed(assigneeAllowed)) {
            alert('Tài khoản Người thực hiện không có quyền truy cập chức năng này!');
            router.push('/capa/my-tasks'); 
            return;
          }
        }
        else if (role === 'manager') {
          const managerAllowed = ['/charts'];
          if (!isPathAllowed(managerAllowed)) {
            alert('Tài khoản Quản lý (Manager) chỉ có quyền truy cập biểu đồ phân tích HSE!');
            router.push('/charts'); 
            return;
          }
        }

      } catch (err) {
        console.error("Lỗi khi kiểm tra phân quyền URL:", err);
      } finally {
        setCheckingAuth(false);
      }
    }

    getUserRoleFromSupabase();
  }, [pathname]); 

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?");
    if (!confirmLogout) return;

    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (response.ok) {
        window.location.href = '/'; 
      } else {
        alert('Đăng xuất thất bại, vui lòng thử lại sau!');
      }
    } catch (error) {
      console.error('Lỗi hệ thống khi đăng xuất:', error);
    }
  };

  const isMenuDisabled = (menuName: string) => {
    if (userRole === 'admin') return false; 
    if (userRole === 'manager') return menuName !== 'charts'; 
    if (userRole === 'employee') return menuName !== 'incident'; 
    if (userRole === 'reviewer') return menuName !== 'risk-pending';
    if (userRole === 'assessor') return menuName !== 'risk-assessment';
    if (userRole === 'coordinator' || userRole === 'assignee') return menuName !== 'capa'; 
    return true;
  };

  const disabledItemStyle = {
    cursor: 'not-allowed',
    userSelect: 'none' as const,
  };

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* SIDEBAR THANH ĐIỀU HƯỚNG */}
      <aside className="sidebar" style={{ width: '260px', backgroundColor: '#4C6FC2', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px', padding: '10px' }}>
            <img src='/logo.JPEG' style={{ width: '100px', height: 'auto', display: 'block' }} alt="Logo" />
            <p style={{ margin: 0, fontSize: '25px', fontWeight: 'bold', letterSpacing: '1px', color: 'white', lineHeight: '1' }}>HSE</p>
          </div>
          <hr style={{ border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)', margin: '0' }} />

          {/* Menu */}
          <nav style={{ padding: '16px' }}>
            {/* QUẢN LÝ SỰ CỐ */}
            <div style={{ marginBottom: '14px' }}>
              <div className="sidebar-item" style={isMenuDisabled('incident') ? disabledItemStyle : { cursor: 'pointer' }}>  
                <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                <p style={{ margin: 0 }}>Quản lý sự cố</p>            
              </div>
              <div className="submenu-container" style={{ paddingLeft: '12px' }}>
                {!isMenuDisabled('incident') ? (
                  <Link href="/reports/my-reports" style={{ textDecoration: 'none' }}>
                    <div className="sidebar-item"><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Báo cáo của tôi</p></div>
                  </Link>
                ) : (
                  <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Báo cáo của tôi</p></div>
                )}
                {!isMenuDisabled('incident') ? (
                  <Link href="/reports/all-reports" style={{ textDecoration: 'none' }}>
                    <div className="sidebar-item"><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Báo cáo toàn hệ thống</p></div>
                  </Link>
                ) : (
                  <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Báo cáo toàn hệ thống</p></div>
                )}
              </div>
            </div>

            {/* QUẢN LÝ RỦI RO */}
            <div style={{ marginBottom: '14px' }}>
              <div className="sidebar-item" style={(isMenuDisabled('risk-pending') && isMenuDisabled('risk-assessment')) ? disabledItemStyle : { cursor: 'pointer' }}>
                 <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                  <p style={{ margin: 0 }}>Quản lý rủi ro</p>
              </div>              
              <div className="submenu-container" style={{ paddingLeft: '12px' }}>
                {!isMenuDisabled('risk-pending') ? (
                  <Link href="/risk-pending" style={{ textDecoration: 'none' }}>
                    <div className="sidebar-item"><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Phê duyệt báo cáo</p></div>
                  </Link>
                ) : (
                  <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Phê duyệt báo cáo</p></div>
                )}
                {!isMenuDisabled('risk-assessment') ? (
                  <Link href="/risk-assessment" style={{ textDecoration: 'none' }}>
                    <div className="sidebar-item"><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Đánh giá rủi ro</p></div>
                  </Link>
                ) : (
                  <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Đánh giá rủi ro</p></div>
                )}
              </div>
            </div>

            {/* QUẢN LÝ CAPA */}
            <div style={{ marginBottom: '14px' }}>
              <div className="sidebar-item" style={isMenuDisabled('capa') ? disabledItemStyle : { cursor: 'pointer' }}>
                 <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                <p style={{ margin: 0 }}>Quản lý CAPA</p>
              </div>
              <div className="submenu-container" style={{ paddingLeft: '12px' }}>
                {!isMenuDisabled('capa') ? (
                  <>
                    {(userRole === 'admin' || userRole === 'coordinator') ? (
                      <Link href="/capa/add-task" style={{ textDecoration: 'none' }}>
                        <div className="sidebar-item"><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Thêm nhiệm vụ</p></div>
                      </Link>
                    ) : (
                      <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Thêm nhiệm vụ</p></div>
                    )}
                    {(userRole === 'admin' || userRole === 'assignee') ? (
                      <Link href="/capa/my-tasks" style={{ textDecoration: 'none' }}>
                        <div className="sidebar-item"><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Nhiệm vụ của tôi</p></div>
                      </Link>
                    ) : (
                      <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Nhiệm vụ của tôi</p></div>
                    )}
                    {(userRole === 'admin' || userRole === 'coordinator') ? (
                      <Link href="/capa/acceptance" style={{ textDecoration: 'none' }}>
                        <div className="sidebar-item"><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Nhiệm vụ nghiệm thu</p></div>
                      </Link>
                    ) : (
                      <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Nhiệm vụ nghiệm thu</p></div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Thêm nhiệm vụ</p></div>
                    <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Nhiệm vụ của tôi</p></div>
                    <div className="sidebar-item" style={disabledItemStyle}><img src="/folder-close.JPEG" className="sidebar-img" alt="fc"/><p style={{ margin: 0 }}>Nhiệm vụ nghiệm thu</p></div>
                  </>
                )}
              </div>
            </div>

            {/* BIỂU ĐỒ PHÂN TÍCH */}
            <div style={{ marginBottom: '10px' }}>
              {!isMenuDisabled('charts') ? (
                <Link href="/charts" style={{ textDecoration: 'none' }}>
                  <div className="sidebar-item">
                     <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                    <p style={{ margin: 0 }}>Biểu đồ nhật ký và sự cố HSE</p>
                  </div>
                </Link>
              ) : (
                <div className="sidebar-item" style={disabledItemStyle}>
                   <img src="/folder-open.JPEG" className="sidebar-img" alt="folder-open"/>
                  <p style={{ margin: 0 }}>Biểu đồ nhật ký và sự cố HSE</p>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Nút Đăng xuất */}
        <div onClick={handleLogout} style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <img src='/log-out.JPEG' style={{ width: '20px', height: '20px', objectFit: 'contain' }} alt="logout"/>
          <button type="button" style={{ background: 'none', border: 'none', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
             Đăng xuất
          </button>
        </div>
      </aside>

      {/* VÙNG CHỨA NỘI DUNG CHÍNH CỦA TRANG CON */}
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