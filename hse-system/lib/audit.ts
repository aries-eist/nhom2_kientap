import { createClient } from '@/utils/supabase/server';
export async function insertLog(data: {
    report_id?: string;
    action: string;
    old_value?: any;
    new_value?: any;
    comment?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('activity_logs')
        .insert([{
            ...data,
            user_id: user?.id
        }]);

    if (error) console.error('Audit Log Error:', error);
}