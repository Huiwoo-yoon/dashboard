import { supabase } from '../lib/supabase';

export interface MarketSymbol {
  id: string;
  symbol: string;
  label: string;
  sort_order: number;
}

export interface MarketQuote {
  symbol: string;
  name: string | null;
  currency: string | null;
  price: number | null;
  prev_close: number | null;
  market_time: string | null;
  error: string | null;
  updated_at: string;
}

export type RangeKey = '1d' | '5d' | '1mo' | '1y' | '5y' | 'max';
/** [unix초, 종가] */
export type Point = [number, number];

export async function listSymbols(): Promise<MarketSymbol[]> {
  const { data, error } = await supabase
    .from('dash_market_symbols')
    .select('id, symbol, label, sort_order')
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function addSymbol(symbol: string, label: string, sort_order: number): Promise<MarketSymbol> {
  const { data, error } = await supabase
    .from('dash_market_symbols')
    .insert({ symbol, label, sort_order })
    .select('id, symbol, label, sort_order')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSymbol(id: string): Promise<void> {
  const { error } = await supabase.from('dash_market_symbols').delete().eq('id', id);
  if (error) throw error;
}

/** 시세 요약 (차트 데이터 제외) */
export async function listQuotes(): Promise<MarketQuote[]> {
  const { data, error } = await supabase
    .from('dash_market_quotes')
    .select('symbol, name, currency, price, prev_close, market_time, error, updated_at');
  if (error) throw error;
  return data ?? [];
}

export async function getHistory(symbol: string): Promise<Partial<Record<RangeKey, Point[]>>> {
  const { data, error } = await supabase.from('dash_market_quotes').select('history').eq('symbol', symbol).maybeSingle();
  if (error) throw error;
  return (data?.history as Partial<Record<RangeKey, Point[]>>) ?? {};
}
