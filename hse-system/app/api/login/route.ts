import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu!' }, 
        { status: 400 }
      );
    }

    // ==================== BƯỚC 1: XÁC THỰC TÀI KHOẢN (AUTH) ====================
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (authError) {
      console.error("🔴 LỖI AUTH SUPABASE:", authError.message);
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu không chính xác.' }, 
        { status: 401 }
      );
    }

    // CƠ CHẾ DỰ PHÒNG: Lấy UUID chính xác tuyệt đối của tài khoản vừa đăng nhập
    let userId = authData?.user?.id;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }

    if (!userId) {
      console.error("🔴 LỖI: Không thể lấy được mã UUID (User ID) từ Supabase Auth!");
      return NextResponse.json(
        { error: 'Hệ thống không nhận diện được mã định danh tài khoản.' },
        { status: 401 }
      );
    }

    console.log("🟢 ĐÃ LẤY ĐƯỢC UUID CHUẨN:", userId);


    // ==================== BƯỚC 2: TRA CỨU VAI TRÒ (BẢNG PROFILES) ====================
    // ĐÃ SỬA: Thay thế .single() bằng .limit(1) để xử lý dứt điểm lỗi ép kiểu dữ liệu JSON khi bị trùng dòng
    const { data: profileList, error: profileError } = await supabase
      .from('PROFILES') 
      .select('role_id')   
      .eq('profile_id', userId) 
      .limit(1); 
    
    // In log chi tiết kiểm tra lỗi nếu có biến cố phát sinh từ Supabase
    if (profileError) {
      console.log("=== LỖI CHI TIẾT TỪ DATABASE SUPABASE ===");
      console.log("Mã lỗi (Code):", profileError.code);
      console.log("Tin nhắn lỗi (Message):", profileError.message);
      console.log("=========================================");
    }

    // Kiểm tra nếu có lỗi từ hệ thống, hoặc mảng danh sách trả về bị trống rỗng
    if (profileError || !profileList || profileList.length === 0) {
      console.error("🔴 LỖI TRA CỨU BẢNG PROFILES:", profileError?.message || "Không tìm thấy dữ liệu vai trò phù hợp");
      return NextResponse.json(
        { error: 'Tài khoản chưa được cấu hình vai trò trên hệ thống nội bộ.' }, 
        { status: 403 }
      );
    }
    
    // Bốc phần tử đầu tiên trong danh sách ra để xử lý
    const profileData = profileList[0];


    // ==================== BƯỚC 3: TRẢ KẾT QUẢ VỀ CHO FRONTEND ====================
    return NextResponse.json({
      success: true,
      role: profileData.role_id, // Trả về chuỗi vai trò ví dụ: 'employee', 'manager', 'reviewer'...
      user: authData.user
    });

  } catch (error: any) {
    console.error('🔴 LỖI HỆ THỐNG API LOGIN:', error.message);
    return NextResponse.json(
      { error: 'Lỗi máy chủ nội bộ' }, 
      { status: 500 }
    );
  }
}