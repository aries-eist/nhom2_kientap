// app/api/reports/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; 

export async function GET(request: Request) {
  try {
    const supabase = await createClient(); 

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const incidentType = searchParams.get('incidentType') || ''; // Nhận bộ lọc loại sự cố (UC, UA, NM)
    const date = searchParams.get('date') || '';
    const userId = searchParams.get('userId');
    
    // Phân trang
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('INCIDENT_REPORT')
      .select(`
        report_id,
        location,
        occurred_at,
        created_at,
        status,
        incident_type_id
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('created_by', userId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // 🛠️ KHẮC PHỤC LỌC LOẠI SỰ CỐ: Kiểm tra mã khớp chính xác với cột incident_type_id
    if (incidentType) {
      query = query.eq('incident_type_id', incidentType);
    }

    if (date) {
      query = query.gte('occurred_at', `${date}T00:00:00Z`).lte('occurred_at', `${date}T23:59:59Z`);
    }

    if (search) {
      query = query.or(`report_id.ilike.%${search}%,location.ilike.%${search}%`);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Lỗi Supabase:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Giữ mã gốc (UC, UA, NM) trả về để Frontend map theo từ điển dịch
    const formattedData = data?.map((rep: any) => ({
      report_id: rep.report_id,
      location: rep.location,
      created_at: rep.occurred_at || rep.created_at,
      status: rep.status,
      incident_type_id: rep.incident_type_id, 
    })) || [];

    return NextResponse.json({
      reports: formattedData,
      totalCount: count || 0
    });

  } catch (error: any) {
    console.error('Lỗi API:', error.message);
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}


// app/api/reports/route.ts
// import { NextResponse } from 'next/server';
// import { createClient } from '@/utils/supabase/server'; 

// export async function GET(request: Request) {
//   try {
//     const supabase = await createClient(); 

//     const { searchParams } = new URL(request.url);
//     const search = searchParams.get('search') || '';
//     const status = searchParams.get('status') || '';
    
//     // ĐÃ THÊM: Bắt lấy biến userId (UUID của người đăng nhập) từ Frontend gửi sang
//     const userId = searchParams.get('userId');
    
//     // Đọc thông tin phân trang (Mặc định trang 1, mỗi trang 20 dòng)
//     const page = parseInt(searchParams.get('page') || '1', 10);
//     const pageSize = 20;
//     const from = (page - 1) * pageSize;
//     const to = from + pageSize - 1;

//     // Truy vấn dữ liệu kèm đếm tổng số dòng (count: 'exact') để Front-end tính tổng số trang
//     let query = supabase
//       .from('INCIDENT_REPORT')
//       .select(`
//         report_id,
//         location,
//         occurred_at,
//         status,
//         incident_type_id,
//         INCIDENT_TYPE (
//           incident_type_name
//         )
//       `, { count: 'exact' })
//       .order('created_at', { ascending: false });

//     // ĐÃ THÊM: Ép điều kiện lọc bảo mật - Chỉ lấy báo cáo do chính người này tạo ra
//     if (userId) {
//       query = query.eq('created_by', userId);
//     }

//     if (status) {
//       query = query.eq('status', status);
//     }

//     if (search) {
//       query = query.or(`report_id.ilike.%${search}%,location.ilike.%${search}%`);
//     }

//     // Thực hiện giới hạn phạm vi 20 dòng cho trang hiện tại
//     query = query.range(from, to);

//     const { data, error, count } = await query;

//     if (error) {
//       console.error("Lỗi Supabase:", error.message);
//       return NextResponse.json({ error: error.message }, { status: 400 });
//     }

//     const formattedData = data?.map((rep: any) => ({
//       report_id: rep.report_id,
//       location: rep.location,
//       occurred_at: rep.occurred_at,
//       status: rep.status,
//       incident_type_id: rep.INCIDENT_TYPE?.incident_type_name || rep.incident_type_id,
//     })) || [];

//     // Trả về cả dữ liệu và tổng số dòng (count) để hỗ trợ hiển thị giao diện phân trang
//     return NextResponse.json({
//       reports: formattedData,
//       totalCount: count || 0
//     });

//   } catch (error: any) {
//     console.error('Lỗi API:', error.message);
//     return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
//   }}