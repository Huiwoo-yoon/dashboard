import { supabase } from '../lib/supabase';

// 붙여넣은 원문 → 맥미니가 AI로 정리(draft) → 화면에서 검토·수정 → Health log 앱 테이블에 저장

export type ImportKind = 'checkup' | 'episode';
export type ImportStatus = 'pending' | 'parsing' | 'ready' | 'saved' | 'failed';

export interface LabDraft {
  category?: string;
  test_name: string;
  raw_value: string;
  value?: number | null;
  unit?: string;
  reference_range?: string;
  is_abnormal: boolean;
  source_line?: string;
  auto_flag?: boolean;
}

export interface CheckupDraft {
  /** 저장된 health_records.id */
  _saved_to?: string;
  date: string;
  institution?: string;
  findings?: string;
  results: LabDraft[];
}

export interface SymptomDraft {
  logged_at: string; // YYYY-MM-DDTHH:mm (서울)
  symptoms: string[];
  severity: number;
  notes: string;
}

export interface MedDraft {
  medication_name: string;
  dosage: string;
  start_date: string;
  end_date: string;
  effectiveness: number; // 0 = 모름
  symptom_effect: string;
}

export interface EpisodeDraft {
  /** 저장된 episodes.id */
  _saved_to?: string;
  episode: { existing_id: string; title: string; start_date: string; end_date: string; description: string };
  symptoms: SymptomDraft[];
  medications: MedDraft[];
}

export interface HealthImport {
  id: string;
  member_id: string;
  kind: ImportKind;
  raw_text: string;
  status: ImportStatus;
  draft: CheckupDraft | EpisodeDraft | null;
  model: string | null;
  error: string | null;
  created_at: string;
}

const COLS = 'id, member_id, kind, raw_text, status, draft, model, error, created_at';

const ok = <T>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export async function createImport(member_id: string, kind: ImportKind, raw_text: string): Promise<HealthImport> {
  return ok(await supabase.from('dash_health_imports').insert({ member_id, kind, raw_text }).select(COLS).single());
}

/** 저장 전(대기·정리 중·검토 대기·실패) 것들 */
export async function listOpenImports(member_id: string, kind: ImportKind): Promise<HealthImport[]> {
  return ok(
    await supabase.from('dash_health_imports').select(COLS).eq('member_id', member_id).eq('kind', kind).neq('status', 'saved').order('created_at', { ascending: false }),
  ) ?? [];
}

export async function getImport(id: string): Promise<HealthImport> {
  return ok(await supabase.from('dash_health_imports').select(COLS).eq('id', id).single());
}

export async function retryImport(id: string): Promise<void> {
  ok(await supabase.from('dash_health_imports').update({ status: 'pending', error: null }).eq('id', id));
}

export async function deleteImport(id: string): Promise<void> {
  ok(await supabase.from('dash_health_imports').delete().eq('id', id));
}

async function markSaved(id: string, draft: CheckupDraft | EpisodeDraft, savedTo: string) {
  ok(await supabase.from('dash_health_imports').update({ status: 'saved', draft: { ...draft, _saved_to: savedTo }, saved_at: new Date().toISOString() }).eq('id', id));
}

/** 저장까지 끝난 입력 (최근 순) — 원문을 다시 보고, 어디에 저장됐는지 찾아가기 */
export async function listSavedImports(member_id: string, kind: ImportKind, limit = 50): Promise<HealthImport[]> {
  return ok(
    await supabase.from('dash_health_imports').select(COLS).eq('member_id', member_id).eq('kind', kind).eq('status', 'saved').order('created_at', { ascending: false }).limit(limit),
  ) ?? [];
}

export const savedTo = (imp: HealthImport): string | undefined => (imp.draft as { _saved_to?: string } | null)?._saved_to;

const VITAL: Record<string, string[]> = {
  weight: ['체중', '몸무게'],
  height: ['신장', '키'],
  bmi: ['bmi', '체질량지수'],
  sys: ['수축기', '최고혈압'],
  dia: ['이완기', '최저혈압'],
  fasting: ['공복혈당', 'glucose(ac)'],
  cholesterol: ['총콜레스테롤', 't.cholesterol', 'total cholesterol'],
};

/** 검토한 검사 결과를 Health log 앱 형식(health_records + lab_results)으로 저장 */
export async function saveCheckup(imp: HealthImport, draft: CheckupDraft): Promise<void> {
  const rows = draft.results.filter((r) => r.test_name.trim() && r.raw_value.trim());
  const num = (r: LabDraft) => (r.value != null && Number.isFinite(Number(r.value)) ? Number(r.value) : parseFloat(r.raw_value));
  // 그 앱의 화면이 쓰는 대표 수치 칸도 채운다
  const vitals: Record<string, number> = {};
  for (const [key, names] of Object.entries(VITAL)) {
    const hit = rows.find((r) => names.some((n) => r.test_name.toLowerCase().replace(/\s/g, '').includes(n.replace(/\s/g, ''))));
    if (hit && Number.isFinite(num(hit))) vitals[key] = num(hit);
  }
  const record = ok(
    await supabase
      .from('health_records')
      .insert({
        member_id: imp.member_id,
        date: draft.date,
        type: '검진결과',
        institution_name: draft.institution?.trim() || null,
        summary_notes: draft.findings?.trim() || null,
        notes: imp.raw_text,
        ...vitals,
      })
      .select('id')
      .single(),
  ) as { id: string };
  if (rows.length) {
    const { error } = await supabase.from('lab_results').insert(
      rows.map((r) => ({
        record_id: record.id,
        category: r.category?.trim() || null,
        test_name: r.test_name.trim(),
        value: Number.isFinite(num(r)) && /^[\s<>≤≥]*-?\d/.test(r.raw_value) ? num(r) : null,
        raw_value: r.raw_value.trim(),
        unit: r.unit?.trim() || null,
        reference_range: r.reference_range?.trim() || null,
        is_abnormal: r.is_abnormal,
      })),
    );
    if (error) {
      await supabase.from('health_records').delete().eq('id', record.id); // 반쯤 저장된 기록 정리
      throw error;
    }
  }
  await markSaved(imp.id, draft, record.id);
}

/** 검토한 아플 때 기록을 episodes / symptom_logs / medication_logs 로 저장 */
export async function saveEpisode(imp: HealthImport, draft: EpisodeDraft): Promise<string> {
  const e = draft.episode;
  let episodeId = e.existing_id;
  if (!episodeId) {
    const created = ok(
      await supabase
        .from('episodes')
        .insert({
          member_id: imp.member_id,
          title: e.title.trim() || '기록',
          description: e.description.trim() || null,
          start_date: e.start_date,
          end_date: e.end_date || null,
          status: e.end_date ? 'resolved' : 'active',
        })
        .select('id')
        .single(),
    ) as { id: string };
    episodeId = created.id;
  } else if (e.end_date) {
    ok(await supabase.from('episodes').update({ end_date: e.end_date, status: 'resolved' }).eq('id', episodeId));
  }
  if (draft.symptoms.length) {
    ok(
      await supabase.from('symptom_logs').insert(
        draft.symptoms.map((s) => ({
          episode_id: episodeId,
          logged_at: `${s.logged_at.length === 10 ? `${s.logged_at}T09:00` : s.logged_at.slice(0, 16)}:00+09:00`,
          symptoms: s.symptoms.map((t) => t.trim()).filter(Boolean),
          severity: Math.min(10, Math.max(1, Math.round(s.severity) || 1)),
          notes: s.notes.trim() || null,
        })),
      ),
    );
  }
  if (draft.medications.length) {
    ok(
      await supabase.from('medication_logs').insert(
        draft.medications.map((m) => ({
          episode_id: episodeId,
          medication_name: m.medication_name.trim(),
          dosage: m.dosage.trim() || null,
          start_date: m.start_date,
          end_date: m.end_date || null,
          effectiveness: m.effectiveness >= 1 && m.effectiveness <= 5 ? m.effectiveness : null,
          symptom_effect: m.symptom_effect.trim() || null,
        })),
      ),
    );
  }
  await markSaved(imp.id, draft, episodeId);
  return episodeId;
}
