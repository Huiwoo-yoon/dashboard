import { supabase } from '../lib/supabase';

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string | null;
  topic: string | null;
  note?: string;
}

export interface NewsDigest {
  digest_date: string;
  summary: string;
  items: NewsItem[];
  created_at: string;
}

export async function getDigest(date: string): Promise<NewsDigest | null> {
  const { data, error } = await supabase
    .from('dash_news_digests')
    .select('digest_date, summary, items, created_at')
    .eq('digest_date', date)
    .maybeSingle();
  if (error) throw error;
  return data as NewsDigest | null;
}

/** 주간 소식 시작일 목록 (최근 순) */
export async function listDigestDates(limit = 12): Promise<string[]> {
  const { data, error } = await supabase
    .from('dash_news_digests')
    .select('digest_date')
    .order('digest_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((d) => d.digest_date as string);
}
