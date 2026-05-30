import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Các cấu hình khác của bạn (nếu có) */

  // Tự động chuyển hướng từ trang chủ sang trang đăng nhập mà không cần tạo file page.tsx mới
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: true, // Báo cho trình duyệt biết đây là chuyển hướng cố định
      },
    ];
  },
};

export default nextConfig;




// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;