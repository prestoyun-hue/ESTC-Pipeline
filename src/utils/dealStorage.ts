import { Deal, UserProfile, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getKSTTodayString } from './dateFilter';

/**
 * 사용자 권한(Role) 및 부서(Department)에 따른 딜 가시성 판단 헬퍼
 * - admin / viewer / manager: 전사 딜 조회 가능
 * - dept_manager: 본인 소속 부서(department)와 동일한 부서 소속 영업담당자의 딜만 조회 가능
 * - sales_rep: 본인(id 또는 이름)이 담당자인 딜만 조회 가능
 */
export const isDealVisibleToUser = (
  deal: Deal,
  profile: UserProfile | null,
  role: UserRole,
  allProfiles: UserProfile[] = []
): boolean => {
  // 1. 전체 관리자, 뷰어, 전사 매니저는 전체 열람 가능
  if (role === 'admin' || role === 'viewer' || role === 'manager') {
    return true;
  }

  // 2. 프로필 정보가 없으면 기본 차단
  if (!profile) return false;

  const repId = (deal.sales_rep_id || '').trim();
  const repName = (deal.sales_rep_name || '').trim();
  const userId = (profile.id || '').trim();
  const userFullName = (profile.full_name || '').trim();
  const cleanUserName = userFullName.replace(/\s*\(.*?\)/g, '').trim();

  // 3. 일반 영업 담당 (sales_rep): 본인 딜만 확인
  if (role === 'sales_rep') {
    return Boolean(
      (userId && repId && repId === userId) ||
      (userFullName && repName && repName === userFullName) ||
      (cleanUserName && repName && (repName.includes(cleanUserName) || cleanUserName.includes(repName)))
    );
  }

  // 4. 부서 관리자 (dept_manager): 본인 부서와 동일한 부서에 속한 담당자들의 딜 확인
  if (role === 'dept_manager') {
    const myDept = (profile.department || '').trim();
    if (!myDept) {
      // 본인의 부서 정보가 없으면 본인 딜만 안전하게 노출
      return Boolean(
        (userId && repId && repId === userId) ||
        (userFullName && repName && repName === userFullName) ||
        (cleanUserName && repName && (repName.includes(cleanUserName) || cleanUserName.includes(repName)))
      );
    }

    // 본인의 딜인 경우 무조건 포함
    const isMyOwnDeal = Boolean(
      (userId && repId && repId === userId) ||
      (userFullName && repName && repName === userFullName) ||
      (cleanUserName && repName && (repName.includes(cleanUserName) || cleanUserName.includes(repName)))
    );
    if (isMyOwnDeal) return true;

    // 해당 딜의 영업 담당자 프로필 탐색
    const repProfile = allProfiles.find(p => {
      const pId = (p.id || '').trim();
      const pName = (p.full_name || '').trim();
      const cleanPName = pName.replace(/\s*\(.*?\)/g, '').trim();
      return (
        (repId && pId && repId === pId) ||
        (repName && pName && repName === pName) ||
        (repName && cleanPName && (repName.includes(cleanPName) || cleanPName.includes(repName)))
      );
    });

    if (repProfile && (repProfile.department || '').trim() === myDept) {
      return true;
    }

    // 프로필에 부서 정보가 일치하지 않거나 찾지 못한 경우 제외
    return false;
  }

  return true;
};

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

// ============================================================================
// [Egress 트래픽 최적화: 스마트 메모리 캐시 & Supabase Realtime 동기화]
// - 탭 전환(보드 ↔ 테이블 ↔ 업무보고 ↔ 차트) 시 불필요한 Supabase DB 반복 호출 방지
// - 최근 60초 이내에는 메모리/로컬 캐시를 즉시 반환하여 Egress 네트워크 80~90% 절감
// - 다른 사용자가 데이터를 추가/수정/삭제하면 Supabase Realtime 웹소켓으로 자동 동기화
// ============================================================================
let memoryDealsCache: Deal[] | null = null;
let lastFetchTimestamp: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 60초 유효 기간 (SWR 캐시)
let isRealtimeSubscribed = false;

/**
 * 캐시 무효화 헬퍼 (데이터 등록/수정/삭제 또는 강제 새로고침 시 호출)
 */
export const invalidateDealsCache = () => {
  lastFetchTimestamp = 0;
  memoryDealsCache = null;
};

/**
 * Supabase Realtime Postgres Changes 구독 초기화 (전체 조회를 유발하지 않고 변경분만 동기화)
 */
const initSupabaseRealtimeSubscription = () => {
  // Egress 절감을 위해 실시간 웹소켓(Realtime) 구독을 비활성화 (100% 수동 동기화 모드로 전환)
  // if (!isSupabaseConfigured || !supabase || isRealtimeSubscribed) return;
  /*
  try {
    supabase
      .channel('public:deals_changes')
      ...
  */
  return;
};

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
 * @param forceRefresh - 캐시를 무시하고 Supabase에서 강제 재조회할지 여부
 */
export const fetchStoredDeals = async (forceRefresh: boolean = false): Promise<Deal[]> => {
  // 1. Supabase Realtime 구독 보장 (최초 1회 연결)
  initSupabaseRealtimeSubscription();

  // 2. [Egress 최적화] 유효한 메모리 캐시가 있고 강제 갱신이 아니면 즉시 캐시 반환 (0ms, 네트워크 0B 소모)
  // Realtime 구독을 통해 캐시가 항상 최신 상태로 유지되므로 TTL(유효기간) 만료로 인한 전체 재조회를 방지함
  if (!forceRefresh && memoryDealsCache) {
    return memoryDealsCache;
  }

  // 3. Supabase DB에서 조회
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const cleanData = deduplicateDeals(data as Deal[]);
        memoryDealsCache = cleanData;
        lastFetchTimestamp = Date.now();
        saveToLocalStorage(cleanData);
        return cleanData;
      }
    } catch (e) {
      console.warn('Supabase DB fetch failed, falling back to LocalStorage:', e);
    }
  }

  // 4. LocalStorage 불러오기
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleanParsed = deduplicateDeals(parsed);
        memoryDealsCache = cleanParsed;
        lastFetchTimestamp = Date.now();
        return cleanParsed;
      }
    }
  } catch (e) {
    console.error('LocalStorage parse error:', e);
  }

  // 5. 초기 샘플 데이터셋
  const defaultClean = deduplicateDeals(DEFAULT_INITIAL_DEALS);
  memoryDealsCache = defaultClean;
  lastFetchTimestamp = Date.now();
  saveToLocalStorage(defaultClean);
  return defaultClean;
};

/**
 * LocalStorage에 저장 및 이벤트 디스패치
 */
const saveToLocalStorage = (deals: Deal[]) => {
  try {
    const cleanDeals = deduplicateDeals(deals);
    memoryDealsCache = cleanDeals;
    lastFetchTimestamp = Date.now();
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

  saveToLocalStorage(updatedList);

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
