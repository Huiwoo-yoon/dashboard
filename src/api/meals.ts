import { supabase } from '../lib/supabase';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: 'breakfast', label: '아침', icon: '🌅' },
  { value: 'lunch', label: '점심', icon: '☀️' },
  { value: 'dinner', label: '저녁', icon: '🌙' },
  { value: 'snack', label: '간식', icon: '🍪' },
];

export interface Meal {
  id: string;
  meal_date: string;
  meal_type: MealType;
  description: string;
  kcal: number | null;
}

export type MealInput = Omit<Meal, 'id'>;

const COLS = 'id, meal_date, meal_type, description, kcal';

export async function listMeals(date: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('dash_meals')
    .select(COLS)
    .eq('meal_date', date)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Meal[];
}

export async function addMeal(input: MealInput): Promise<Meal> {
  const { data, error } = await supabase.from('dash_meals').insert(input).select(COLS).single();
  if (error) throw error;
  return data as Meal;
}

export async function updateMeal(id: string, patch: Partial<MealInput>): Promise<Meal> {
  const { data, error } = await supabase.from('dash_meals').update(patch).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data as Meal;
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('dash_meals').delete().eq('id', id);
  if (error) throw error;
}
