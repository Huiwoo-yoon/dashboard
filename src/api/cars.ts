import { supabase } from '../lib/supabase';
import { GASOLINE_TEMPLATE } from '../data/carTemplate';

export interface Car {
  id: string;
  name: string;
  fuel: string;
  odometer_km: number | null;
  odometer_date: string | null;
  sort_order: number;
}

export interface CarItem {
  id: string;
  car_id: string;
  category: string;
  name: string;
  interval_km: number | null;
  interval_months: number | null;
  note: string | null;
  last_done_date: string | null;
  last_done_km: number | null;
  sort_order: number;
}

export interface CarLog {
  id: string;
  car_id: string;
  item_id: string | null;
  item_name: string;
  done_date: string;
  km: number | null;
  cost: number | null;
  memo: string | null;
}

const CAR_COLS = 'id, name, fuel, odometer_km, odometer_date, sort_order';
const ITEM_COLS = 'id, car_id, category, name, interval_km, interval_months, note, last_done_date, last_done_km, sort_order';
const LOG_COLS = 'id, car_id, item_id, item_name, done_date, km, cost, memo';

const ok = <T>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export async function listCars(): Promise<Car[]> {
  return ok(await supabase.from('dash_cars').select(CAR_COLS).order('sort_order').order('created_at')) ?? [];
}

/** 차를 만들고 기본 점검 항목을 함께 넣는다 */
export async function addCar(input: Pick<Car, 'name' | 'fuel' | 'odometer_km' | 'odometer_date'>, sort_order: number): Promise<Car> {
  const car = ok(await supabase.from('dash_cars').insert({ ...input, sort_order }).select(CAR_COLS).single()) as Car;
  ok(await supabase.from('dash_car_items').insert(GASOLINE_TEMPLATE.map((t, i) => ({ ...t, car_id: car.id, sort_order: i }))));
  return car;
}

export async function updateCar(id: string, patch: Partial<Omit<Car, 'id'>>): Promise<Car> {
  return ok(await supabase.from('dash_cars').update(patch).eq('id', id).select(CAR_COLS).single());
}

export async function deleteCar(id: string): Promise<void> {
  ok(await supabase.from('dash_cars').delete().eq('id', id));
}

export async function listItems(car_id: string): Promise<CarItem[]> {
  return ok(await supabase.from('dash_car_items').select(ITEM_COLS).eq('car_id', car_id).order('sort_order')) ?? [];
}

export async function addItem(input: Pick<CarItem, 'car_id' | 'category' | 'name' | 'interval_km' | 'interval_months' | 'note'>, sort_order: number): Promise<CarItem> {
  return ok(await supabase.from('dash_car_items').insert({ ...input, sort_order }).select(ITEM_COLS).single());
}

export async function updateItem(id: string, patch: Partial<Omit<CarItem, 'id' | 'car_id'>>): Promise<CarItem> {
  return ok(await supabase.from('dash_car_items').update(patch).eq('id', id).select(ITEM_COLS).single());
}

export async function deleteItem(id: string): Promise<void> {
  ok(await supabase.from('dash_car_items').delete().eq('id', id));
}

export async function listLogs(car_id: string): Promise<CarLog[]> {
  return ok(await supabase.from('dash_car_logs').select(LOG_COLS).eq('car_id', car_id).order('done_date', { ascending: false }).order('created_at', { ascending: false })) ?? [];
}

/** 정비 기록을 남기고, 더 최근이면 항목의 '마지막으로 한 날'을 갱신한다 */
export async function recordDone(item: CarItem, done: { done_date: string; km: number | null; cost: number | null; memo: string | null }): Promise<{ log: CarLog; item: CarItem }> {
  const log = ok(
    await supabase
      .from('dash_car_logs')
      .insert({ car_id: item.car_id, item_id: item.id, item_name: item.name, ...done })
      .select(LOG_COLS)
      .single(),
  ) as CarLog;
  const newer = !item.last_done_date || done.done_date >= item.last_done_date;
  const updated = newer ? await updateItem(item.id, { last_done_date: done.done_date, last_done_km: done.km }) : item;
  return { log, item: updated };
}

export async function deleteLog(id: string): Promise<void> {
  ok(await supabase.from('dash_car_logs').delete().eq('id', id));
}
