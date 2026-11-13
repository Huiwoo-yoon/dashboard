// 새 차를 추가할 때 넣는 기본 점검 항목 (휘발유 승용차 기준, 일반 조건과 가혹 조건 사이의 값)
// 주기는 범위의 짧은 쪽을 기본으로 두고, 범위는 note에 적었다. 화면에서 바꿀 수 있다.

export interface CarTemplateItem {
  category: string;
  name: string;
  interval_km: number | null;
  interval_months: number | null;
  note: string;
}

export const CAR_CATEGORIES = ['월간 점검', '엔진·오일', '필터·점화', '타이어·제동', '기타 소모품', '서류·검사'];

export const GASOLINE_TEMPLATE: CarTemplateItem[] = [
  { category: '월간 점검', name: '타이어 공기압', interval_km: null, interval_months: 1, note: '운전석 문 안쪽 스티커의 권장 공기압 기준. 겨울엔 더 자주' },
  { category: '월간 점검', name: '엔진오일·냉각수·워셔액 양', interval_km: null, interval_months: 1, note: '보닛 열고 게이지·눈금 확인' },
  { category: '월간 점검', name: '등화·경고등', interval_km: null, interval_months: 1, note: '전조등·브레이크등·방향지시등, 계기판 경고등' },

  { category: '엔진·오일', name: '엔진오일·오일필터', interval_km: 7000, interval_months: 6, note: '7,000~10,000km 또는 6개월~1년. 시내·단거리 위주면 일찍' },
  { category: '엔진·오일', name: '에어클리너', interval_km: 10000, interval_months: 12, note: '엔진오일 교체 때 함께 점검' },
  { category: '엔진·오일', name: '브레이크 오일', interval_km: 40000, interval_months: 24, note: '40,000~50,000km 또는 2~3년. 수분 테스트 후 교체' },
  { category: '엔진·오일', name: '냉각수(부동액)', interval_km: 40000, interval_months: 24, note: '최초 10만km 또는 5년, 이후 4만km 또는 2년. 색·양 확인' },
  { category: '엔진·오일', name: '변속기 오일', interval_km: 80000, interval_months: null, note: '80,000~100,000km. 무교환 차종도 점검 권장' },

  { category: '필터·점화', name: '에어컨 필터', interval_km: 10000, interval_months: 6, note: '6개월 또는 10,000km. 봄·가을 환절기' },
  { category: '필터·점화', name: '점화플러그·코일', interval_km: 100000, interval_months: null, note: '백금·이리듐 100,000km / 일반 플러그면 40,000km로 바꾸기' },
  { category: '필터·점화', name: '연료필터', interval_km: 40000, interval_months: null, note: '40,000~60,000km' },

  { category: '타이어·제동', name: '타이어 위치 교환', interval_km: 10000, interval_months: null, note: '10,000~15,000km. 앞바퀴가 더 빨리 닳음' },
  { category: '타이어·제동', name: '타이어 교체', interval_km: null, interval_months: 48, note: '마모 한계선 또는 생산 4~5년. 갈라짐도 확인' },
  { category: '타이어·제동', name: '휠 얼라인먼트', interval_km: 20000, interval_months: null, note: '타이어 교체 때, 한쪽으로 쏠릴 때' },
  { category: '타이어·제동', name: '브레이크 패드', interval_km: 30000, interval_months: null, note: '30,000~40,000km 점검·교체. 디스크는 패드 2~3회마다 점검' },

  { category: '기타 소모품', name: '와이퍼 블레이드', interval_km: null, interval_months: 6, note: '6개월~1년. 줄무늬·소음이 나면' },
  { category: '기타 소모품', name: '배터리', interval_km: null, interval_months: 36, note: '3~5년. 블랙박스 상시녹화면 짧아짐' },

  { category: '서류·검사', name: '자동차 보험 갱신', interval_km: null, interval_months: 12, note: '만기 전에 비교·갱신' },
  { category: '서류·검사', name: '자동차 정기검사', interval_km: null, interval_months: 24, note: '신차는 출고 4년 후 첫 검사, 이후 2년마다' },
];
