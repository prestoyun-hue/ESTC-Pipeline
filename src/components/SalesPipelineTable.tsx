/**
 * ====================================================================
 * [영업 파이프라인 테이블 뷰 (SalesPipelineTable.tsx)]
 * --------------------------------------------------------------------
 * - Supabase `deals` DB 데이터를 표(Table) 형태로 한눈에 조회 및 관리
 * - 검색, 단계별/벤더별/구분별 필터링, 정렬, 딜 수정 및 신규 등록 모달 지원
 * - 수량(PC, Server), 금액 총계, 수주 성공률 등 하단/상단 요약 통계 제공
 * ====================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Deal, PipelineStage, UserRole, PipelineFilterOptions } from '../types';
import { fetchStoredDeals, subscribeToDealChanges, removeDeal, deduplicateDeals, isOverdueDeal } from '../utils/dealStorage';
import { DatePreset, DateTargetField, getDateRangeFromPreset, matchesDateRange, getKSTTodayString } from '../utils/dateFilter';
import { DateFilterControl } from './DateFilterControl';

// 파이프라인 단계 정의 배열
const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'lead', label: '1. 신규 리드 (10%)' },
  { id: 'contacted', label: '2. 미팅/접촉 (20%)' },
  { id: 'proposal', label: '3. 제안 (30%)' },
  { id: 'poc', label: '4. PoC (50%)' },
  { id: 'negotiation', label: '5. 견적/협상 (70%)' },
  { id: 'order', label: '6. 주문대기 (90%)' },
  { id: 'closed_won', label: '7. 수주 (100%)' },
  { id: 'closed_lost', label: '8. 실패 / 드랍 (0%)' }
];
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { DealFormModal } from './DealFormModal';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  Building2,
  DollarSign,
  Calendar,
  Layers,
  Edit2,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Server,
  Monitor,
  LayoutGrid,
  List,
  Sparkles
} from 'lucide-react';

// 폴백/데모 데이터
const MOCK_TABLE_DEALS: Deal[] = [
  {
    id: 'rpt-01',
    deal_code: 'DEAL-2026-001',
    title: '테크노바 Cloud CRM',
    company: '테크노바',
    partner_name: '씨앤에스',
    product_name: 'Enterprise CRM',
    pc_count: 120,
    server_count: 8,
    amount: 150000000,
    lead_source: '홈페이지',
    sales_rep_id: 'rep-01',
    sales_rep_name: '김영업',
    vendor: 'AWS',
    deal_type: '신규',
    probability: 80,
    stage: 'negotiation',
    received_date: '2026-07-05',
    expected_close_date: '2026-08-25',
    notes: '최종 가격 협상 중',
    created_at: '2026-07-05T10:00:00Z'
  },
  {
    id: 'rpt-02',
    deal_code: 'DEAL-2026-002',
    title: '글로벌 로지스틱스 AI 분석',
    company: '글로벌 로지스틱스',
    partner_name: '한진솔루션',
    product_name: 'AI Analytics Pro',
    pc_count: 50,
    server_count: 2,
    amount: 85000000,
    lead_source: '파트너',
    sales_rep_id: 'rep-01',
    sales_rep_name: '김영업',
    vendor: 'Azure',
    deal_type: '신규',
    probability: 50,
    stage: 'proposal',
    received_date: '2026-07-12',
    expected_close_date: '2026-09-10',
    created_at: '2026-07-12T11:00:00Z'
  },
  {
    id: 'rpt-03',
    deal_code: 'DEAL-2026-003',
    title: '한성물류 IoT 구축',
    company: '한성물류',
    partner_name: '자사 직판',
    product_name: 'IoT Suite',
    pc_count: 200,
    server_count: 16,
    amount: 220000000,
    lead_source: '지인소개',
    sales_rep_id: 'rep-02',
    sales_rep_name: '이수진',
    vendor: 'Dell',
    deal_type: '신규',
    probability: 100,
    stage: 'closed_won',
    close_reason: 'PoC 우수성 및 단가 경쟁력',
    received_date: '2026-06-15',
    expected_close_date: '2026-08-01',
    created_at: '2026-06-15T09:00:00Z'
  },
  {
    id: 'rpt-04',
    deal_code: 'DEAL-2026-004',
    title: '파이낸스원 보안 라이선스 갱신',
    company: '파이낸스원',
    product_name: 'SecureGate',
    pc_count: 80,
    server_count: 4,
    amount: 45000000,
    lead_source: '콜드콜',
    sales_rep_id: 'rep-01',
    sales_rep_name: '김영업',
    vendor: '자사제품',
    deal_type: '갱신',
    probability: 30,
    stage: 'contacted',
    received_date: '2026-07-20',
    expected_close_date: '2026-10-05',
    created_at: '2026-07-20T14:00:00Z'
  },
  {
    id: 'rpt-05',
    deal_code: 'DEAL-2026-005',
    title: '미래에셋 데이터플랫폼 고도화',
    company: '미래에셋',
    partner_name: '씨앤에스',
    product_name: 'DataPlatform Pro',
    pc_count: 300,
    server_count: 24,
    amount: 310000000,
    lead_source: '홈페이지',
    sales_rep_id: 'rep-02',
    sales_rep_name: '이수진',
    vendor: 'AWS',
    deal_type: '갱신',
    probability: 100,
    stage: 'closed_won',
    close_reason: '기존 라이선스 만족도 극대화',
    received_date: '2026-07-01',
    expected_close_date: '2026-08-15',
    created_at: '2026-07-01T08:00:00Z'
  },
  {
    id: 'rpt-06',
    deal_code: 'DEAL-2026-006',
    title: '대우건설 서버 인프라 교체',
    company: '대우건설',
    partner_name: '삼정아이티',
    product_name: 'PowerEdge R750',
    pc_count: 10,
    server_count: 32,
    amount: 180000000,
    lead_source: '행사',
    sales_rep_id: 'rep-03',
    sales_rep_name: '박관리',
    vendor: 'Dell',
    deal_type: '신규',
    probability: 0,
    stage: 'closed_lost',
    close_reason: '경쟁사 파격 할인 대응 불가',
    received_date: '2026-06-20',
    expected_close_date: '2026-07-30',
    created_at: '2026-06-20T13:00:00Z'
  }
];

interface SalesPipelineTableProps {
  initialFilters?: PipelineFilterOptions;
  onFiltersChange?: (filters: PipelineFilterOptions) => void;
  initialStageFilter?: string;
  onStageFilterChange?: (stage: string) => void;
}

export const SalesPipelineTable: React.FC<SalesPipelineTableProps> = ({
  initialFilters,
  onFiltersChange,
  initialStageFilter = 'all',
  onStageFilterChange
}) => {
  const { profile, role } = useAuth();

  // 데이터 및 데이터 로딩 상태
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>(initialStageFilter);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);

  // 기간 필터 상태
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateTargetField, setDateTargetField] = useState<DateTargetField>('expected_close_date');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // initialFilters가 변경되거나 전달된 경우 필터 상태 일괄 동기화
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.stage !== undefined) setSelectedStage(initialFilters.stage);
      if (initialFilters.searchTerm !== undefined) setSearchTerm(initialFilters.searchTerm);
      if (initialFilters.selectedRepFilter !== undefined) setSelectedRepFilter(initialFilters.selectedRepFilter);
      if (initialFilters.datePreset !== undefined) setDatePreset(initialFilters.datePreset);
      if (initialFilters.dateTargetField !== undefined) setDateTargetField(initialFilters.dateTargetField);
      if (initialFilters.startDate !== undefined) setStartDate(initialFilters.startDate);
      if (initialFilters.endDate !== undefined) setEndDate(initialFilters.endDate);
      if (initialFilters.selectedVendor !== undefined) setSelectedVendor(initialFilters.selectedVendor);
      if (initialFilters.selectedType !== undefined) setSelectedType(initialFilters.selectedType);
    } else if (initialStageFilter) {
      setSelectedStage(initialStageFilter);
    }
  }, [initialFilters, initialStageFilter]);

  const handleStageChange = (stageVal: string) => {
    setSelectedStage(stageVal);
    onStageFilterChange?.(stageVal);
  };

  // 정렬 상태 (컬럼명, 오름차순/내림차순)
  const [sortField, setSortField] = useState<'amount' | 'expected_close_date' | 'received_date' | 'company' | 'created_at' | 'updated_at'>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // 페이지네이션 및 표 UI 설정 상태
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [tableDensity, setTableDensity] = useState<'normal' | 'compact'>('normal');

  // 모달 상태 (신규 등록 / 수정)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [dealToEdit, setDealToEdit] = useState<Deal | null>(null);

  // 딜 목록 가져오기 및 실시간 구독
  const loadDeals = async () => {
    setLoading(true);
    try {
      const data = await fetchStoredDeals();
      setDeals(deduplicateDeals(data));
    } catch (err) {
      console.warn('테이블 딜 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
    const unsubscribe = subscribeToDealChanges((updatedDeals) => {
      setDeals(deduplicateDeals(updatedDeals));
    });
    return () => unsubscribe();
  }, [profile?.id, role]);

  // 딜 저장 성공 콜백 (INSERT / UPDATE)
  const handleSaveSuccess = (savedDeal: Deal, isUpdate: boolean) => {
    setDeals(prev => {
      const exists = prev.some(d => d.id === savedDeal.id);
      let updated: Deal[];
      if (isUpdate || exists) {
        updated = prev.map(d => d.id === savedDeal.id ? savedDeal : d);
      } else {
        updated = [savedDeal, ...prev];
      }
      return deduplicateDeals(updated);
    });

    // 검색어 및 필터 리셋하여 새로 저장된 딜이 항상 노출되도록 보장
    setSearchTerm('');
    setSelectedStage('all');
    setSelectedVendor('all');
    setSelectedType('all');
  };

  // 벤더 목록 생성 (딜 상세 내역 기반 - Dell, AWS 제외)
  const vendorList = useMemo(() => {
    const set = new Set<string>();
    const excludedVendors = new Set(['Dell', 'AWS']);
    deals.forEach(d => {
      if (d.vendor && !excludedVendors.has(d.vendor)) {
        set.add(d.vendor);
      }
    });
    // '기타' 항목이 있다면 맨 마지막으로 배치
    const list = Array.from(set).filter(v => v !== '기타').sort();
    if (set.has('기타')) list.push('기타');
    return list;
  }, [deals]);

  // 영업담당자 목록 생성 (딜 상세 내역 기반)
  const repOptions = useMemo(() => {
    const repSet = new Set<string>();
    deals.forEach(d => {
      if (d.sales_rep_name) {
        const clean = d.sales_rep_name.replace(/\s*\(.*?\)/g, '').trim();
        if (clean) repSet.add(clean);
      }
    });
    if (profile?.full_name) {
      const clean = profile.full_name.replace(/\s*\(.*?\)/g, '').trim();
      if (clean) repSet.add(clean);
    }
    return Array.from(repSet);
  }, [deals, profile?.full_name]);

  // 지연 딜 개수 계산 (예상 매출일 경과 & 미완료)
  const overdueCount = useMemo(() => {
    return deals.filter(isOverdueDeal).length;
  }, [deals]);

  // 검색 및 필터링 적용된 딜 목록
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // 영업 담당 권한인 경우 본인의 딜만 반환
      if (role === 'sales_rep') {
        const repName = (deal.sales_rep_name || '').trim();
        const repId = (deal.sales_rep_id || '').trim();
        const userId = (profile?.id || '').trim();
        const userFullName = (profile?.full_name || '').trim();
        const cleanUserName = userFullName.replace(/\s*\(.*?\)/g, '').trim();

        const isMyDeal = Boolean(
          (userId && repId && repId === userId) ||
          (userFullName && repName && repName === userFullName) ||
          (cleanUserName && repName && (repName.includes(cleanUserName) || cleanUserName.includes(repName)))
        );

        if (!isMyDeal) return false;
      }

      // 관리자 / 팀장 계정에서 영업 담당자 필터 적용
      if (role !== 'sales_rep' && selectedRepFilter !== 'all') {
        const dealRepClean = (deal.sales_rep_name || '').replace(/\s*\(.*?\)/g, '').trim();
        const filterRepClean = selectedRepFilter.replace(/\s*\(.*?\)/g, '').trim();
        const matchesRep = deal.sales_rep_name === selectedRepFilter ||
                           (dealRepClean && filterRepClean && (dealRepClean.includes(filterRepClean) || filterRepClean.includes(dealRepClean)));
        if (!matchesRep) return false;
      }

      // 지연 딜만 보기 필터
      if (onlyOverdue && !isOverdueDeal(deal)) {
        return false;
      }

      // 기간 필터 적용
      if (!matchesDateRange(deal, dateTargetField, startDate, endDate)) {
        return false;
      }

      // 키워드 검색 (고객사, 파트너사, 건명, 담당자, Deal-ID, 제품명)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = deal.title.toLowerCase().includes(term);
        const matchCompany = deal.company.toLowerCase().includes(term);
        const matchPartner = (deal.partner_name || '').toLowerCase().includes(term);
        const matchRep = (deal.sales_rep_name || '').toLowerCase().includes(term);
        const matchCode = (deal.deal_code || '').toLowerCase().includes(term);
        const matchProduct = (deal.product_name || '').toLowerCase().includes(term);
        if (!matchTitle && !matchCompany && !matchPartner && !matchRep && !matchCode && !matchProduct) {
          return false;
        }
      }

      // 단계 필터 (포캐스트는 0%, 100% 제외, 즉 closed_lost 및 closed_won 제외)
      if (selectedStage === 'forecast') {
        if (deal.stage === 'closed_lost' || deal.stage === 'closed_won') return false;
      } else if (selectedStage !== 'all' && deal.stage !== selectedStage) {
        return false;
      }

      // 벤더 필터
      if (selectedVendor !== 'all' && deal.vendor !== selectedVendor) {
        return false;
      }

      // 구분 필터
      if (selectedType !== 'all' && deal.deal_type !== selectedType) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any;
      let valB: any;
      if (sortField === 'received_date' || sortField === 'created_at') {
        valA = a.created_at || a.received_date || '';
        valB = b.created_at || b.received_date || '';
      } else {
        valA = a[sortField] || '';
        valB = b[sortField] || '';
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [deals, searchTerm, selectedStage, selectedVendor, selectedType, selectedRepFilter, onlyOverdue, datePreset, dateTargetField, startDate, endDate, role, profile, sortField, sortDirection]);

  // 하단 합계 통계 계산
  const totals = useMemo(() => {
    const totalAmount = filteredDeals.reduce((sum, d) => sum + d.amount, 0);
    const totalPc = filteredDeals.reduce((sum, d) => sum + (d.pc_count || 0), 0);
    const totalServer = filteredDeals.reduce((sum, d) => sum + (d.server_count || 0), 0);
    const wonDeals = filteredDeals.filter(d => d.stage === 'closed_won');
    const winRate = filteredDeals.length > 0 ? Math.round((wonDeals.length / filteredDeals.length) * 100) : 0;

    return {
      count: filteredDeals.length,
      amount: totalAmount,
      pcCount: totalPc,
      serverCount: totalServer,
      winRate
    };
  }, [filteredDeals]);

  // 상단 빠른 단계(Stage) 탭용 건수 집계 (전체 딜 기준)
  const stageTabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: deals.length,
      active: deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length,
      proposal_poc: deals.filter(d => d.stage === 'proposal' || d.stage === 'poc' || d.stage === 'negotiation').length,
      closed_won: deals.filter(d => d.stage === 'closed_won').length,
      closed_lost: deals.filter(d => d.stage === 'closed_lost').length,
    };
    return counts;
  }, [deals]);

  // 필터/검색 변경 시 페이지를 1페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStage, selectedVendor, selectedType, selectedRepFilter, onlyOverdue, datePreset, dateTargetField, startDate, endDate, pageSize]);

  // 페이지네이션 계산
  const totalPages = Math.max(1, Math.ceil(filteredDeals.length / pageSize));
  const paginatedDeals = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredDeals.slice(startIdx, startIdx + pageSize);
  }, [filteredDeals, currentPage, pageSize]);

  // 정렬 변경 토글
  const handleSort = (field: 'amount' | 'expected_close_date' | 'received_date' | 'company' | 'created_at' | 'updated_at') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 파이프라인 단계별 배지 스타일 및 한글 라벨 구하기
  const getStageBadge = (stageId: PipelineStage) => {
    const stageObj = PIPELINE_STAGES.find(s => s.id === stageId);
    if (!stageObj) return { label: stageId, bg: 'bg-slate-100 text-slate-700 border-slate-200' };

    switch (stageId) {
      case 'closed_won':
        return { label: '7. 수주 (100%)', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold' };
      case 'closed_lost':
        return { label: '8. 실패/드랍 (0%)', bg: 'bg-rose-50 text-rose-700 border-rose-200/80 font-bold' };
      case 'order':
        return { label: '6. 주문대기 (90%)', bg: 'bg-amber-50 text-amber-800 border-amber-200/80 font-bold' };
      case 'negotiation':
        return { label: '5. 견적/협상 (70%)', bg: 'bg-purple-50 text-purple-700 border-purple-200/80 font-bold' };
      case 'poc':
        return { label: '4. PoC (50%)', bg: 'bg-cyan-50 text-cyan-800 border-cyan-200/80 font-bold' };
      case 'proposal':
        return { label: '3. 제안 (30%)', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 font-bold' };
      case 'contacted':
        return { label: '2. 미팅/접촉 (20%)', bg: 'bg-sky-50 text-sky-700 border-sky-200/80 font-bold' };
      case 'lead':
      default:
        return { label: '1. 신규 리드 (10%)', bg: 'bg-blue-50 text-blue-700 border-blue-200/80 font-bold' };
    }
  };

  // CSV 단순 Export 기능
  const exportToCSV = () => {
    if (filteredDeals.length === 0) return;
    const headers = ['Deal-ID', '고객사', '영업건명', '영업담당자', '벤더', '파트너', '제품명', 'PC수량', 'Server수량', '금액(원)', '단계', '수주/실패사유', '접수일', '예상매출일'];
    const rows = filteredDeals.map(d => [
      d.deal_code || d.id,
      `"${d.company}"`,
      `"${d.title}"`,
      `"${d.sales_rep_name}"`,
      `"${d.vendor || ''}"`,
      `"${d.partner_name || ''}"`,
      `"${d.product_name || ''}"`,
      d.pc_count || 0,
      d.server_count || 0,
      d.amount,
      d.stage,
      `"${(d.close_reason || '').replace(/"/g, '""')}"`,
      d.received_date || '',
      d.expected_close_date || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `영업파이프라인_목록_${getKSTTodayString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* 1. 상단 타이틀 & 주요 액션 바 */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Table View Mode</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            영업 파이프라인 현황 리스트
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            전체 영업 딜 항목을 표 형태로 한눈에 검색, 정렬 및 신속히 편집할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSV 내보내기</span>
          </button>

          <button
            onClick={loadDeals}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={() => {
              setDealToEdit(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>딜 등록</span>
          </button>
        </div>
      </div>

      {/* 2. 빠른 단계 필터 탭 (Quick Stage Filter Tabs) & 뷰 옵션 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* 단계별 퀵 탭 */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full text-xs font-bold scrollbar-none">
          <button
            type="button"
            onClick={() => handleStageChange('all')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer border ${
              selectedStage === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>전체</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedStage === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {stageTabCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleStageChange('forecast')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer border ${
              selectedStage === 'forecast'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>진행 중 딜</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedStage === 'forecast' ? 'bg-blue-800 text-white' : 'bg-blue-50 text-blue-800'
            }`}>
              {stageTabCounts.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleStageChange('negotiation')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer border ${
              selectedStage === 'negotiation'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <span>견적/협상 (70%)</span>
          </button>

          <button
            type="button"
            onClick={() => handleStageChange('order')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer border ${
              selectedStage === 'order'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
            }`}
          >
            <span>주문대기 (90%)</span>
          </button>

          <button
            type="button"
            onClick={() => handleStageChange('closed_won')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer border ${
              selectedStage === 'closed_won'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>수주 완료</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedStage === 'closed_won' ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-800'
            }`}>
              {stageTabCounts.closed_won}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleStageChange('closed_lost')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer border ${
              selectedStage === 'closed_lost'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>실패/드랍</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedStage === 'closed_lost' ? 'bg-rose-800 text-white' : 'bg-rose-50 text-rose-800'
            }`}>
              {stageTabCounts.closed_lost}
            </span>
          </button>
        </div>

        {/* 행 밀도 (Dense/Normal) 및 페이지당 보기 개수 */}
        <div className="flex items-center space-x-2 shrink-0 self-end lg:self-auto">
          {/* 행 간격 조절 스위처 */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTableDensity('normal')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                tableDensity === 'normal'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="기본 행 간격"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>보통</span>
            </button>
            <button
              type="button"
              onClick={() => setTableDensity('compact')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                tableDensity === 'compact'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="좁은 행 간격 (한 화면에 더 많은 데이터 표시)"
            >
              <List className="w-3.5 h-3.5" />
              <span>컴팩트</span>
            </button>
          </div>

          {/* 페이지당 표시 개수 */}
          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium">
            <span className="text-slate-500 text-[11px]">보기:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value={10}>10개씩</option>
              <option value={20}>20개씩</option>
              <option value={50}>50개씩</option>
              <option value={100}>100개씩</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. 검색 및 상세 조건 필터 바 */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        
        {/* 상단: 기간 선택 필터 바 */}
        <DateFilterControl
          preset={datePreset}
          targetField={dateTargetField}
          startDate={startDate}
          endDate={endDate}
          onPresetChange={(p, s, e) => {
            setDatePreset(p);
            if (s !== undefined) setStartDate(s);
            if (e !== undefined) setEndDate(e);
          }}
          onTargetFieldChange={(f) => setDateTargetField(f)}
          onCustomDateChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
          onReset={() => {
            setDatePreset('all');
            setDateTargetField('expected_close_date');
            setStartDate('');
            setEndDate('');
          }}
        />

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
          
          {/* 키워드 검색창 */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="고객사, 파트너사, 건명 검색..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 필터 세그먼트 Dropdown 그룹 */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto text-xs">
            
            {/* 영업 담당자 필터: 영업 담당(sales_rep) 로그인 시 숨김 */}
            {role !== 'sales_rep' && (
              <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <span className="text-slate-500 text-[11px] font-semibold">담당자:</span>
                <select
                  value={selectedRepFilter}
                  onChange={(e) => setSelectedRepFilter(e.target.value)}
                  className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">전체 담당자</option>
                  {repOptions.map(repName => (
                    <option key={repName} value={repName}>{repName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 단계 필터 드롭다운 */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-slate-500 text-[11px] font-semibold">세부단계:</span>
              <select
                value={selectedStage}
                onChange={(e) => handleStageChange(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">전체 단계</option>
                <option value="forecast">포캐스트 (진행중 딜)</option>
                {PIPELINE_STAGES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* 벤더 필터 */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-slate-500 text-[11px] font-semibold">벤더:</span>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">전체 벤더</option>
                {vendorList.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* 구분(신규/갱신) 필터 */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-slate-500 text-[11px] font-semibold">구분:</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all">전체 구분</option>
                <option value="신규">신규</option>
                <option value="갱신">갱신</option>
              </select>
            </div>

            {/* 매출일 지연 딜 전용 토글 버튼 */}
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => setOnlyOverdue(prev => !prev)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
                  onlyOverdue
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
                title="예상 매출일이 지났으나 0%/100% 미완료 상태인 딜만 필터링합니다."
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>매출일 지연</span>
              </button>
            )}

            {/* 리셋 */}
            {(searchTerm || selectedStage !== 'all' || selectedVendor !== 'all' || selectedType !== 'all' || selectedRepFilter !== 'all' || onlyOverdue || datePreset !== 'all' || Boolean(startDate) || Boolean(endDate)) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedStage('all');
                  setSelectedVendor('all');
                  setSelectedType('all');
                  setSelectedRepFilter('all');
                  setOnlyOverdue(false);
                  setDatePreset('all');
                  setDateTargetField('expected_close_date');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer ml-1"
              >
                초기화
              </button>
            )}

          </div>
        </div>
      </div>

      {/* 4. 테이블 데이터 영역 (Sticky Header & 높이 지정 컨테이너) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs border-b border-slate-200">
              <tr className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'}`}>Deal-ID</th>
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'}`}>
                  <button onClick={() => handleSort('company')} className="flex items-center space-x-1 hover:text-blue-600 cursor-pointer">
                    <span>고객사 / 영업건명</span>
                    {sortField === 'company' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'}`}>담당자</th>
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'}`}>벤더 / 파트너 / 제품</th>
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'} text-center`}>수량(PC/SVR)</th>
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'} text-right`}>
                  <button onClick={() => handleSort('amount')} className="flex items-center space-x-1 hover:text-blue-600 ml-auto cursor-pointer">
                    <span>예상 금액</span>
                    {sortField === 'amount' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'} text-center`}>진행 단계</th>
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'} text-center`}>
                  <button onClick={() => handleSort('received_date')} className="flex items-center space-x-1 hover:text-blue-600 mx-auto cursor-pointer">
                    <span>등록일</span>
                    {sortField === 'received_date' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'} text-center`}>
                  <button onClick={() => handleSort('expected_close_date')} className="flex items-center space-x-1 hover:text-blue-600 mx-auto cursor-pointer">
                    <span>예상 매출일</span>
                    {sortField === 'expected_close_date' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className={`${tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4'} text-center`}>
                  <button onClick={() => handleSort('updated_at')} className="flex items-center space-x-1 hover:text-blue-600 mx-auto cursor-pointer">
                    <span>업데이트 일시</span>
                    {sortField === 'updated_at' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>영업 파이프라인 데이터를 불러오는 중입니다...</span>
                  </td>
                </tr>
              ) : filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <p className="font-bold text-slate-600">조회된 영업 딜 데이터가 없습니다.</p>
                    <p className="text-[11px] mt-1">검색 조건이나 필터를 변경해 보세요.</p>
                  </td>
                </tr>
              ) : (
                paginatedDeals.map((deal) => {
                  const badge = getStageBadge(deal.stage);
                  const isOverdue = isOverdueDeal(deal);
                  const displayUpdatedAt = deal.updated_at 
                    ? (deal.updated_at.includes('T') ? deal.updated_at.split('T')[0] : deal.updated_at)
                    : (deal.received_date || deal.created_at?.split('T')[0] || '-');
                  const displayCreatedDate = deal.created_at 
                    ? (deal.created_at.includes('T') ? deal.created_at.split('T')[0] : deal.created_at)
                    : (deal.received_date || '-');
                  const cellPadding = tableDensity === 'compact' ? 'py-2 px-3' : 'py-3.5 px-4';

                  return (
                    <tr
                      key={deal.id}
                      onClick={() => {
                        setDealToEdit(deal);
                        setIsModalOpen(true);
                      }}
                      className={`transition-colors cursor-pointer group ${
                        isOverdue
                          ? 'bg-rose-50/70 hover:bg-rose-100/80 border-l-4 border-l-rose-500'
                          : 'hover:bg-blue-50/50'
                      }`}
                    >
                      {/* Deal-ID */}
                      <td className={`${cellPadding} font-mono font-bold text-slate-600 text-[11px]`}>
                        {deal.deal_code || deal.id.slice(0, 10)}
                      </td>

                      {/* 고객사 / 영업건명 */}
                      <td className={`${cellPadding} max-w-xs`}>
                        <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span>{deal.company}</span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold text-[10px] rounded border border-rose-200 inline-flex items-center space-x-0.5 shrink-0" title="예상 매출일이 경과되었으나 미완료된 딜입니다.">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>매출일 지연</span>
                            </span>
                          )}
                          {deal.deal_type && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-normal rounded-md border border-slate-200 shrink-0">
                              {deal.deal_type}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {deal.title}
                        </div>
                      </td>

                      {/* 영업담당자 */}
                      <td className={`${cellPadding} font-semibold text-slate-700`}>
                        {deal.sales_rep_name || '미지정'}
                      </td>

                      {/* 벤더 / 파트너 / 제품 */}
                      <td className={`${cellPadding}`}>
                        <div className="flex items-center space-x-1">
                          <span className="font-bold text-slate-800">{deal.vendor || '-'}</span>
                          {deal.partner_name && (
                            <span className="text-[10px] text-slate-400 font-normal">({deal.partner_name})</span>
                          )}
                        </div>
                        {deal.product_name && (
                          <div className="text-[11px] text-blue-600 font-medium truncate">
                            {deal.product_name}
                          </div>
                        )}
                      </td>

                      {/* 수량 (PC / Server) */}
                      <td className={`${cellPadding} text-center font-mono`}>
                        <div className="inline-flex items-center space-x-2 text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/60">
                          <span className="flex items-center space-x-0.5" title="PC 수량">
                            <Monitor className="w-3 h-3 text-slate-400" />
                            <span>{deal.pc_count || 0}</span>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center space-x-0.5" title="Server 수량">
                            <Server className="w-3 h-3 text-slate-400" />
                            <span>{deal.server_count || 0}</span>
                          </span>
                        </div>
                      </td>

                      {/* 예상 금액 */}
                      <td className={`${cellPadding} text-right font-bold text-slate-900 font-mono text-sm`}>
                        ₩{deal.amount.toLocaleString('ko-KR')}
                      </td>

                      {/* 진행 단계 & 수주/실패 사유 */}
                      <td className={`${cellPadding} text-center`}>
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {deal.close_reason && (
                          <div 
                            className={`mt-1 text-[10px] font-medium px-2 py-0.5 rounded-md border inline-block max-w-[150px] truncate ${
                              deal.stage === 'closed_lost'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : deal.stage === 'closed_won'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                            title={`${deal.stage === 'closed_lost' ? '실패 사유' : deal.stage === 'closed_won' ? '수주 사유' : '사유'}: ${deal.close_reason}`}
                          >
                            <span className="font-bold mr-0.5">{deal.stage === 'closed_lost' ? '실패:' : deal.stage === 'closed_won' ? '수주:' : '사유:'}</span>
                            <span>{deal.close_reason}</span>
                          </div>
                        )}
                      </td>

                      {/* 등록일 */}
                      <td className={`${cellPadding} text-center font-mono text-[11px] text-slate-700 font-medium`}>
                        {displayCreatedDate}
                      </td>

                      {/* 예상 매출일 */}
                      <td className={`${cellPadding} text-center font-mono text-[11px]`}>
                        {isOverdue ? (
                          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-rose-100 text-rose-800 font-extrabold rounded-lg border border-rose-300 shadow-2xs" title="예상 매출일이 경과되었으나 미완료 상태입니다.">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />
                            <span>{deal.expected_close_date}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 font-medium">{deal.expected_close_date || '-'}</span>
                        )}
                      </td>

                      {/* 업데이트 일시 및 히스토리 건수 */}
                      <td className={`${cellPadding} text-center`}>
                        <div className="font-mono text-[11px] text-slate-700 font-medium">
                          {displayUpdatedAt}
                        </div>
                        {deal.history && deal.history.length > 0 && (
                          <div className="text-[10px] text-blue-600 font-bold mt-0.5">
                            히스토리 {deal.history.length}건
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 바 */}
        {filteredDeals.length > 0 && (
          <div className="p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 text-[11px] font-medium">
              전체 <span className="font-bold text-slate-800 font-mono">{filteredDeals.length}</span>건 중{' '}
              <span className="font-bold text-slate-800 font-mono">{(currentPage - 1) * pageSize + 1}</span> -{' '}
              <span className="font-bold text-slate-800 font-mono">{Math.min(currentPage * pageSize, filteredDeals.length)}</span>건 표시
            </div>

            {/* 페이지 번호 버튼 그룹 */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                title="첫 페이지"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                title="이전 페이지"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* 페이지 번호 목록 */}
              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .filter(page => {
                  // 현재 페이지 기준 앞뒤 2개씩 노출
                  return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2;
                })
                .map((page, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && page - prev > 1;

                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-7 h-7 px-2 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                          currentPage === page
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                title="다음 페이지"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                title="마지막 페이지"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 하단 요약 통계 푸터 */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-700">
          <div className="flex items-center space-x-4">
            <span>필터링된 딜: <span className="text-blue-600 font-mono text-sm">{totals.count}</span>건</span>
            <span className="text-slate-300">|</span>
            <span>합계 금액: <span className="text-emerald-700 font-mono text-sm">₩{totals.amount.toLocaleString('ko-KR')}</span></span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] text-slate-600">
            <span>PC 총합: <span className="font-mono text-slate-900">{totals.pcCount}</span>대</span>
            <span>Server 총합: <span className="font-mono text-slate-900">{totals.serverCount}</span>대</span>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
              수주 성공률: {totals.winRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 딜 작성/수정 모달 */}
      <DealFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setDealToEdit(null);
        }}
        onSaveSuccess={handleSaveSuccess}
        onDeleteSuccess={(deletedId) => {
          setDeals(prev => prev.filter(d => d.id !== deletedId));
          setIsModalOpen(false);
          setDealToEdit(null);
        }}
        dealToEdit={dealToEdit}
        currentUserId={profile?.id}
        currentUserName={profile?.full_name}
      />

    </div>
  );
};
