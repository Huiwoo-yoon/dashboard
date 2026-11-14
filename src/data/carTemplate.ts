// 새 차를 추가할 때 넣는 기본 점검 항목 (휘발유 승용차, 우리나라 시내 위주 주행 기준)
// 현대 취급설명서의 일반 조건과 가혹 조건(단거리·정체·공회전) 사이 값. 화면에서 바꿀 수 있다.

export interface CarTemplateItem {
  category: string;
  name: string;
  interval_km: number | null;
  interval_months: number | null;
  note: string;
}

export const CAR_CATEGORIES = ['셀프 점검', '엔진·오일', '필터·점화', '타이어·제동', '기타 소모품', '서류·검사'];

export const GASOLINE_TEMPLATE: CarTemplateItem[] = [
  { category: '셀프 점검', name: '타이어 공기압', interval_km: null, interval_months: 1, note: '운전석 문 안쪽 스티커의 권장 공기압 기준. 기온이 떨어지면 낮아짐' },
  { category: '셀프 점검', name: '엔진오일·냉각수·워셔액 양', interval_km: null, interval_months: 3, note: '보닛 열고 게이지·눈금 확인. 장거리 가기 전에도' },
  { category: '셀프 점검', name: '등화·경고등', interval_km: null, interval_months: 3, note: '전조등·브레이크등·방향지시등, 계기판 경고등' },

  { category: '엔진·오일', name: '엔진오일·오일필터', interval_km: 10000, interval_months: 12, note: '제조사 일반 15,000km/1년, 가혹 7,500km/6개월. 10km 미만 단거리만 탄다면 7,500km' },
  { category: '엔진·오일', name: '에어클리너', interval_km: 20000, interval_months: 24, note: '엔진오일 갈 때 털어서 점검. 미세먼지 심한 해엔 일찍' },
  { category: '엔진·오일', name: '브레이크 오일', interval_km: 50000, interval_months: 36, note: '제조사 50,000km. 정비소 수분 테스트에서 높게 나오면 교체' },
  { category: '엔진·오일', name: '냉각수(부동액)', interval_km: 40000, interval_months: 24, note: '최초 200,000km 또는 10년, 그 뒤 40,000km 또는 2년. 양·색 확인' },
  { category: '엔진·오일', name: '변속기 오일', interval_km: 100000, interval_months: null, note: '일반 조건은 무교환, 시내 위주(가혹)면 100,000km' },
  { category: '엔진·오일', name: '구동벨트', interval_km: 30000, interval_months: 24, note: '90,000km에 첫 점검, 이후 30,000km 또는 2년. 갈라짐·끽 소리 나면 교체' },

  { category: '필터·점화', name: '에어컨 필터', interval_km: 15000, interval_months: 12, note: '1년에 한 번(보통 여름 전). 냄새·바람 약해지면 일찍' },
  { category: '필터·점화', name: '점화플러그', interval_km: 160000, interval_months: null, note: '제조사 160,000km. 시동 떨림·출력 저하 때 점검' },
  { category: '필터·점화', name: '연료필터', interval_km: 100000, interval_months: null, note: '휘발유차는 탱크 내장형이라 보통 무교환. 100,000km쯤 점검만' },

  { category: '타이어·제동', name: '타이어 위치 교환', interval_km: 10000, interval_months: null, note: '10,000~15,000km. 엔진오일 갈 때 같이 하면 편함' },
  { category: '타이어·제동', name: '타이어 교체', interval_km: 50000, interval_months: 60, note: '마모 한계선(1.6mm) 또는 생산 5~6년. 옆면 갈라짐도 확인' },
  { category: '타이어·제동', name: '휠 얼라인먼트', interval_km: 40000, interval_months: null, note: '타이어 교체 때, 핸들이 쏠리거나 한쪽만 닳을 때' },
  { category: '타이어·제동', name: '브레이크 패드', interval_km: 40000, interval_months: null, note: '시내는 앞 패드가 빨리 닳음. 40,000km 전후 점검, 경고음 나면 교체' },

  { category: '기타 소모품', name: '와이퍼 블레이드', interval_km: null, interval_months: 12, note: '1년쯤. 줄무늬·떨림·소음이 나면' },
  { category: '기타 소모품', name: '배터리', interval_km: null, interval_months: 48, note: '3~5년. 3년 넘으면 정비 때 전압 점검. 블랙박스 상시녹화면 짧아짐' },

  { category: '서류·검사', name: '자동차 보험 갱신', interval_km: null, interval_months: 12, note: '만기 전에 비교·갱신' },
  { category: '서류·검사', name: '자동차 정기검사', interval_km: null, interval_months: 24, note: '신차는 출고 4년 후 첫 검사, 이후 2년마다. 기간 지나면 과태료' },
];
