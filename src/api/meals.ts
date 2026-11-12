import { supabase } from '../lib/supabase';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
];

export interface Meal {
  id: string;
  meal_date: string;
  meal_type: MealType;
  description: string;
  /** 직접 입력한 칼로리 (있으면 AI 값보다 우선) */
  kcal: number | null;
  // 맥미니 로컬 스크립트가 채우는 AI 분석 값
  food_name: string | null;
  ai_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  analyzed_at: string | null;
}

export type MealInput = Pick<Meal, 'meal_date' | 'meal_type' | 'description' | 'kcal'>;

const COLS = 'id, meal_date, meal_type, description, kcal, food_name, ai_kcal, protein_g, carbs_g, fat_g, analyzed_at';

/** 화면에 쓸 칼로리: 직접 입력 > AI 추정 */
export const mealKcal = (m: Meal): number | null => m.kcal ?? m.ai_kcal;

export async function listMeals(from: string, to: string = from): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('dash_meals')
    .select(COLS)
    .gte('meal_date', from)
    .lte('meal_date', to)
    .order('meal_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Meal[];
}

export async function addMeal(input: MealInput): Promise<Meal> {
  const { data, error } = await supabase.from('dash_meals').insert(input).select(COLS).single();
  if (error) throw error;
  return data as Meal;
}

/** 음식 내용이 바뀌면 AI 분석을 지워 다음 실행 때 다시 분석되게 한다. */
export async function updateMeal(id: string, patch: Partial<MealInput>, descriptionChanged: boolean): Promise<Meal> {
  const reset = descriptionChanged
    ? { food_name: null, ai_kcal: null, protein_g: null, carbs_g: null, fat_g: null, analyzed_at: null }
    : {};
  const { data, error } = await supabase.from('dash_meals').update({ ...patch, ...reset }).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data as Meal;
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('dash_meals').delete().eq('id', id);
  if (error) throw error;
}

export async function getInsight(date: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('dash_meal_insights')
    .select('summary')
    .eq('insight_date', date)
    .maybeSingle();
  if (error) throw error;
  return data?.summary ?? null;
}
