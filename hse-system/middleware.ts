import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Tạo response cơ bản
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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

  // 1. Kiểm tra session user
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Nếu chưa login mà đòi vào trang bảo mật -> chuyển về trang login
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. Nếu đã login và đang ở trang chủ "/" -> Điều hướng theo Role
  if (user && request.nextUrl.pathname === '/') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    // Chuyển hướng thông minh dựa trên Role
    if (role === 'manager') {
      return NextResponse.redirect(new URL('/dashboard/manager', request.url))
    } 
    if (role === 'employee') {
      return NextResponse.redirect(new URL('/dashboard/employee', request.url))
    } 
    if (role === 'reviewer') {
      return NextResponse.redirect(new URL('/dashboard/reviewer', request.url))
    }
    if (role === 'assessor') {
      return NextResponse.redirect(new URL('/dashboard/assessor', request.url))
    }
    if (role === 'coordinator') {
      return NextResponse.redirect(new URL('/dashboard/coordinator', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}