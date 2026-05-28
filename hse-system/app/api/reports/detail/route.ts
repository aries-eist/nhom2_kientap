import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// 1. HÀM GET - LẤY CHI TIẾT BÁO CÁO KÈM ẢNH MINH CHỨNG TỪ BẢNG PHỤ
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã báo cáo (id)' }, { status: 400 });
    }

    // ĐÃ SỬA: Thực hiện truy vấn JOIN sang bảng INCIDENT_IMAGE để lôi đường dẫn ảnh ra
    const { data, error } = await supabase
      .from('INCIDENT_REPORT')
      .select(`
        *,
        INCIDENT_IMAGE (
          image_url
        )
      `)
      .eq('report_id', id)
      .single();

    if (error) {
      console.error("🔴 LỖI GET SUPABASE:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ĐÃ SỬA: Phẳng hóa cấu trúc dữ liệu để `reportData.image_url` ở Frontend nhận trực tiếp được luôn
    const formattedData = {
      ...data,
      image_url: data.INCIDENT_IMAGE?.[0]?.image_url || null // Lấy tấm ảnh đầu tiên tìm thấy, không có thì trả về null
    };

    // Bỏ thuộc tính mảng gốc đi cho sạch dữ liệu trả về
    delete formattedData.INCIDENT_IMAGE;

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error("🔴 LỖI HỆ THỐNG GET API:", error.message);
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}

// 2. HÀM PUT - LƯU DỮ LIỆU CHỈNH SỬA VÀO SUPABASE (Giữ nguyên logic chuẩn của bà)
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
        long_description: long_description, // Note: body destructured long_description
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
    console.error('🔴 LỖI HỆ THỐNG API PUT:', error.message);
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}


// import { NextResponse } from 'next/server';
// import { createClient } from '@/utils/supabase/server';

// // 1. HÀM GET - LẤY CHI TIẾT BÁO CÁO ĐỂ XEM/SỬA
// export async function GET(request: Request) {
//   try {
//     const supabase = await createClient();
//     const { searchParams } = new URL(request.url);
//     const id = searchParams.get('id');

//     if (!id) {
//       return NextResponse.json({ error: 'Thiếu mã báo cáo (id)' }, { status: 400 });
//     }

//     const { data, error } = await supabase
//       .from('INCIDENT_REPORT')
//       .select('*')
//       .eq('report_id', id)
//       .single();

//     if (error) {
//       console.error("🔴 LỖI GET SUPABASE:", error.message);
//       return NextResponse.json({ error: error.message }, { status: 400 });
//     }

//     return NextResponse.json(data);
//   } catch (error: any) {
//     return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
//   }
// }

// // 2. HÀM PUT - LƯU DỮ LIỆU CHỈNH SỬA VÀO SUPABASE
// export async function PUT(request: Request) {
//   try {
//     const supabase = await createClient();
//     const { searchParams } = new URL(request.url);
//     const id = searchParams.get('id');

//     if (!id) {
//       return NextResponse.json({ error: 'Thiếu mã báo cáo (id)' }, { status: 400 });
//     }

//     // Đọc dữ liệu Front-end gửi lên
//     const body = await request.json();
//     const { incident_type_id, location, short_description, long_description, occurred_at } = body;

//     // Tiến hành cập nhật khớp 100% các thuộc tính bảng của bạn
//     const { data, error } = await supabase
//       .from('INCIDENT_REPORT')
//       .update({
//         incident_type_id: incident_type_id,
//         location: location,
//         short_description: short_description,
//         long_description: long_description,
//         occurred_at: occurred_at,              // Truyền thời gian xảy ra sự cố (Not null)
//         updated_at: new Date().toISOString(), // Tự động cập nhật cột thời gian chỉnh sửa gần nhất
//       })
//       .eq('report_id', id)
//       .select()
//       .single();

//     if (error) {
//       console.error("🔴 LỖI UPDATE SUPABASE:", error.message);
//       return NextResponse.json({ error: error.message }, { status: 400 });
//     }

//     return NextResponse.json({ success: true, data });
//   } catch (error: any) {
//     console.error('🔴 LỖI HỆ THỐNG API:', error.message);
//     return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
//   }
// }