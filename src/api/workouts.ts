import { supabase } from '../lib/supabase';

export interface WorkoutItem {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface WorkoutLog {
  item_id: string;
  log_date: string;
  done: boolean;
}

/** 현재 사용 중인 루틴 항목 (순서대로) */
export async function listActiveItems(): Promise<WorkoutItem[]> {
  const { data, error } = await supabase
    .from('dash_workout_items')
    .select('id, name, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addItem(name: string, sort_order: number): Promise<WorkoutItem> {
  const { data, error } = await supabase
    .from('dash_workout_items')
    .insert({ name, sort_order })
    .select('id, name, sort_order, active')
    .single();
  if (error) throw error;
  return data;
}

/** 삭제 = 비활성화. 과거 체크 기록(dash_workout_logs)은 그대로 보존된다. */
export async function archiveItem(id: string): Promise<void> {
  const { error } = await supabase.from('dash_workout_items').update({ active: false }).eq('id', id);
  if (error) throw error;
}

/** 화면 순서대로 sort_order를 다시 매긴다. */
export async function saveOrder(ids: string[]): Promise<void> {
  const results = await Promise.all(
    ids.map((id, i) => supabase.from('dash_workout_items').update({ sort_order: i }).eq('id', id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** [from, to] 기간의 체크 기록 */
export async function listLogs(from: string, to: string): Promise<WorkoutLog[]> {
  const { data, error } = await supabase
    .from('dash_workout_logs')
    .select('item_id, log_date, done')
    .gte('log_date', from)
    .lte('log_date', to);
  if (error) throw error;
  return data ?? [];
}

export async function setLog(item_id: string, log_date: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('dash_workout_logs')
    .upsert({ item_id, log_date, done }, { onConflict: 'item_id,log_date' });
  if (error) throw error;
}
