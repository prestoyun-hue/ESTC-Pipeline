import { Deal } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getKSTTodayString } from './dateFilter';

/**
 * 예상 매출일이 지났고, 진행단계가 0%나 100%가 아닌 딜인지 체크 (경고/강조 대상)
 */
export const isOverdueDeal = (deal: Deal): boolean => {
  if (!deal.expected_close_date) return false;
  
  // 오늘 날짜 (YYYY-MM-DD, KST)
  const todayStr = getKSTTodayString();
  
  // 예상 매출일이 오늘 이전인지 확인
  const isDatePassed = deal.expected_close_date < todayStr;
  
  // 진행단계가 0%(실패)도 아니고 100%(수주)도 아닌 진행 중 상태
  const isIncomplete = deal.probability !== 0 && deal.probability !== 100 && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost';
  
  return isDatePassed && isIncomplete;
};

const STORAGE_KEY = 'sales_crm_deals_v2';
const EVENT_KEY = 'crm_deals_updated';

// 초기 샘플 데이터셋
const DEFAULT_INITIAL_DEALS: Deal[] = [
  {
    id: 'deal-001',
    deal_code: 'DEAL-2026-101',
    title: '기업용 클라우드 CRM 구축 계약',
    company: '테크노바 (Technova)',
    partner_name: '씨앤에스 파트너스',
    product_name: 'SalesFlow Enterprise V2',
    pc_count: 120,
    server_count: 8,
    competitor_product: '글로벌 S사 CRM',
    amount: 150000000,
    lead_source: '홈페이지',
    sales_rep_id: 'demo-sales-rep-01',
    sales_rep_name: '김영업',
    vendor: 'Fortinet',
    deal_type: '신규',
    probability: 80,
    stage: 'negotiation',
    received_date: '2026-07-01',
    expected_close_date: '2026-08-30',
    notes: '최종 단가 협상 단계. 다음 주 계약서 검토 예정.',
    created_at: new Date('2026-07-01T10:00:00Z').toISOString(),
    history: [
      {
        id: 'hist-101',
        updated_at: '2026-07-01 10:00',
        updated_by_name: '김영업 (영업 담당)',
        changes: '신규 영업 딜 등록'
      }
    ]
  },
  {
    id: 'deal-002',
    deal_code: 'DEAL-2026-102',
    title: 'AI 영업 자동화 및 분석 모듈 도입',
    company: '글로벌 로지스틱스',
    partner_name: '한진 솔루션',
    product_name: 'SalesFlow AI Analytics',
    pc_count: 50,
    server_count: 2,
    competitor_product: '타사 B인텔리전스',
    amount: 85000000,
    lead_source: '파트너',
    sales_rep_id: 'demo-sales-rep-01',
    sales_rep_name: '김영업',
    vendor: 'Azure',
    deal_type: '신규',
    probability: 50,
    stage: 'proposal',
    received_date: '2026-07-10',
    expected_close_date: '2026-08-15',
    notes: '맞춤형 RFP 제안서 전송 완료. 기술 솔루션 미팅 대기.',
    created_at: new Date('2026-07-10T14:00:00Z').toISOString(),
    history: [
      {
        id: 'hist-102',
        updated_at: '2026-07-10 14:00',
        updated_by_name: '김영업 (영업 담당)',
        changes: '신규 영업 딜 등록'
      }
    ]
  },
  {
    id: 'deal-003',
    deal_code: 'DEAL-2026-103',
    title: '스마트 물류 데이터 분석 시스템 구축',
    company: '한성물류',
    partner_name: '자사 직판',
    product_name: 'IoT Logistics Suite',
    pc_count: 200,
    server_count: 16,
    competitor_product: '자체 개발',
    amount: 220000000,
    lead_source: '지인소개',
    sales_rep_id: 'demo-sales-rep-02',
    sales_rep_name: '이수진',
    vendor: 'AXGate',
    deal_type: '신규',
    probability: 100,
    stage: 'closed_won',
    close_reason: 'PoC 기술 우수성 및 유지보수 가격 경쟁력',
    received_date: '2026-06-15',
    expected_close_date: '2026-08-01',
    notes: '최종 계약 체결 완료. 9월 구축 시작.',
    created_at: new Date('2026-06-15T09:00:00Z').toISOString(),
    history: [
      {
        id: 'hist-103',
        updated_at: '2026-06-15 09:00',
        updated_by_name: '이수진 (영업 담당)',
        changes: '신규 영업 딜 등록'
      }
    ]
  },
  {
    id: 'deal-004',
    deal_code: 'DEAL-2026-104',
    title: '보안 솔루션 연간 라이선스 연장',
    company: '파이낸스원',
    product_name: 'SecureGate Enterprise',
    pc_count: 80,
    server_count: 4,
    amount: 45000000,
    lead_source: '콜드콜',
    sales_rep_id: 'demo-sales-rep-01',
    sales_rep_name: '김영업',
    vendor: '자사제품',
    deal_type: '갱신',
    probability: 30,
    stage: 'contacted',
    received_date: '2026-07-20',
    expected_close_date: '2026-08-20',
    notes: '초기 1차 미팅 완료. 요구사항 파악 중.',
    created_at: new Date('2026-07-20T11:00:00Z').toISOString(),
    history: [
      {
        id: 'hist-104',
        updated_at: '2026-07-20 11:00',
        updated_by_name: '김영업 (영업 담당)',
        changes: '신규 영업 딜 등록'
      }
    ]
  },
  {
    id: 'deal-005',
    deal_code: 'DEAL-2026-105',
    title: '미래에셋 데이터플랫폼 고도화',
    company: '미래에셋',
    partner_name: '씨앤에스',
    product_name: 'DataPlatform Pro',
    pc_count: 300,
    server_count: 24,
    amount: 310000000,
    lead_source: '홈페이지',
    sales_rep_id: 'demo-sales-rep-02',
    sales_rep_name: '이수진',
    vendor: 'Veeam',
    deal_type: '신규',
    probability: 100,
    stage: 'closed_won',
    close_reason: '기존 라이선스 만족도 극대화',
    received_date: '2026-07-01',
    expected_close_date: '2026-08-15',
    notes: '매출 반영 완료 건.',
    created_at: new Date('2026-07-01T08:00:00Z').toISOString(),
    history: [
      {
        id: 'hist-105',
        updated_at: '2026-07-01 08:00',
        updated_by_name: '이수진 (영업 담당)',
        changes: '신규 영업 딜 등록'
      }
    ]
  },
  {
    id: 'deal-006',
    deal_code: 'DEAL-2026-106',
    title: '대우건설 서버 인프라 교체 건',
    company: '대우건설',
    partner_name: '삼정아이티',
    product_name: 'PowerEdge R750',
    pc_count: 10,
    server_count: 32,
    amount: 180000000,
    lead_source: '행사',
    sales_rep_id: 'demo-manager-01',
    sales_rep_name: '박팀장',
    vendor: 'Paloalto',
    deal_type: '신규',
    probability: 0,
    stage: 'closed_lost',
    close_reason: '경쟁사 파격 할인 대응 불가',
    received_date: '2026-06-20',
    expected_close_date: '2026-08-25',
    notes: '다음 분기 재추진 검토.',
    created_at: new Date('2026-06-20T13:00:00Z').toISOString(),
    history: [
      {
        id: 'hist-106',
        updated_at: '2026-06-20 13:00',
        updated_by_name: '박팀장 (영업 관리자)',
        changes: '신규 영업 딜 등록 (지정 영업담당: 박팀장)'
      }
    ]
  }
];

/**
 * 딜 목록 중복 ID 제거 헬퍼 함수
 */
export const deduplicateDeals = (deals: Deal[]): Deal[] => {
  const seen = new Set<string>();
  const result: Deal[] = [];
  for (const deal of deals) {
    if (deal && deal.id && !seen.has(deal.id)) {
      seen.add(deal.id);
      // '추가' 옵션이 제거되었으므로 기존 '추가' 데이터는 '신규'로 자동 변환
      if (deal.deal_type === '추가') {
        deal.deal_type = '신규';
      }
      // '기타', 'Dell', 'AWS' 벤더 제거 및 기존 데이터 변환
      if (deal.vendor === 'AWS') deal.vendor = 'Fortinet';
      if (deal.vendor === 'Dell') deal.vendor = 'AXGate';
      if (deal.vendor === '기타') deal.vendor = 'ESET';
      result.push(deal);
    }
  }
  return result;
};

/**
 * 로컬스토리지 및 Supabase에서 딜 목록 조회
 */
export const fetchStoredDeals = async (): Promise<Deal[]> => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const cleanData = deduplicateDeals(data as Deal[]);
        saveToLocalStorage(cleanData);
        return cleanData;
      }
    } catch (e) {
      console.warn('Supabase DB fetch failed, falling back to LocalStorage:', e);
    }
  }

  // LocalStorage 불러오기
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return deduplicateDeals(parsed);
      }
    }
  } catch (e) {
    console.error('LocalStorage parse error:', e);
  }

  // 초기화
  const defaultClean = deduplicateDeals(DEFAULT_INITIAL_DEALS);
  saveToLocalStorage(defaultClean);
  return defaultClean;
};

/**
 * LocalStorage에 저장 및 이벤트 디스패치
 */
const saveToLocalStorage = (deals: Deal[]) => {
  try {
    const cleanDeals = deduplicateDeals(deals);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanDeals));
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: cleanDeals }));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
};

/**
 * 딜 추가 또는 수정 (save/update)
 */
export const saveOrUpdateDeal = async (
  savedDeal: Deal,
  isEditMode: boolean
): Promise<Deal[]> => {
  const currentDeals = await fetchStoredDeals();
  let updatedList: Deal[];

  const exists = currentDeals.some(d => d.id === savedDeal.id);

  if (isEditMode || exists) {
    updatedList = currentDeals.map(d => d.id === savedDeal.id ? savedDeal : d);
  } else {
    updatedList = [savedDeal, ...currentDeals];
  }

  updatedList = deduplicateDeals(updatedList);
  saveToLocalStorage(updatedList);

  // Supabase 백엔드 동기화 (설정 시)
  if (isSupabaseConfigured && supabase) {
    try {
      if (isEditMode || exists) {
        const { error } = await supabase.from('deals').update(savedDeal).eq('id', savedDeal.id);
        if (error) {
          console.error('Supabase DB 딜 수정 실패:', error.message, error);
        }
      } else {
        const { error } = await supabase.from('deals').insert([savedDeal]);
        if (error) {
          console.error('Supabase DB 딜 등록 실패:', error.message, error);
        }
      }
    } catch (err) {
      console.warn('Supabase async sync warning:', err);
    }
  }

  return updatedList;
};

/**
 * 딜 삭제
 */
export const removeDeal = async (dealId: string): Promise<Deal[]> => {
  const currentDeals = await fetchStoredDeals();
  const updatedList = currentDeals.filter(d => d.id !== dealId);

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('deals').delete().eq('id', dealId);
      if (error) {
        throw error;
      }
    } catch (err) {
      console.warn('Supabase delete warning:', err);
      throw err;
    }
  }

  saveToLocalStorage(updatedList);
  return updatedList;
};

/**
 * 실시간 변경 구독 이벤트 헬퍼
 */
export const subscribeToDealChanges = (callback: (deals: Deal[]) => void) => {
  const handler = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      callback(e.detail);
    }
  };
  window.addEventListener(EVENT_KEY, handler);
  return () => window.removeEventListener(EVENT_KEY, handler);
};
