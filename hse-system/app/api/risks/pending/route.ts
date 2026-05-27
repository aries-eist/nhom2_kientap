import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; 

export async function GET(request: Request) {
  try {
    const supabase = await createClient(); 

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã báo cáo (id)' }, { status: 400 });
    }

    // Thực hiện truy vấn khớp chính xác cấu trúc cột DB của bạn
    const { data: report, error } = await supabase
      .from('INCIDENT_REPORT')
      .select(`
        report_id,
        location,
        short_description,
        long_description,
        status,
        incident_type_id,
        created_at,
        INCIDENT_TYPE (
          incident_type_name
        ),
        PROFILES!INCIDENT_REPORT_created_by_fkey (
          full_name
        )
      `) // Chỉ định tường minh dùng mối quan hệ hệ qua cột 'created_by' liên kết tới PROFILES
      .eq('report_id', id)
      .maybeSingle();

    if (error) {
      console.error("Lỗi Supabase:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!report) {
      return NextResponse.json({ error: 'Không tìm thấy báo cáo yêu cầu' }, { status: 404 });
    }

    // Format lại chuỗi thời gian ISO thành định dạng hiển thị dễ nhìn DD/MM/YYYY HH:mm
    let formattedCreatedAt = report.created_at;
    if (report.created_at) {
      const dateObj = new Date(report.created_at);
      formattedCreatedAt = dateObj.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) + ' ' + dateObj.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Ép kiểu ép mảng từ object join ẩn về cấu trúc phẳng sạch cho Front-end nhận dữ liệu
    const result = {
      report_id: report.report_id,
      location: report.location,
      description: report.long_description || report.short_description || 'Không có mô tả.',
      status: report.status,
    incident_type_id: (report as any).INCIDENT_TYPE?.incident_type_name || report.incident_type_id,      created_at: formattedCreatedAt, 
      creator_name: (report as any).PROFILES?.full_name || 'Người dùng hệ thống'
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Lỗi API chi tiết:', error.message);
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}