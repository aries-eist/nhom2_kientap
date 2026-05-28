'use client'
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(''); // Xóa lỗi cũ mỗi khi bấm lại nút

    if (!email || !password) {
      setErrorMessage('[Lỗi]: Vui lòng nhập đầy đủ thông tin tài khoản!');
      setLoading(false);
      return;
    }

    try {
      // 1. Gửi thông tin tài khoản mật khẩu lên backend xử lý đăng nhập và check ROLE
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      // 2. NẾU ĐĂNG NHẬP THẤT BẠI (Sai mật khẩu, sai tài khoản...)
      if (!response.ok) {
        // Hiện chữ thông báo lỗi màu đỏ gắt y như hình bà gửi
        setErrorMessage(`[Lỗi]: ${result.error || 'Tài khoản hoặc mật khẩu không chính xác.'}`);
        setLoading(false);
        return; // ⛔ CHẶN ĐỨNG: Giữ người dùng đứng im tại màn hình đăng nhập, không chuyển trang
      }

      // 3. NẾU ĐĂNG NHẬP THÀNH CÔNG (Vượt qua vòng gửi xe, đúng pass)
      if (result.success) {
        const userRole = result.role; // Lấy giá trị cột role_id từ backend trả về ('employee', 'manager'...)

        if (userRole === 'employee') {
          router.push('/reports/my-reports'); 
          
        } else if (userRole === 'reviewer') {
          router.push('/risk-pending'); // Vào trang app/(dashboard)/risks
          
        } else if (userRole === 'coordinator') {
          router.push('/capa'); // Vào trang app/(dashboard)/capa
          
        } else if (userRole === 'assessor') {
          router.push('/risk-assetment'); // Vào trang app/(dashboard)/risk-assetments
          
        } else if (userRole === 'manager') {
          router.push('/charts'); // Vào trang app/(dashboard)/charts
          
        } else {
          // Trường hợp tài khoản có role nằm ngoài danh sách quy định trên
          setErrorMessage('[Lỗi]: Vai trò của tài khoản này không có quyền truy cập hệ thống!');
          setLoading(false);
          return;
        }
        
        router.refresh();
      }

    } catch (error) {
      setErrorMessage('[Lỗi]: Không thể kết nối đến hệ thống. Vui lòng thử lại sau!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#4C6FC2', 
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      margin: 0,
      boxSizing: 'border-box'
    }}>
    
      <style jsx global>{`
        body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden;
        }
      `}</style>
      
      {/* KHỐI LOGO GÓC TRÊN BÊN TRÁI */}
      <div style={{
        position: 'absolute',
        top: '30px',
        left: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '200px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px', padding: '10px' }}>
          <img src='logo.png' style={{ width: '100px', height: 'auto', display: 'block' }} alt="Logo" />
          <p style={{ margin: 0, fontSize: '25px', fontWeight: 'bold', letterSpacing: '1px', color: 'white', lineHeight: '1', alignItems: 'center' }}>HSE</p>
        </div>
      </div>

      {/* KHỐI CỬA SỔ ĐĂNG NHẬP TRUNG TÂM */}
      <div style={{
        width: '400px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        overflow: 'hidden',
        padding: '36px',
        boxSizing: 'border-box'
      }}>
        
        <h2 style={{
          textAlign: 'center',
          color: '#1A365D',
          fontSize: '26px',
          fontWeight: 'bold',
          margin: '0 0 32px 0',
          letterSpacing: '0.5px'
        }}>
          Đăng nhập
        </h2>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Trường nhập Email */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                color: '#334155',
                boxSizing: 'border-box',
                backgroundColor: '#FFF'
              }}
            />
          </div>

          {/* Khối thông báo lỗi chèn vào GIỮA hai ô input */}
          {errorMessage && (
            <div style={{ 
              color: '#EF4444', 
              fontSize: '11px', 
              textAlign: 'left', 
              fontWeight: '500',
              paddingLeft: '4px',
              marginTop: '-10px',
              marginBottom: '-10px'
            }}>
              {errorMessage}
            </div>
          )}

          {/* Trường nhập Password */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                color: '#334155',
                boxSizing: 'border-box',
                backgroundColor: '#FFF'
              }}
            />
          </div>

          {/* Nút bấm Đăng nhập */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: '#5570C8', 
                color: 'white',
                border: 'none',
                padding: '12px 36px',
                fontSize: '14px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#445BB1'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5570C8'}
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}