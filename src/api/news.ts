import { supabase } from '../lib/supabase';

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string | null;
  topic: string | null;
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

/** 소식이 있는 날짜 목록 (달력 표시용) */
export async function listDigestDates(from: string, to: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('dash_news_digests')
    .select('digest_date')
    .gte('digest_date', from)
    .lte('digest_date', to);
  if (error) throw error;
  return (data ?? []).map((d) => d.digest_date as string);
}
