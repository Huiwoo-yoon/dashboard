import { supabase } from '../lib/supabase';

// Health_record_manager 앱의 테이블을 그 앱의 RLS(가족 연결) 그대로 읽기만 한다.

export interface Member {
  id: string;
  name: string | null;
  gender: string | null;
  birth_date: string | null;
}

export interface HealthRecord {
  id: string;
  member_id: string;
  date: string;
  type: string;
  weight: number | null;
  bmi: number | null;
  sys: number | null;
  dia: number | null;
  fasting: number | null;
}

export interface LabResult {
  record_id: string;
  category: string | null;
  test_name: string;
  value: number | null;
  raw_value: string | null;
  unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean | null;
}

export interface HealthNote {
  id: string;
  category: string;
  content: string;
  created_at: string;
}

export interface CheckupInsight {
  member_id: string | null;
  insight: {
    headline: string;
    items: { topic: string; status: 'good' | 'watch' | 'concern'; text: string }[];
    lifestyle: string;
    recommendations: string[];
    ask_doctor: string[];
  } | null;
  requested_at: string | null;
  created_at: string | null;
}

const ok = <T>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export async function listMembers(): Promise<Member[]> {
  return ok(await supabase.from('family_members').select('id, name, gender, birth_date').order('created_at')) ?? [];
}

export async function listRecords(): Promise<HealthRecord[]> {
  return ok(
    await supabase
      .from('health_records')
      .select('id, member_id, date, type, weight, bmi, sys, dia, fasting')
      .order('date', { ascending: true }),
  ) ?? [];
}

export async function listLabs(recordIds: string[]): Promise<LabResult[]> {
  if (recordIds.length === 0) return [];
  return ok(
    await supabase
      .from('lab_results')
      .select('record_id, category, test_name, value, raw_value, unit, reference_range, is_abnormal')
      .in('record_id', recordIds),
  ) ?? [];
}

export async function getMyMemberId(): Promise<string | null> {
  const data = ok(await supabase.from('dash_profile').select('health_member_id').maybeSingle()) as { health_member_id: string | null } | null;
  return data?.health_member_id ?? null;
}

export async function setMyMemberId(health_member_id: string): Promise<void> {
  ok(await supabase.from('dash_profile').upsert({ health_member_id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
}

export async function listNotes(): Promise<HealthNote[]> {
  return ok(await supabase.from('dash_health_notes').select('id, category, content, created_at').order('created_at')) ?? [];
}

export async function addNote(category: string, content: string): Promise<HealthNote> {
  return ok(await supabase.from('dash_health_notes').insert({ category, content }).select('id, category, content, created_at').single());
}

export async function deleteNote(id: string): Promise<void> {
  ok(await supabase.from('dash_health_notes').delete().eq('id', id));
}

export async function getInsight(): Promise<CheckupInsight | null> {
  return ok(await supabase.from('dash_checkup_insights').select('member_id, insight, requested_at, created_at').maybeSingle());
}

/** 맥미니가 10분 안에 다시 분석한다 */
export async function requestInsight(): Promise<string> {
  const requested_at = new Date().toISOString();
  ok(await supabase.from('dash_checkup_insights').upsert({ requested_at }, { onConflict: 'user_id' }));
  return requested_at;
}
