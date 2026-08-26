/**
 * 영업 파이프라인 애플리케이션 타입 정의
 * 사용자 역할(Role), 프로필, 영업 거래(Deal), 파이프라인 단계 관련 인터페이스
 */

// 사용자 역할 정의 (시스템 관리자, 부서 관리자, 영업 담당, 조회 전용 뷰어)
export type UserRole = 'admin' | 'dept_manager' | 'manager' | 'sales_rep' | 'viewer';

// Supabase profiles 테이블 데이터 인터페이스
export interface UserProfile {
  id: string;             // Supabase auth.users ID와 연결
  email: string;          // 이메일 주소
  full_name: string;      // 사용자 이름
  role: UserRole;         // 사용자 역할 (sales_rep, manager, admin)
  avatar_url?: string;    // 프로필 이미지 URL (선택)
  department?: string;    // 부서명 (예: 영업 1팀, 수도권 본부)
  password?: string;      // 계정 비밀번호
  is_disabled?: boolean;  // 계정 비활성화 여부 (true인 경우 접속 제한)
  created_at?: string;    // 프로필 생성일
  updated_at?: string;    // 프로필 수정일
}

// 영업 파이프라인 단계 (Sales Pipeline Stage)
export type PipelineStage = 
  | 'lead'              // 신규 리드 (Lead)
  | 'contacted'         // 미팅/접촉 (Contacted)
  | 'proposal'          // 제안 (Proposal)
  | 'poc'               // PoC 진행 (PoC)
  | 'negotiation'       // 협상 (Negotiation)
  | 'order'             // 주문/발주 (Order)
  | 'closed_won'        // 계약 성공 (Win)
  | 'closed_lost';      // 계약 실패 (Lost)

// 딜 변경 히스토리 인터페이스
export interface DealHistoryItem {
  id: string;
  updated_at: string;        // 변경 일시
  updated_by_name?: string;  // 변경자 이름
  changes: string;           // 변경된 요약 정보
  note?: string;             // 변경 시 메모
  activity_type?: string;    // 진행 형태 (통화, 미팅, 이메일, 기타)
}

// 영업 기회 / 딜(Deal) 상세 인터페이스
export interface Deal {
  id: string;                      // DB ID (UUID 또는 고유 식별자)
  deal_code?: string;              // Deal-ID (예: DEAL-2026-001)
  title: string;                   // 딜 제목 / 영업 건명
  company: string;                 // 고객사명
  partner_name?: string;           // 파트너명
  product_name?: string;           // 제품명
  pc_count?: number;               // PC# (수량)
  server_count?: number;           // Server# (수량)
  competitor_product?: string;     // 경쟁제품
  amount: number;                  // 금액 (원)
  
  // 드롭다운 및 선택 필드
  lead_source?: string;            // Source (파트너 영업, 갱신 대상, 인바운드, 해피콜, 아웃바운드, 기존 고객, 지인 소개, 세미나/전시회, 기타)
  sales_rep_id: string;            // 영업담당자 ID (profiles.id)
  sales_rep_name: string;          // 영업담당자 이름
  vendor?: string;                 // 벤더 (ESET, Hillstone, SealSuite, RidgeSecurity, ISLOnline, Wondershare, Corel, AXGate, Paloalto, Fortinet, Nueshield, Veeam 등)
  deal_type?: string;              // 구분 (신규, 갱신)
  probability: number;             // 진행률 (0, 10, 30, 50, 70, 90, 100)
  stage: PipelineStage;            // 단계 (리드, 미팅/접촉, 제안, PoC, 협상, 주문, Win, Lost)
  close_reason?: string;           // 사유 (Win/Lost 선택 시 활성화되는 수주/실주 사유)

  // 날짜 필드
  received_date?: string;          // 접수일 (YYYY-MM-DD)
  expected_close_date: string;     // 예상매출일 (YYYY-MM-DD)

  // 진행 내용
  notes?: string;                  // 진행내용 (최신 진행상황)
  activity_type?: '통화' | '미팅' | '이메일' | '기타' | string; // 진행 형태 (통화, 미팅, 이메일, 기타)
  
  // 기타 선택 필드
  contact_person?: string;         // 고객 담당자 성함
  contact_email?: string;          // 고객 담당자 이메일
  created_at?: string;
  updated_at?: string;             // 최종 수정/업데이트 날짜
  history?: DealHistoryItem[];     // 수정 히스토리 이력
}

// Supabase 클라이언트 연결 상태
export interface SupabaseConfigStatus {
  isConfigured: boolean;  // 환경변수가 제대로 세팅되어 실제 Supabase에 연결되었는지 여부
  supabaseUrl: string;    // 사용 중인 Supabase URL
  hasAnonKey: boolean;    // Anon Key 설정 유무
}

// 기간 필터 프리셋 및 대상 필드 타입
export type DatePreset = 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'first_half' | 'second_half' | 'this_year' | 'custom';
export type DateTargetField = 'expected_close_date' | 'received_date' | 'created_at' | 'updated_at';

// 파이프라인 필터 옵션 인터페이스 (보드 -> 현황 테이블 이동 시 필터 연동)
export interface PipelineFilterOptions {
  stage?: string;
  searchTerm?: string;
  selectedDeptFilter?: string;
  selectedRepFilter?: string;
  datePreset?: DatePreset;
  dateTargetField?: DateTargetField;
  startDate?: string;
  endDate?: string;
  selectedVendor?: string;
  selectedType?: string;
}
