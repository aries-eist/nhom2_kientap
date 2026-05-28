import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Tạo response cơ bản để tiếp tục luồng chạy
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Khởi tạo Supabase Client dành cho môi trường Server (Middleware)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set({ name, value, ...options })
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl


  if (pathname.startsWith('/api/')) {
    return response
  }

  // Lấy thông tin user hiện tại từ Supabase Auth
  const { data: { user } } = await supabase.auth.getUser()


  if (!user && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }


  if (user && (pathname === '/' || pathname === '/login')) {
    return response
  }

  return response
}

// Cấu hình Matcher: Áp dụng Middleware cho toàn bộ dự án
// NGOẠI TRỪ: các file tĩnh (ảnh png, jpeg, svg...), file hệ thống _next, favicon
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}