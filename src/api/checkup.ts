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
  institution_name: string | null;
}

export interface RecordDetail {
  id: string;
  date: string;
  institution_name: string | null;
  summary_notes: string | null;
  /** 붙여넣은 원문 (Health log 앱도 같은 칸에 원문을 둔다) */
  notes: string | null;
}

export interface LabResult {
  id: string;
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
  member_id: string;
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
      .select('id, member_id, date, type, weight, bmi, sys, dia, fasting, institution_name')
      .order('date', { ascending: true }),
  ) ?? [];
}

export async function listLabs(recordIds: string[]): Promise<LabResult[]> {
  if (recordIds.length === 0) return [];
  return ok(
    await supabase
      .from('lab_results')
      .select('id, record_id, category, test_name, value, raw_value, unit, reference_range, is_abnormal')
      .in('record_id', recordIds),
  ) ?? [];
}

export async function getMyMemberId(): Promise<string | null> {
  const data = ok(await supabase.from('dash_profile').select('health_member_id').maybeSingle()) as { health_member_id: string | null } | null;
  return data?.health_member_id ?? null;
}

export async function listNotes(member_id: string): Promise<HealthNote[]> {
  return ok(await supabase.from('dash_health_notes').select('id, category, content, created_at').eq('member_id', member_id).order('created_at')) ?? [];
}

export async function addNote(member_id: string, category: string, content: string): Promise<HealthNote> {
  return ok(await supabase.from('dash_health_notes').insert({ member_id, category, content }).select('id, category, content, created_at').single());
}

export async function deleteNote(id: string): Promise<void> {
  ok(await supabase.from('dash_health_notes').delete().eq('id', id));
}

export async function getInsight(member_id: string): Promise<CheckupInsight | null> {
  return ok(await supabase.from('dash_checkup_insights').select('member_id, insight, requested_at, created_at').eq('member_id', member_id).maybeSingle());
}

/** 맥미니가 10분 안에 다시 분석한다 */
export async function requestInsight(member_id: string): Promise<string> {
  const requested_at = new Date().toISOString();
  ok(await supabase.from('dash_checkup_insights').upsert({ member_id, requested_at }, { onConflict: 'user_id,member_id' }));
  return requested_at;
}

// ---------- 저장된 검사 기록 보기·고치기 (Health log 앱 테이블) ----------

export async function getRecordDetail(id: string): Promise<RecordDetail> {
  return ok(await supabase.from('health_records').select('id, date, institution_name, summary_notes, notes').eq('id', id).single());
}

export async function updateRecord(id: string, patch: { date?: string; institution_name?: string | null; summary_notes?: string | null }): Promise<void> {
  ok(await supabase.from('health_records').update(patch).eq('id', id));
}

/** 기록과 그 검사 항목 전체 삭제 (lab_results는 cascade) */
export async function deleteRecord(id: string): Promise<void> {
  ok(await supabase.from('health_records').delete().eq('id', id));
}

export type LabInput = Pick<LabResult, 'category' | 'test_name' | 'raw_value' | 'unit' | 'reference_range' | 'is_abnormal'>;

const numOf = (raw: string | null) => {
  const m = raw?.match(/^[\s<>≤≥]*(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

/** 편집한 항목 목록을 그대로 반영: 바뀐 것 수정, 새 것 추가, 빠진 것 삭제 */
export async function saveLabs(record_id: string, before: LabResult[], after: (LabInput & { id?: string })[]): Promise<void> {
  const keep = new Set(after.filter((a) => a.id).map((a) => a.id));
  const removed = before.filter((b) => !keep.has(b.id)).map((b) => b.id);
  if (removed.length) ok(await supabase.from('lab_results').delete().in('id', removed));
  for (const a of after) {
    const row = { ...a, value: numOf(a.raw_value), id: undefined };
    delete row.id;
    if (a.id) {
      const b = before.find((x) => x.id === a.id);
      const same = b && (['category', 'test_name', 'raw_value', 'unit', 'reference_range', 'is_abnormal'] as const).every((k) => (b[k] ?? '') === (a[k] ?? ''));
      if (!same) ok(await supabase.from('lab_results').update(row).eq('id', a.id));
    } else if (a.test_name.trim()) {
      ok(await supabase.from('lab_results').insert({ ...row, record_id }));
    }
  }
}
