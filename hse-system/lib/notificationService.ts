import { createClient } from '@/utils/supabase/client';
interface CreateNotificationParams {
  receiverId: string;
  title: string;
  content: string;
  linkUrl?: string;
}

export const createNotification = async ({
  receiverId,
  title,
  content,
  linkUrl
}: CreateNotificationParams) => {
  const supabase = createClient();

  const { error } = await supabase
    .from('notifications')
    .insert([
      {
        receiver_id: receiverId,
        title: title,
        content: content,
        link_url: linkUrl
      }
    ]);

  if (error) {
    console.error('Lỗi tạo thông báo:', error.message);
    return { success: false, error };
  }

  return { success: true };
};