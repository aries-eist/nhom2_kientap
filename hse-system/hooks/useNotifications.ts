'use client'
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client'; 

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Khởi tạo supabase bằng hàm createClient từ utils
  const supabase = createClient();

  const fetchNotifications = async () => {
    // 1. Lấy 20 thông báo gần nhất theo UI Rules
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setNotifications(data);

    // 2. Đếm số lượng chưa đọc cho Badge
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    setUnreadCount(count || 0);
  };

  useEffect(() => {
    fetchNotifications();
    // Cơ chế Polling 30 giây
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Hàm đánh dấu đã đọc khi bấm vào
  const markAsRead = async (notification_id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('notification_id', notification_id);
    fetchNotifications();
  };

  return { notifications, unreadCount, markAsRead };
};