import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// 1. HÀM GET - LẤY CHI TIẾT BÁO CÁO ĐỂ XEM/SỬA
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã báo cáo (id)' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('INCIDENT_REPORT')
      .select('*')
      .eq('report_id', id)
      .single();

    if (error) {
      console.error("🔴 LỖI GET SUPABASE:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}

// 2. HÀM PUT - LƯU DỮ LIỆU CHỈNH SỬA VÀO SUPABASE
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã báo cáo (id)' }, { status: 400 });
    }

    // Đọc dữ liệu Front-end gửi lên
    const body = await request.json();
    const { incident_type_id, location, short_description, long_description, occurred_at } = body;

    // Tiến hành cập nhật khớp 100% các thuộc tính bảng của bạn
    const { data, error } = await supabase
      .from('INCIDENT_REPORT')
      .update({
        incident_type_id: incident_type_id,
        location: location,
        short_description: short_description,
        long_description: long_description,
        occurred_at: occurred_at,              // Truyền thời gian xảy ra sự cố (Not null)
        updated_at: new Date().toISOString(), // Tự động cập nhật cột thời gian chỉnh sửa gần nhất
      })
      .eq('report_id', id)
      .select()
      .single();

    if (error) {
      console.error("🔴 LỖI UPDATE SUPABASE:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('🔴 LỖI HỆ THỐNG API:', error.message);
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}