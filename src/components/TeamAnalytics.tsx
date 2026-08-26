/**
 * ====================================================================
 * [팀 성과 및 수주 분석 대시보드 (TeamAnalytics.tsx)]
 * --------------------------------------------------------------------
 * - 파이프라인 수주 실적 및 팀 성과 분석 페이지
 * - 필터: 기간(월, 분기, 연 선택 기능 지원)
 * - 카드별 설명 말풍선(Speech Bubble Tooltip) 제공
 * - 수주 성과는 DB/로컬 스토리지 실(Real) 데이터 기반으로 집계 및 시각화
 * ====================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Deal, UserProfile } from '../types';
import { fetchStoredDeals, subscribeToDealChanges, deduplicateDeals, isDealVisibleToUser, extractDepartmentList, isDealInDepartment } from '../utils/dealStorage';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getKSTNow, matchesDateRange, DateTargetField } from '../utils/dateFilter';
import {
  TrendingUp,
  Award,
  BarChart3,
  Users,
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Target,
  PieChart as PieChartIcon,
  Briefcase,
  ArrowUpRight,
  Layers,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// 기간 분류 타입 (월 / 분기 / 연)
export type AnalyticsPeriodType = 'month' | 'quarter' | 'year';

// 말풍선 아이콘 및 툴팁 래퍼 컴포넌트
interface CardWithSpeechBubbleProps {
  title: string;
  explanation: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const CardWithSpeechBubble: React.FC<CardWithSpeechBubbleProps> = ({
  title,
  explanation,
  icon,
  children,
  className = ''
}) => {
  const [showBubble, setShowBubble] = useState<boolean>(false);

  return (
    <div
      className={`relative bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs transition-all hover:border-slate-300 ${className}`}
    >
      {/* 카드 상단 헤더 & 말풍선 트리거 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {icon && <span className="p-1.5 bg-slate-100 rounded-lg text-slate-700">{icon}</span>}
          <span className="text-xs font-bold text-slate-600">{title}</span>
        </div>

        {/* 말풍선 아이콘 및 호버/클릭 레이어 */}
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowBubble(true)}
            onMouseLeave={() => setShowBubble(false)}
            onClick={() => setShowBubble(prev => !prev)}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer flex items-center space-x-1"
            title="카드 설명 보기 (말풍선)"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="text-[10px] font-bold text-blue-600 hidden sm:inline">설명</span>
          </button>

          {/* 말풍선 (Speech Bubble) 팝업 */}
          {showBubble && (
            <div className="absolute z-30 bottom-full right-0 mb-2 w-64 p-3.5 bg-slate-900 text-slate-100 text-xs rounded-2xl shadow-2xl border border-slate-700 leading-relaxed animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start space-x-1.5">
                <span className="text-amber-400 font-bold shrink-0">💡</span>
                <p className="font-medium text-slate-200 text-[11px]">{explanation}</p>
              </div>
              {/* 말풍선 꼬리 (Arrow Tail) */}
              <div className="absolute top-full right-3 -mt-1.5 w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-slate-900" />
            </div>
          )}
        </div>
      </div>

      {/* 카드 메인 내용 */}
      <div>{children}</div>
    </div>
  );
};

export const TeamAnalytics: React.FC = () => {
  const { profile, role } = useAuth();

  // 1. 실데이터 연동 상태
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  // 2. 기간 선택 필터 상태 (월 / 분기 / 연)
  const [periodType, setPeriodType] = useState<AnalyticsPeriodType>('month');
  
  // 부서 필터 상태
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // 기준 연도, 월, 분기
  const now = getKSTNow();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1 ~ 12
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.floor(now.getMonth() / 3) + 1); // 1 ~ 4

  // 날짜 검색 기준 필터 (기본: 예상매출일 expected_close_date)
  const [dateTargetField, setDateTargetField] = useState<DateTargetField>('expected_close_date');

  // 데이터 로딩 및 실시간 구독
  const loadData = async () => {
    setLoading(true);
    try {
      const stored = await fetchStoredDeals();
      setDeals(deduplicateDeals(stored));
    } catch (err) {
      console.error('실데이터 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 실시간 DB 업데이트 구독
    const unsubscribe = subscribeToDealChanges((updatedDeals) => {
      setDeals(deduplicateDeals(updatedDeals));
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // 선택된 기간(월/분기/연)에 따른 startDate, endDate 계산
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (periodType === 'month') {
      const y = selectedYear;
      const m = selectedMonth;
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate: start,
        endDate: end,
        periodLabel: `${y}년 ${m}월`
      };
    } else if (periodType === 'quarter') {
      const y = selectedYear;
      const q = selectedQuarter;
      let startMonth = 1;
      let endMonth = 3;
      if (q === 2) { startMonth = 4; endMonth = 6; }
      else if (q === 3) { startMonth = 7; endMonth = 9; }
      else if (q === 4) { startMonth = 10; endMonth = 12; }

      const start = `${y}-${String(startMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(y, endMonth, 0).getDate();
      const end = `${y}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate: start,
        endDate: end,
        periodLabel: `${y}년 ${q}분기 (${startMonth}~${endMonth}월)`
      };
    } else {
      // year
      const y = selectedYear;
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      return {
        startDate: start,
        endDate: end,
        periodLabel: `${y}년 전체`
      };
    }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter]);

  // 탐색 이전/다음
  const handleNavigate = (direction: 'prev' | 'next') => {
    const step = direction === 'next' ? 1 : -1;
    if (periodType === 'month') {
      let newM = selectedMonth + step;
      let newY = selectedYear;
      if (newM > 12) { newM = 1; newY += 1; }
      else if (newM < 1) { newM = 12; newY -= 1; }
      setSelectedMonth(newM);
      setSelectedYear(newY);
    } else if (periodType === 'quarter') {
      let newQ = selectedQuarter + step;
      let newY = selectedYear;
      if (newQ > 4) { newQ = 1; newY += 1; }
      else if (newQ < 1) { newQ = 4; newY -= 1; }
      setSelectedQuarter(newQ);
      setSelectedYear(newY);
    } else {
      setSelectedYear(prev => prev + step);
    }
  };

  // 권한 및 부서 기반 가시 딜 목록
  const visibleDeals = useMemo(() => {
    return deals.filter(deal => isDealVisibleToUser(deal, profile, role, profiles));
  }, [deals, profile, role, profiles]);

  // 부서 목록 추출
  const departmentList = useMemo(() => {
    return extractDepartmentList(visibleDeals, profiles);
  }, [visibleDeals, profiles]);

  // 3. 기간 및 부서 필터링 적용된 실데이터
  const filteredDeals = useMemo(() => {
    return visibleDeals.filter(deal => {
      // 부서 필터
      if (selectedDeptFilter !== 'all') {
        if (!isDealInDepartment(deal, selectedDeptFilter, profiles)) {
          return false;
        }
      }
      return matchesDateRange(deal, dateTargetField, startDate, endDate);
    });
  }, [visibleDeals, selectedDeptFilter, dateTargetField, startDate, endDate, profiles]);

  // 4. 수주 실적 실데이터 핵심 지표 계산
  
  // (1) 수주 성공(closed_won) 딜 목록
  const wonDeals = useMemo(() => {
    return filteredDeals.filter(d => d.stage === 'closed_won');
  }, [filteredDeals]);

  // (2) 실 수주 달성 총 금액
  const totalWonAmount = useMemo(() => {
    return wonDeals.reduce((sum, d) => sum + d.amount, 0);
  }, [wonDeals]);

  // (3) 실주(closed_lost) 딜 목록 및 금액
  const lostDeals = useMemo(() => {
    return filteredDeals.filter(d => d.stage === 'closed_lost');
  }, [filteredDeals]);

  const totalLostAmount = useMemo(() => {
    return lostDeals.reduce((sum, d) => sum + d.amount, 0);
  }, [lostDeals]);

  // (4) 전체 파이프라인 금액
  const totalPipelineAmount = useMemo(() => {
    return filteredDeals.reduce((sum, d) => sum + d.amount, 0);
  }, [filteredDeals]);

  // (5) 수주 성공률 (Win Rate) = 수주 성공 건수 / 전체 파이프라인 딜 건수
  const winRate = useMemo(() => {
    if (filteredDeals.length === 0) return '0.0%';
    return `${((wonDeals.length / filteredDeals.length) * 100).toFixed(1)}%`;
  }, [wonDeals.length, filteredDeals.length]);

  // (6) 딜 클로징 평균 영업 기간 (등록일부터 수주 완료까지 평균 일수)
  const avgClosingDays = useMemo(() => {
    if (wonDeals.length === 0) return '0.0';
    const totalDays = wonDeals.reduce((sum, d) => {
      const startStr = d.received_date || d.updated_at;
      const endStr = d.updated_at || d.expected_close_date || d.received_date;
      if (!startStr || !endStr) return sum;
      const start = new Date(startStr);
      const end = new Date(endStr);
      const diffMs = Math.max(0, end.getTime() - start.getTime());
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    return (totalDays / wonDeals.length).toFixed(1);
  }, [wonDeals]);

  // 5. 영업 담당자별 실 수주 성과 데이터 집계
  const repPerformanceData = useMemo(() => {
    const repMap = new Map<string, {
      repName: string;
      totalDealsCount: number;
      totalPipelineValue: number;
      wonCount: number;
      wonValue: number;
      lostCount: number;
      lostValue: number;
      winRate: string;
      avgDays: string;
      totalWonDays: number;
    }>();

    filteredDeals.forEach(deal => {
      const rep = deal.sales_rep_name ? deal.sales_rep_name.trim() : '미지정';
      if (!repMap.has(rep)) {
        repMap.set(rep, {
          repName: rep,
          totalDealsCount: 0,
          totalPipelineValue: 0,
          wonCount: 0,
          wonValue: 0,
          lostCount: 0,
          lostValue: 0,
          winRate: '0.0%',
          avgDays: '0.0',
          totalWonDays: 0
        });
      }

      const item = repMap.get(rep)!;
      item.totalDealsCount += 1;
      item.totalPipelineValue += deal.amount;

      if (deal.stage === 'closed_won') {
        item.wonCount += 1;
        item.wonValue += deal.amount;

        // 클로징 소요 일수 계산
        const startStr = deal.received_date || deal.updated_at;
        const endStr = deal.updated_at || deal.expected_close_date || deal.received_date;
        if (startStr && endStr) {
          const start = new Date(startStr);
          const end = new Date(endStr);
          const diffMs = Math.max(0, end.getTime() - start.getTime());
          item.totalWonDays += Math.round(diffMs / (1000 * 60 * 60 * 24));
        }
      } else if (deal.stage === 'closed_lost') {
        item.lostCount += 1;
        item.lostValue += deal.amount;
      }
    });

    // 수주 성공률 및 평균 소요 일수 계산 후 수주 금액순 정렬
    const list = Array.from(repMap.values()).map(item => {
      const rate = item.totalDealsCount > 0 ? ((item.wonCount / item.totalDealsCount) * 100).toFixed(1) : '0.0';
      const days = item.wonCount > 0 ? (item.totalWonDays / item.wonCount).toFixed(1) : '0.0';
      return {
        ...item,
        winRate: `${rate}%`,
        avgDays: `${days}일`
      };
    });

    return list.sort((a, b) => b.wonValue - a.wonValue);
  }, [filteredDeals]);

  // 6. 벤더별 수주 달성 실적 데이터 차트
  const vendorWonChartData = useMemo(() => {
    const vMap = new Map<string, { vendor: string; wonValue: number; wonCount: number }>();

    wonDeals.forEach(d => {
      const v = d.vendor && d.vendor.trim() ? d.vendor.trim() : '기타/미지정';
      if (!vMap.has(v)) {
        vMap.set(v, { vendor: v, wonValue: 0, wonCount: 0 });
      }
      const entry = vMap.get(v)!;
      entry.wonValue += d.amount;
      entry.wonCount += 1;
    });

    return Array.from(vMap.values())
      .map(item => ({
        ...item,
        wonValueInTenThousand: Math.round(item.wonValue / 10000) // 만원 단위
      }))
      .sort((a, b) => b.wonValue - a.wonValue);
  }, [wonDeals]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* 1. 페이지 헤더 */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2 text-emerald-600 text-xs font-bold mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Sales Revenue & Team Performance</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            성과 및 수주 실적 분석
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            실데이터 기반으로 수주 성과, 팀별 실적 및 파이프라인 성공률을 분석합니다.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-2 self-start md:self-auto transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>{loading ? '데이터 불러오는 중...' : '실적 새로고침'}</span>
        </button>
      </div>

      {/* 2. 기간 선택 필터 바 (월, 분기, 연) */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>기간 분류:</span>
            </div>

            {/* 월 / 분기 / 연 버튼 탭 */}
            <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setPeriodType('month')}
                className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodType === 'month'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                월별 (Month)
              </button>

              <button
                type="button"
                onClick={() => setPeriodType('quarter')}
                className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodType === 'quarter'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                분기별 (Quarter)
              </button>

              <button
                type="button"
                onClick={() => setPeriodType('year')}
                className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodType === 'year'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                연별 (Year)
              </button>
            </div>

            {/* 날짜 필터 대상 선택 */}
            <div className="flex items-center space-x-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-[11px] font-semibold">기준:</span>
              <select
                value={dateTargetField}
                onChange={(e) => setDateTargetField(e.target.value as DateTargetField)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="expected_close_date">예상 매출일</option>
                <option value="updated_at">최종 수정일</option>
                <option value="received_date">등록일</option>
              </select>
            </div>

            {/* 부서 필터 */}
            {role !== 'sales_rep' && departmentList.length > 0 && (
              <div className="flex items-center space-x-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px] font-semibold">부서:</span>
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">전체 부서</option>
                  {departmentList.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 특정 연도/월/분기 직접 셀렉트 및 탐색 */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* 연도 드롭다운 */}
            <div className="bg-white px-2.5 py-1 border border-slate-200 rounded-xl text-xs">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>

            {/* 월별 모드일 때 월 드롭다운 */}
            {periodType === 'month' && (
              <div className="bg-white px-2.5 py-1 border border-slate-200 rounded-xl text-xs">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
            )}

            {/* 분기별 모드일 때 분기 드롭다운 */}
            {periodType === 'quarter' && (
              <div className="bg-white px-2.5 py-1 border border-slate-200 rounded-xl text-xs">
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value={1}>1분기 (1~3월)</option>
                  <option value={2}>2분기 (4~6월)</option>
                  <option value={3}>3분기 (7~9월)</option>
                  <option value={4}>4분기 (10~12월)</option>
                </select>
              </div>
            )}

            {/* 이전 / 다음 탐색 버튼 */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => handleNavigate('prev')}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer"
                title="이전 기간"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('next')}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer"
                title="다음 기간"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="ml-1 px-3 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold font-mono shadow-2xs">
              {periodLabel} ({startDate} ~ {endDate})
            </div>

          </div>

        </div>
      </div>

      {/* 3. 핵심 수주 성과 KPI 카드리스트 (말풍선 포함 - 5개 카드) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* 카드 1: 전체 파이프라인 */}
        <CardWithSpeechBubble
          title="전체 파이프라인"
          icon={<Layers className="w-4 h-4 text-blue-600" />}
          explanation="선택한 기간 내 생성되거나 진행 중인 모든 영업 기회(딜)의 금액 및 건수 합계입니다."
        >
          <h3 className="text-xl font-black text-blue-600 font-mono mt-1">
            ₩{totalPipelineAmount.toLocaleString('ko-KR')}
          </h3>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">총 딜 건수:</span>
            <span className="font-bold text-slate-900 font-mono">{filteredDeals.length}건</span>
          </div>
        </CardWithSpeechBubble>

        {/* 카드 2: 수주 성공 */}
        <CardWithSpeechBubble
          title="수주 성공 (Won)"
          icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
          explanation="선택한 기간 동안 수주 성공(100% 계약 완료) 단계에 도달한 딜들의 실제 금액 및 건수 총합입니다."
        >
          <h3 className="text-xl font-black text-emerald-600 font-mono mt-1">
            ₩{totalWonAmount.toLocaleString('ko-KR')}
          </h3>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">수주 성공 건수:</span>
            <span className="font-bold text-slate-900 font-mono">{wonDeals.length}건</span>
          </div>
        </CardWithSpeechBubble>

        {/* 카드 3: 수주 실패 */}
        <CardWithSpeechBubble
          title="수주 실패 (Lost)"
          icon={<XCircle className="w-4 h-4 text-rose-600" />}
          explanation="선택한 기간 동안 실주/드랍(0% 실패) 처리된 딜들의 금액 및 건수 총합입니다."
        >
          <h3 className="text-xl font-black text-rose-600 font-mono mt-1">
            ₩{totalLostAmount.toLocaleString('ko-KR')}
          </h3>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">수주 실패 건수:</span>
            <span className="font-bold text-slate-900 font-mono">{lostDeals.length}건</span>
          </div>
        </CardWithSpeechBubble>

        {/* 카드 4: 수주 성공률 (Win Rate) */}
        <CardWithSpeechBubble
          title="수주 성공률 (Win Rate)"
          icon={<Award className="w-4 h-4 text-purple-600" />}
          explanation="전체 파이프라인 딜 건수 대비 수주 성공(100%) 단계 도달 비율입니다. (수주 성공 건수 ÷ 전체 파이프라인 딜 건수)"
        >
          <h3 className="text-xl font-black text-purple-600 font-mono mt-1">
            {winRate}
          </h3>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">성공 / 전체 딜:</span>
            <span className="font-bold text-slate-900 font-mono">
              {wonDeals.length}건 / {filteredDeals.length}건
            </span>
          </div>
        </CardWithSpeechBubble>

        {/* 카드 5: 평균 클로징 소요 영업 기간 */}
        <CardWithSpeechBubble
          title="평균 영업 기간 (Sales Cycle)"
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          explanation="딜 등록일부터 수주 성공(100% 클로징)까지 소요된 평균 영업 기간(일수)입니다."
        >
          <h3 className="text-xl font-black text-amber-600 font-mono mt-1">
            {avgClosingDays}일
          </h3>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
            <span className="text-slate-500 font-medium">클로징 완료 딜:</span>
            <span className="font-bold text-slate-900 font-mono">{wonDeals.length}건</span>
          </div>
        </CardWithSpeechBubble>

      </div>

      {/* 4. 영업 담당자별 실 수주 성과 테이블 (상단 카드 항목과 일치) */}
      <CardWithSpeechBubble
        title="영업 담당자별 수주 성과 테이블"
        icon={<Users className="w-4 h-4 text-indigo-600" />}
        explanation="선택한 기간 동안 각 영업 담당자별 전체 파이프라인(건수/금액), 수주 성공(건수/금액), 수주 실패(건수/금액), 수주 성공률, 그리고 평균 클로징 소요 영업 기간을 실데이터 기반으로 집계한 성과 표입니다."
      >
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 bg-slate-50">
                <th className="py-3 px-3">영업 담당자</th>
                <th className="py-3 px-3 text-blue-700">전체 파이프라인 (건/금액)</th>
                <th className="py-3 px-3 text-emerald-700">수주 성공 (건/금액)</th>
                <th className="py-3 px-3 text-rose-700">수주 실패 (건/금액)</th>
                <th className="py-3 px-3 text-purple-700">수주 성공률 (%)</th>
                <th className="py-3 px-3 text-right text-amber-700">평균 영업 기간 (일)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {repPerformanceData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    선택한 기간 내 영업 담당자 실적 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                repPerformanceData.map((rep, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-slate-900 flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span>{rep.repName}</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-800">
                      <span className="font-bold text-blue-600 mr-1.5">{rep.totalDealsCount}건</span>
                      <span className="text-slate-500">(₩{rep.totalPipelineValue.toLocaleString('ko-KR')})</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-emerald-600">
                      <span className="font-bold mr-1.5">{rep.wonCount}건</span>
                      <span className="text-emerald-700 font-semibold">(₩{rep.wonValue.toLocaleString('ko-KR')})</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-rose-600">
                      <span className="font-bold mr-1.5">{rep.lostCount}건</span>
                      <span className="text-rose-700">(₩{rep.lostValue.toLocaleString('ko-KR')})</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-purple-600 font-bold">
                      {rep.winRate}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-amber-600 font-bold">
                      {rep.avgDays}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardWithSpeechBubble>

      {/* 5. 벤더별 수주 실적 시각화 차트 (말풍선 포함) */}
      <CardWithSpeechBubble
        title="벤더(Vendor)별 수주 성공 금액 차트"
        icon={<BarChart3 className="w-4 h-4 text-emerald-600" />}
        explanation="선택한 기간 동안 각 벤더(솔루션 브랜드)별 수주 성공(closed_won) 금액(단위: 만원)을 비교 시각화합니다."
      >
        <div className="w-full h-80 pt-4">
          {vendorWonChartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
              선택한 기간에 수주 완료(closed_won)된 벤더 데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorWonChartData} margin={{ top: 10, right: 15, left: 15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="vendor" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    name === '수주 금액 (만원)' ? `₩${Number(val).toLocaleString('ko-KR')} 만원` : `${val} 건`,
                    ''
                  ]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="wonValueInTenThousand" name="수주 금액 (만원)" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="wonCount" name="수주 건수 (건)" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardWithSpeechBubble>

    </div>
  );
};
