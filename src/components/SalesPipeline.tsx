/**
 * ====================================================================
 * [영업 파이프라인 (Sales Pipeline) 메인 보드 컴포넌트]
 * --------------------------------------------------------------------
 * - 파이프라인 단계별 딜(Deal) 카드 관리 (리드 -> 접촉 -> 제안 -> PoC -> 협상 -> 주문 -> Win/Lost)
 * - Supabase DB `deals` 테이블 연동 (Supabase 미설정 시 로컬 데모 상태 구동)
 * - 딜 등록 및 수정 입력 폼(DealFormModal) 연동
 * - 사용자 역할(sales_rep, manager, admin)에 따른 실시간 필터 및 가시성 제공
 * ====================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Deal, PipelineStage, PipelineFilterOptions, UserProfile } from '../types';
import { DealFormModal } from './DealFormModal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  fetchStoredDeals,
  subscribeToDealChanges,
  deduplicateDeals,
  isOverdueDeal,
  isDealVisibleToUser,
  getDealDepartment,
  extractDepartmentList,
  isDealInDepartment,
  normalizeDept
} from '../utils/dealStorage';
import { DatePreset, DateTargetField, getDateRangeFromPreset, matchesDateRange } from '../utils/dateFilter';
import { DateFilterControl } from './DateFilterControl';
import { 
  Plus, 
  Building2, 
  DollarSign, 
  Calendar, 
  User, 
  ArrowRightLeft, 
  TrendingUp, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Filter,
  Sparkles,
  Search,
  Laptop,
  Server,
  RefreshCw,
  Tag,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronsLeftRight,
  Layers,
  LayoutGrid,
  List
} from 'lucide-react';

// 확장된 파이프라인 단계 메타데이터
const STAGES: { id: PipelineStage; title: string; color: string; badge: string }[] = [
  { id: 'lead', title: '1. 신규 리드 (10%)', color: 'border-slate-200 bg-slate-50/60', badge: 'bg-slate-200 text-slate-700' },
  { id: 'contacted', title: '2. 미팅/접촉 (20%)', color: 'border-blue-200 bg-blue-50/40', badge: 'bg-blue-100 text-blue-700' },
  { id: 'proposal', title: '3. 제안 (30%)', color: 'border-indigo-200 bg-indigo-50/40', badge: 'bg-indigo-100 text-indigo-700' },
  { id: 'poc', title: '4. PoC (50%)', color: 'border-cyan-200 bg-cyan-50/40', badge: 'bg-cyan-100 text-cyan-800' },
  { id: 'negotiation', title: '5. 견적/협상 (70%)', color: 'border-purple-200 bg-purple-50/40', badge: 'bg-purple-100 text-purple-700' },
  { id: 'order', title: '6. 주문대기 (90%)', color: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-100 text-amber-800' },
  { id: 'closed_won', title: '7. 수주 (100%)', color: 'border-emerald-200 bg-emerald-50/40', badge: 'bg-emerald-100 text-emerald-700' },
  { id: 'closed_lost', title: '8. 실패 / 드랍 (0%)', color: 'border-rose-200 bg-rose-50/40', badge: 'bg-rose-100 text-rose-700' },
];

interface SalesPipelineProps {
  onNavigateToTable?: (filters: PipelineFilterOptions) => void;
}

export const SalesPipeline: React.FC<SalesPipelineProps> = ({ onNavigateToTable }) => {
  const { profile, role } = useAuth();

  // 딜 데이터 목록 상태 (초기 로딩 시 더미 데이터 깜빡임 방지를 위해 빈 배열로 시작)
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDB, setLoadingDB] = useState<boolean>(true);

  // 검색, 부서 및 담당자 필터
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');

  // 기간 필터 상태
  const initialRange = getDateRangeFromPreset('this_month');
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [dateTargetField, setDateTargetField] = useState<DateTargetField>('expected_close_date');
  const [startDate, setStartDate] = useState<string>(initialRange.startDate);
  const [endDate, setEndDate] = useState<string>(initialRange.endDate);

  // 모달 제어 상태 (등록 및 수정)
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [dealToEdit, setDealToEdit] = useState<Deal | null>(null);

  // 칸반 보드 UX 설정: 카드 뷰 모드 (상세 vs 컴팩트) 및 컬럼 접기(Collapse) 상태
  const [cardViewMode, setCardViewMode] = useState<'detailed' | 'compact'>('detailed');
  const [collapsedStages, setCollapsedStages] = useState<Record<PipelineStage, boolean>>({
    lead: false,
    contacted: false,
    proposal: false,
    poc: false,
    negotiation: false,
    order: false,
    closed_won: false,
    closed_lost: false,
  });

  // 특정 컬럼 접기/펼치기 토글 핸들러
  const toggleStageCollapse = (stageId: PipelineStage) => {
    setCollapsedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  // 완료된 컬럼(수주/실패) 일괄 접기/펼치기
  const toggleAllClosedStages = () => {
    const isBothCollapsed = collapsedStages.closed_won && collapsedStages.closed_lost;
    setCollapsedStages(prev => ({
      ...prev,
      closed_won: !isBothCollapsed,
      closed_lost: !isBothCollapsed
    }));
  };

  // 프로필 목록 (부서 관리자 매핑용)
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        let loaded: UserProfile[] = [];
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from('profiles').select('*');
          if (!error && data && data.length > 0) {
            loaded = data.map((item: any) => ({
              id: item.id,
              email: item.email,
              full_name: item.full_name || item.name || '사용자',
              department: item.department || '영업부',
              role: (item.role as any) || 'sales_rep',
              is_disabled: !!item.is_disabled,
              created_at: item.created_at,
              updated_at: item.updated_at,
            }));
          }
        }
        if (loaded.length === 0) {
          const savedProfiles = localStorage.getItem('crm_user_profiles_v2') || localStorage.getItem('admin_user_profiles') || localStorage.getItem('sales_pipeline_profiles');
          if (savedProfiles) {
            const parsed = JSON.parse(savedProfiles);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loaded = parsed;
            }
          }
        }
        if (loaded.length > 0) {
          setProfiles(loaded);
        }
      } catch (e) {
        console.warn('프로필 로드 오류:', e);
      }
    };
    fetchProfiles();
  }, []);

  // 딜 데이터 로드 및 실시간 구독
  const loadDeals = async (forceRefresh: boolean = false) => {
    setLoadingDB(true);
    try {
      const data = await fetchStoredDeals(forceRefresh);
      setDeals(deduplicateDeals(data));
    } catch (err) {
      console.warn('딜 조회 실패:', err);
    } finally {
      setLoadingDB(false);
    }
  };

  useEffect(() => {
    loadDeals();
    const unsubscribe = subscribeToDealChanges((updatedDeals) => {
      setDeals(deduplicateDeals(updatedDeals));
    });
    return () => unsubscribe();
  }, [role, profile?.id]);

  // 신규 등록 버튼 클릭
  const handleOpenCreateModal = () => {
    setDealToEdit(null);
    setIsFormModalOpen(true);
  };

  // 기존 딜 카드 클릭 시 수정 모달 오픈
  const handleOpenEditModal = (deal: Deal) => {
    setDealToEdit(deal);
    setIsFormModalOpen(true);
  };

  // 모달 저장 성공 콜백 (INSERT / UPDATE)
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

    // 신규 등록 또는 수정된 딜이 담당자/검색어 필터 때문에 보이지 않는 현상 방지
    const repNameClean = (savedDeal.sales_rep_name || '').replace(/\s*\(.*?\)/g, '').trim();
    if (selectedRepFilter !== 'all' && selectedRepFilter !== repNameClean) {
      setSelectedRepFilter('all');
    }
    setSearchTerm('');
  };

  // 모달 삭제 성공 콜백 (DELETE)
  const handleDeleteSuccess = (deletedId: string) => {
    setDeals(prev => prev.filter(d => d.id !== deletedId));
  };

  // 권한(Role) 및 부서 기반 가시 딜 목록 계산
  const visibleDeals = useMemo(() => {
    return deals.filter(deal => isDealVisibleToUser(deal, profile, role, profiles));
  }, [deals, profile, role, profiles]);

  // 부서 목록 추출
  const departmentList = useMemo(() => {
    return extractDepartmentList(visibleDeals, profiles);
  }, [visibleDeals, profiles]);

  // 등록된 딜 상세 내역 기반으로 영업담당자 드롭다운 목록 동적 구성 (실제 딜이 있는 담당자만)
  const repOptions = useMemo(() => {
    const repSet = new Set<string>();
    visibleDeals.forEach(d => {
      if (d.sales_rep_name) {
        const clean = d.sales_rep_name.replace(/\s*\(.*?\)/g, '').trim();
        if (clean) repSet.add(clean);
      }
    });
    return Array.from(repSet).sort();
  }, [visibleDeals]);

  // 선택된 부서에 속한 영업담당자 목록
  const filteredRepOptions = useMemo(() => {
    if (selectedDeptFilter === 'all') {
      return repOptions;
    }
    const set = new Set<string>();
    visibleDeals.forEach(d => {
      if (isDealInDepartment(d, selectedDeptFilter, profiles) && d.sales_rep_name) {
        const cleanName = d.sales_rep_name.replace(/\s*\(.*?\)/g, '').trim();
        if (cleanName) set.add(cleanName);
      }
    });
    return Array.from(set).sort();
  }, [repOptions, selectedDeptFilter, visibleDeals, profiles]);

  // 선택된 기간 기준 가시 딜 목록
  const dateFilteredDeals = useMemo(() => {
    return visibleDeals.filter(deal => {
      return matchesDateRange(deal, dateTargetField, startDate, endDate);
    });
  }, [visibleDeals, dateTargetField, startDate, endDate]);

  // 필터링된 딜 목록 (기간 딜 기준 + 부서 + 검색어 + 담당자 선택 필터)
  const filteredDeals = useMemo(() => {
    return dateFilteredDeals.filter(deal => {
      // 0. 부서 필터
      if (selectedDeptFilter !== 'all') {
        if (!isDealInDepartment(deal, selectedDeptFilter, profiles)) {
          return false;
        }
      }

      // 1. 키워드 검색
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        deal.company.toLowerCase().includes(searchLower) ||
        deal.title.toLowerCase().includes(searchLower) ||
        (deal.partner_name && deal.partner_name.toLowerCase().includes(searchLower)) ||
        (deal.sales_rep_name && deal.sales_rep_name.toLowerCase().includes(searchLower)) ||
        (deal.vendor && deal.vendor.toLowerCase().includes(searchLower)) ||
        (deal.deal_code && deal.deal_code.toLowerCase().includes(searchLower)) ||
        (deal.product_name && deal.product_name.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      // 2. 담당자 필터
      const dealRepClean = (deal.sales_rep_name || '').replace(/\s*\(.*?\)/g, '').trim();
      const filterRepClean = selectedRepFilter.replace(/\s*\(.*?\)/g, '').trim();
      const matchesRep = role === 'sales_rep' || selectedRepFilter === 'all' || 
                         deal.sales_rep_name === selectedRepFilter || 
                         (dealRepClean && filterRepClean && (dealRepClean.includes(filterRepClean) || filterRepClean.includes(dealRepClean)));

      return matchesRep;
    });
  }, [dateFilteredDeals, selectedDeptFilter, selectedRepFilter, searchTerm, role, profiles]);

  // 주요 통계 지표 계산 (현재 적용된 검색어, 영업담당자, 기간 필터 filteredDeals 기준)
  // 1. 선택 필터 기준 포캐스트 금액 (0%, 100% 제외, 즉 closed_lost 및 closed_won 제외한 진행 중 기회 딜 금액 합계)
  const monthlyForecastAmount = filteredDeals
    .filter(d => d.stage !== 'closed_lost' && d.stage !== 'closed_won')
    .reduce((sum, d) => sum + d.amount, 0);

  // 2. 선택 필터 기준 매출 금액 (closed_won 딜 금액 합계)
  const monthlyWonAmount = filteredDeals
    .filter(d => d.stage === 'closed_won')
    .reduce((sum, d) => sum + d.amount, 0);

  // 3. 선택 필터 기준 드랍 금액 (closed_lost 딜 금액 합계)
  const monthlyLostAmount = filteredDeals
    .filter(d => d.stage === 'closed_lost')
    .reduce((sum, d) => sum + d.amount, 0);

  const activeDealsCount = filteredDeals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length;
  const wonDealsCount = filteredDeals.filter(d => d.stage === 'closed_won').length;
  const lostDealsCount = filteredDeals.filter(d => d.stage === 'closed_lost').length;

  // 금액 카드 클릭 시 현재 파이프라인 보드에 설정된 모든 필터를 파이프라인 현황 테이블로 전달
  const handleCardClick = (stage: string) => {
    onNavigateToTable?.({
      stage,
      searchTerm,
      selectedDeptFilter,
      selectedRepFilter,
      datePreset,
      dateTargetField,
      startDate,
      endDate
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 헤더 및 통계 카드 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 카드 1: 포캐스트 금액 */}
        <div 
          onClick={() => handleCardClick('forecast')}
          className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
          title="클릭 시 포캐스트(0%, 100% 제외) 파이프라인 현황 목록으로 이동"
        >
          <div>
            <div className="flex items-center space-x-1.5">
              <p className="text-xs font-bold text-slate-500 group-hover:text-blue-600 transition-colors">포캐스트 금액</p>
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 opacity-0 group-hover:opacity-100 transition-opacity">
                현황 보기 ➔
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mt-1 font-mono group-hover:text-blue-700 transition-colors">
              ₩{monthlyForecastAmount.toLocaleString('ko-KR')}
            </h3>
            <p className="text-[11px] text-blue-600 font-medium mt-1">
              진행 중 영업 기회 (0%, 100% 제외): {activeDealsCount}건
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* 카드 2: 매출 금액 */}
        <div 
          onClick={() => handleCardClick('closed_won')}
          className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group"
          title="클릭 시 수주(매출) 완료 파이프라인 현황 목록으로 이동"
        >
          <div>
            <div className="flex items-center space-x-1.5">
              <p className="text-xs font-bold text-slate-500 group-hover:text-emerald-600 transition-colors">매출 금액</p>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity">
                현황 보기 ➔
              </span>
            </div>
            <h3 className="text-xl font-bold text-emerald-600 mt-1 font-mono group-hover:text-emerald-700 transition-colors">
              ₩{monthlyWonAmount.toLocaleString('ko-KR')}
            </h3>
            <p className="text-[11px] text-emerald-600/80 font-medium mt-1">
              수주 완료건: {wonDealsCount}건
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* 카드 3: 드랍 금액 */}
        <div 
          onClick={() => handleCardClick('closed_lost')}
          className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between cursor-pointer hover:border-rose-300 hover:shadow-md transition-all group"
          title="클릭 시 드랍/실패 파이프라인 현황 목록으로 이동"
        >
          <div>
            <div className="flex items-center space-x-1.5">
              <p className="text-xs font-bold text-slate-500 group-hover:text-rose-600 transition-colors">드랍 금액</p>
              <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100 opacity-0 group-hover:opacity-100 transition-opacity">
                현황 보기 ➔
              </span>
            </div>
            <h3 className="text-xl font-bold text-rose-600 mt-1 font-mono group-hover:text-rose-700 transition-colors">
              ₩{monthlyLostAmount.toLocaleString('ko-KR')}
            </h3>
            <p className="text-[11px] text-rose-600/80 font-medium mt-1">
              드랍/실패건: {lostDealsCount}건
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-all">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 필터 및 신규 딜 등록 컨트롤 바 */}
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
            const init = getDateRangeFromPreset('this_month');
            setDatePreset('this_month');
            setDateTargetField('expected_close_date');
            setStartDate(init.startDate);
            setEndDate(init.endDate);
          }}
        />

        {/* 하단: 키워드 검색, 영업담당자 필터, 보드 뷰 옵션, 신규 딜 등록 버튼 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="고객사, 파트너사, 건명 검색..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* 부서 필터: 시스템 관리자 / 딜조회(뷰어) / 매니저 */}
            {role !== 'sales_rep' && departmentList.length > 0 && (
              <div className="flex items-center space-x-1 shrink-0">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => {
                    setSelectedDeptFilter(e.target.value);
                    setSelectedRepFilter('all');
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">전체 부서</option>
                  {departmentList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 영업 담당자 필터: 영업 담당(sales_rep) 로그인 시 숨김 */}
            {role !== 'sales_rep' && (
              <div className="flex items-center space-x-1 shrink-0">
                <select
                  value={selectedRepFilter}
                  onChange={(e) => setSelectedRepFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">전체 영업담당자</option>
                  {filteredRepOptions.map(repName => (
                    <option key={repName} value={repName}>{repName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 우측 도구 모음: 뷰 모드 토글 + 완료 컬럼 일괄 접기 + 신규 등록 */}
          <div className="flex items-center space-x-2 shrink-0 self-end lg:self-auto">
            {/* 완료 단계(수주/실패) 빠른 접기/펼치기 토글 */}
            <button
              type="button"
              onClick={toggleAllClosedStages}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center space-x-1.5 cursor-pointer ${
                collapsedStages.closed_won && collapsedStages.closed_lost
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
              title="수주(100%) 및 실패(0%) 컬럼을 접거나 펼쳐서 진행 중인 활성 파이프라인에 집중합니다"
            >
              <ChevronsLeftRight className="w-3.5 h-3.5" />
              <span>{collapsedStages.closed_won && collapsedStages.closed_lost ? '완료 단계 펼치기' : '완료 단계 접기'}</span>
            </button>

            {/* 카드 뷰 모드 전환 (기본 vs 컴팩트) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setCardViewMode('detailed')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  cardViewMode === 'detailed'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="상세 카드 뷰 (모든 정보 표시)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">상세</span>
              </button>
              <button
                type="button"
                onClick={() => setCardViewMode('compact')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  cardViewMode === 'compact'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="컴팩트 뷰 (한눈에 많은 딜 보기)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">컴팩트</span>
              </button>
            </div>

            {/* 수동 새로고침 버튼 */}
            <button
              type="button"
              onClick={() => loadDeals(true)}
              disabled={loadingDB}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="데이터 즉시 새로고침 (DB 강제 동기화)"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDB ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* 신규 등록 버튼 (뷰어 권한은 숨김) */}
            {role !== 'viewer' && (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>딜 등록</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 파이프라인 칸반 보드 (수평 스크롤 + 컬럼별 독립 세로 스크롤 & 헤더 고정) */}
      <div className="overflow-x-auto pb-4">
        <div className="flex space-x-3.5 min-w-[1400px] items-start">
          {STAGES.map((stageMeta) => {
            const stageDeals = filteredDeals.filter(d => d.stage === stageMeta.id);
            const stageSum = stageDeals.reduce((sum, d) => sum + d.amount, 0);
            const isCollapsed = collapsedStages[stageMeta.id];

            // 1) 컬럼이 접힌(Collapsed) 상태 (상세 카드 1칸 높이로 컴팩트하게 표시)
            if (isCollapsed) {
              return (
                <div
                  key={stageMeta.id}
                  onClick={() => toggleStageCollapse(stageMeta.id)}
                  className={`w-14 shrink-0 rounded-2xl border transition-all cursor-pointer hover:border-blue-400 group py-3 px-1.5 flex flex-col items-center justify-between select-none ${stageMeta.color} h-[210px] shadow-2xs hover:shadow-md hover:-translate-y-0.5`}
                  title={`[${stageMeta.title}] 클릭하여 펼치기 (총 ${stageDeals.length}건 / ₩${stageSum.toLocaleString('ko-KR')})`}
                >
                  <div className="flex flex-col items-center space-y-1.5">
                    <button
                      type="button"
                      className="p-1 rounded-lg bg-white/90 border border-slate-200 text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors shadow-2xs"
                      aria-label="컬럼 펼치기"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100/90 px-1.5 py-0.5 rounded-full font-mono">
                      {stageDeals.length}
                    </span>
                  </div>

                  {/* 세로 텍스트 단계명 */}
                  <div 
                    className="text-[11px] font-bold text-slate-700 tracking-wider whitespace-nowrap py-1"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {stageMeta.title.replace(/\(.*?\)/g, '').trim()}
                  </div>

                  {/* 하단 금액 요약 */}
                  <div className="text-center w-full overflow-hidden">
                    <span className="text-[9px] font-extrabold text-slate-600 font-mono block truncate">
                      {stageSum >= 100000000 
                        ? `₩${(stageSum / 100000000).toFixed(1)}억` 
                        : stageSum >= 10000 
                        ? `₩${Math.round(stageSum / 10000).toLocaleString('ko-KR')}만` 
                        : `₩${stageSum.toLocaleString('ko-KR')}`}
                    </span>
                  </div>
                </div>
              );
            }

            // 2) 컬럼이 펼쳐진 일반 상태
            return (
              <div 
                key={stageMeta.id} 
                className={`w-80 shrink-0 rounded-2xl border flex flex-col ${stageMeta.color} max-h-[720px] shadow-2xs`}
              >
                {/* Stage 컬럼 헤더 (상단 고정 Sticky) */}
                <div className="p-3 border-b border-slate-200/80 bg-white/40 backdrop-blur-xs rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full truncate ${stageMeta.badge}`}>
                      {stageMeta.title}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-slate-800 font-mono block leading-tight">
                        ₩{stageSum.toLocaleString('ko-KR')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium leading-none">
                        총 {stageDeals.length}건
                      </span>
                    </div>
                    {/* 컬럼 접기 버튼 */}
                    <button
                      type="button"
                      onClick={() => toggleStageCollapse(stageMeta.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                      title={`${stageMeta.title} 컬럼 접기`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Deal Cards List (내부 스크롤 구역) */}
                <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[640px] pr-2 custom-scrollbar">
                  {stageDeals.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-slate-200/80 rounded-xl text-slate-400 text-xs">
                      등록된 딜이 없습니다
                    </div>
                  ) : (
                    stageDeals.map((deal) => {
                      const isOverdue = isOverdueDeal(deal);

                      // [컴팩트 뷰 모드 카드]
                      if (cardViewMode === 'compact') {
                        return (
                          <div
                            key={deal.id}
                            onClick={() => handleOpenEditModal(deal)}
                            className={`p-2.5 border rounded-xl shadow-2xs hover:shadow-md transition-all cursor-pointer group space-y-1.5 ${
                              isOverdue
                                ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-200 hover:border-rose-500'
                                : 'bg-white border-slate-200 hover:border-blue-400'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold font-mono text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 truncate max-w-[120px]">
                                {deal.deal_code || deal.id}
                              </span>
                              <div className="flex items-center space-x-1">
                                {isOverdue && (
                                  <AlertTriangle className="w-3 h-3 text-rose-600 animate-pulse shrink-0" />
                                )}
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded">
                                  {deal.probability}%
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate max-w-[170px]" title={deal.company}>
                                {deal.company}
                              </h4>
                              <span className="text-xs font-extrabold text-slate-900 font-mono">
                                ₩{deal.amount.toLocaleString('ko-KR')}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                              <span className="truncate max-w-[140px]">{deal.product_name || deal.title}</span>
                              <span className="text-slate-600 font-medium shrink-0">{deal.sales_rep_name}</span>
                            </div>
                          </div>
                        );
                      }

                      // [기본 상세 뷰 모드 카드]
                      return (
                        <div
                          key={deal.id}
                          onClick={() => handleOpenEditModal(deal)}
                          className={`p-4 border rounded-xl shadow-2xs hover:shadow-md transition-all cursor-pointer group space-y-2.5 ${
                            isOverdue
                              ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-200 hover:border-rose-500'
                              : 'bg-white border-slate-200 hover:border-blue-400'
                          }`}
                        >
                          {/* 상단 경고 태그 (매출일 경과 시) */}
                          {isOverdue && (
                            <div className="flex items-center space-x-1 text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300 shadow-2xs">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />
                              <span>매출일 경과 ({deal.expected_close_date})</span>
                            </div>
                          )}

                          {/* 상단: Deal-ID & 구분 태그 */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              {deal.deal_code || deal.id}
                            </span>
                            <div className="flex items-center space-x-1">
                              {deal.deal_type && (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {deal.deal_type}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {deal.probability}%
                              </span>
                            </div>
                          </div>

                          {/* 고객사명 & 타이틀 */}
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                              {deal.company}
                            </h4>
                            <p className="text-[11px] text-slate-600 font-medium line-clamp-1 mt-0.5">
                              {deal.title}
                            </p>
                          </div>

                          {/* 제품명 & 벤더/파트너 */}
                          {(deal.product_name || deal.partner_name || deal.vendor) && (
                            <div className="p-2 bg-slate-50/80 rounded-lg text-[11px] text-slate-600 space-y-0.5">
                              {deal.product_name && (
                                <div className="font-semibold text-slate-800 line-clamp-1">
                                  📦 {deal.product_name}
                                </div>
                              )}
                              <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-medium">
                                {deal.vendor && <span>벤더: {deal.vendor}</span>}
                                {deal.partner_name && <span>파트너: {deal.partner_name}</span>}
                              </div>
                            </div>
                          )}

                          {/* PC# / Server# 정보 */}
                          {((deal.pc_count && deal.pc_count > 0) || (deal.server_count && deal.server_count > 0)) && (
                            <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-medium">
                              {deal.pc_count ? (
                                <span className="flex items-center space-x-1">
                                  <Laptop className="w-3 h-3 text-slate-400" />
                                  <span>PC {deal.pc_count}대</span>
                                </span>
                              ) : null}
                              {deal.server_count ? (
                                <span className="flex items-center space-x-1">
                                  <Server className="w-3 h-3 text-slate-400" />
                                  <span>Server {deal.server_count}대</span>
                                </span>
                              ) : null}
                            </div>
                          )}

                          {/* 수주 / 실패(Lost) 사유 표시 */}
                          {deal.close_reason && (
                            <div className={`p-2 rounded-lg text-[11px] font-medium border flex items-start space-x-1.5 ${
                              deal.stage === 'closed_lost'
                                ? 'bg-rose-50/90 border-rose-200 text-rose-800'
                                : deal.stage === 'closed_won'
                                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                                : 'bg-amber-50/90 border-amber-200 text-amber-800'
                            }`}>
                              {deal.stage === 'closed_lost' ? (
                                <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              )}
                              <div className="leading-snug">
                                <span className="font-bold mr-1">
                                  {deal.stage === 'closed_lost' ? '실패 사유:' : deal.stage === 'closed_won' ? '수주 사유:' : '사유:'}
                                </span>
                                <span className="break-words">{deal.close_reason}</span>
                              </div>
                            </div>
                          )}

                          {/* 수주 금액 & 담당자 & 최종 업데이트 날짜 */}
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-900 font-mono">
                                ₩{deal.amount.toLocaleString('ko-KR')}
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center space-x-1 font-medium">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>{deal.sales_rep_name}</span>
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-medium pt-0.5">
                              <span className={`flex items-center space-x-1 ${isOverdue ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>
                                <Calendar className={`w-3 h-3 ${isOverdue ? 'text-rose-600' : 'text-slate-400'}`} />
                                <span>{isOverdue ? `예상매출일: ${deal.expected_close_date}` : `업데이트: ${deal.updated_at ? (deal.updated_at.includes('T') ? deal.updated_at.split('T')[0] : deal.updated_at) : (deal.received_date || deal.created_at?.split('T')[0] || '-')}`}</span>
                              </span>
                              {deal.history && deal.history.length > 0 && (
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-bold border border-blue-100">
                                  히스토리 {deal.history.length}건
                                </span>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* 딜 등록 및 수정 모달 (Form UI) */}
      <DealFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        dealToEdit={dealToEdit}
        onSaveSuccess={handleSaveSuccess}
        onDeleteSuccess={handleDeleteSuccess}
        currentUserId={profile?.id}
        currentUserName={profile?.full_name}
      />

    </div>
  );
};
