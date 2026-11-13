import { supabase } from '../lib/supabase';

// Health log 앱의 아픈 기록 테이블 (가족 단위 RLS)

export interface Episode {
  id: string;
  member_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'resolved';
}

export interface SymptomLog {
  id: string;
  episode_id: string;
  logged_at: string;
  symptoms: string[];
  severity: number;
  notes: string | null;
}

export interface MedLog {
  id: string;
  episode_id: string;
  medication_name: string;
  dosage: string | null;
  start_date: string;
  end_date: string | null;
  effectiveness: number | null;
  symptom_effect: string | null;
}

const ok = <T>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export async function listEpisodes(member_id: string): Promise<Episode[]> {
  return ok(await supabase.from('episodes').select('id, member_id, title, description, start_date, end_date, status').eq('member_id', member_id).order('start_date', { ascending: false })) ?? [];
}

export async function listSymptoms(episodeIds: string[]): Promise<SymptomLog[]> {
  if (!episodeIds.length) return [];
  return ok(await supabase.from('symptom_logs').select('id, episode_id, logged_at, symptoms, severity, notes').in('episode_id', episodeIds).order('logged_at')) ?? [];
}

export async function listMeds(episodeIds: string[]): Promise<MedLog[]> {
  if (!episodeIds.length) return [];
  return ok(await supabase.from('medication_logs').select('id, episode_id, medication_name, dosage, start_date, end_date, effectiveness, symptom_effect').in('episode_id', episodeIds).order('start_date')) ?? [];
}

export async function updateEpisode(id: string, patch: Partial<Omit<Episode, 'id' | 'member_id'>>): Promise<void> {
  ok(await supabase.from('episodes').update(patch).eq('id', id));
}

export async function deleteEpisode(id: string): Promise<void> {
  ok(await supabase.from('episodes').delete().eq('id', id));
}

export async function addSymptom(input: Omit<SymptomLog, 'id'>): Promise<SymptomLog> {
  return ok(await supabase.from('symptom_logs').insert(input).select('id, episode_id, logged_at, symptoms, severity, notes').single());
}

export async function deleteSymptom(id: string): Promise<void> {
  ok(await supabase.from('symptom_logs').delete().eq('id', id));
}

export async function addMed(input: Omit<MedLog, 'id'>): Promise<MedLog> {
  return ok(await supabase.from('medication_logs').insert(input).select('id, episode_id, medication_name, dosage, start_date, end_date, effectiveness, symptom_effect').single());
}

export async function updateMed(id: string, patch: Partial<Omit<MedLog, 'id' | 'episode_id'>>): Promise<void> {
  ok(await supabase.from('medication_logs').update(patch).eq('id', id));
}

export async function deleteMed(id: string): Promise<void> {
  ok(await supabase.from('medication_logs').delete().eq('id', id));
}
