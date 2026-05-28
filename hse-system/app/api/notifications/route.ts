import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// 1. GET - Lấy tối đa 20 thông báo mới nhất của người dùng hiện tại
export async function GET() {
  try {
    const supabase = await createClient(); // Đã chuẩn
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    // Lọc theo receiver_id cá nhân và bảng NOTIFICATION
    const { data, error } = await supabase
      .from('NOTIFICATION')
      .select('*')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. PATCH - Đánh dấu thông báo thành Đã đọc (is_read = true)
export async function PATCH(request: Request) {
  try {
    // 🌟 ĐÃ SỬA: Thêm await vào trước createClient() để tránh lỗi bất đồng bộ trên Server
    const supabase = await createClient();
    
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json({ error: 'Thiếu mã thông báo (notification_id)' }, { status: 400 });
    }

    // Cập nhật trạng thái đọc dựa theo khóa chính notification_id
    const { error } = await supabase
      .from('NOTIFICATION')
      .update({ is_read: true }) 
      .eq('notification_id', notificationId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}