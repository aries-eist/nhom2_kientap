import { createClient } from '@/utils/supabase/client';

/**
 * Hàm upload file lên Supabase Storage
 * @param file Đối tượng File từ input
 * @param bucket Tên bucket ('evidence' hoặc 'reports')
 */
export const uploadFile = async (file: File, bucket: 'evidence' | 'reports') => {
  const supabase = createClient();
  
  // Tạo tên file duy nhất để tránh trùng lặp: timestamp_tênfile
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}_${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (error) {
    console.error('Lỗi upload:', error.message);
    return { success: false, error };
  }

  // Lấy URL công khai để lưu vào Database
  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return { 
    success: true, 
    url: publicUrlData.publicUrl 
  };
};