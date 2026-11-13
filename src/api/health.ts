import { supabase } from '../lib/supabase';

export interface Weight {
  id: string;
  weigh_date: string;
  weight_kg: number;
}

/** 맥미니 스크립트가 계산해 저장하는 주간 숫자 */
export interface HealthStats {
  week_start: string;
  week_end: string;
  meal_days: number;
  meal_count: number;
  avg_kcal: number;
  avg_protein_g: number;
  avg_carbs_g: number;
  avg_fat_g: number;
  macro_pct: { p: number; c: number; f: number } | null;
  skipped_breakfast: number;
  workout_days: number;
  workout_done: number;
  workout_possible: number;
  workout_items: { name: string; done: number }[];
  height_cm: number | null;
  weight_latest: number | null;
  bmi: number | null;
}

export interface HealthReport {
  week_start: string;
  stats: HealthStats;
  report: {
    headline: string;
    diet: string;
    exercise: string;
    body: string;
    good: string[];
    adjust: string[];
    next_week: string[];
  };
  created_at: string;
}

export async function getHeight(): Promise<number | null> {
  const { data, error } = await supabase.from('dash_profile').select('height_cm').maybeSingle();
  if (error) throw error;
  return data?.height_cm != null ? Number(data.height_cm) : null;
}

export async function setHeight(height_cm: number): Promise<void> {
  // user_id는 기본값 auth.uid()로 채워진다
  const { error } = await supabase
    .from('dash_profile')
    .upsert({ height_cm, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** 체중 기록 (오래된 날짜 → 최근 순) */
export async function listWeights(limit = 365): Promise<Weight[]> {
  const { data, error } = await supabase
    .from('dash_body_weights')
    .select('id, weigh_date, weight_kg')
    .order('weigh_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((w) => ({ ...w, weight_kg: Number(w.weight_kg) })).reverse();
}

/** 같은 날짜에 다시 적으면 덮어쓴다 */
export async function saveWeight(weigh_date: string, weight_kg: number): Promise<Weight> {
  const { data, error } = await supabase
    .from('dash_body_weights')
    .upsert({ weigh_date, weight_kg }, { onConflict: 'user_id,weigh_date' })
    .select('id, weigh_date, weight_kg')
    .single();
  if (error) throw error;
  return { ...data, weight_kg: Number(data.weight_kg) };
}

export async function deleteWeight(id: string): Promise<void> {
  const { error } = await supabase.from('dash_body_weights').delete().eq('id', id);
  if (error) throw error;
}

/** 리포트가 있는 주(월요일) 목록, 최근 순 */
export async function listReportWeeks(limit = 12): Promise<string[]> {
  const { data, error } = await supabase
    .from('dash_health_reports')
    .select('week_start')
    .order('week_start', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((d) => d.week_start as string);
}

export async function getReport(week_start: string): Promise<HealthReport | null> {
  const { data, error } = await supabase
    .from('dash_health_reports')
    .select('week_start, stats, report, created_at')
    .eq('week_start', week_start)
    .maybeSingle();
  if (error) throw error;
  return data as HealthReport | null;
}
