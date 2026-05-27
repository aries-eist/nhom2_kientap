import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('🔴 LỖI ĐĂNG XUẤT SUPABASE AUTH:', error.message);
      return NextResponse.json(
        { error: 'Không thể xóa phiên đăng nhập trên hệ thống' }, 
        { status: 500 }
      );
    }

    console.log('🟢 ĐĂNG XUẤT THÀNH CÔNG - ĐÃ XÓA COOKIE SESSION');
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error('🔴 LỖI HỆ THỐNG API LOGOUT:', error.message);
    return NextResponse.json(
      { error: 'Lỗi máy chủ nội bộ' }, 
      { status: 500 }
    );
  }
}