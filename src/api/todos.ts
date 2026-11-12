import { supabase } from '../lib/supabase';

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  done_at: string | null;
  created_at: string;
}

const COLS = 'id, title, done, due_date, done_at, created_at';

export async function listTodos(): Promise<Todo[]> {
  const { data, error } = await supabase.from('dash_todos').select(COLS).order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addTodo(title: string, due_date: string | null): Promise<Todo> {
  const { data, error } = await supabase.from('dash_todos').insert({ title, due_date }).select(COLS).single();
  if (error) throw error;
  return data;
}

export async function updateTodo(id: string, patch: Partial<Pick<Todo, 'title' | 'due_date'>>): Promise<Todo> {
  const { data, error } = await supabase.from('dash_todos').update(patch).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data;
}

export async function setTodoDone(id: string, done: boolean): Promise<Todo> {
  const { data, error } = await supabase
    .from('dash_todos')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('dash_todos').delete().eq('id', id);
  if (error) throw error;
}
