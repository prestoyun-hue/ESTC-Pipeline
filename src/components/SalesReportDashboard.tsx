/**
 * ====================================================================
 * [영업 현황 진행 차트 대시보드 (SalesReportDashboard.tsx)]
 * --------------------------------------------------------------------
 * - 파이프라인 현황(deals) 데이터를 시각적 차트로 제공하는 대시보드
 * - 필터 조건: 영업리포트(WorkReportTable)와 100% 동일
 *   (일일/주간/월간/직접선택 프리셋, 이전/오늘/다음 탐색, 업데이트일/매출일/등록일 기준)
 * - 영업담당 계정(sales_rep)으로 접속 시 담당자 필터 셀렉트박스는 숨겨짐
 * - 요약 KPI 및 차트: 통화, 미팅, 이메일, 기타 활동 현황 / 리드 출처 / 클로징 비율
 * ====================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Deal, PipelineStage } from '../types';
import { fetchStoredDeals, subscribeToDealChanges, isOverdueDeal, deduplicateDeals } from '../utils/dealStorage';
import {
  WorkReportPreset,
  DateTargetField,
  getWorkReportDateRange,
  getKSTNow,
  matchesDateRange
} from '../utils/dateFilter';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import {
  BarChart3,
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  PieChart as PieChartIcon,
  Users,
  XCircle,
  Calendar,
  PhoneCall,
  Mail,
  Target,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

// 파이프라인 단계 정의
const PIPELINE_STAGES: { id: PipelineStage; label: string; color: string }[] = [
  { id: 'lead', label: '10% 신규 기회', color: '#3b82f6' },        // Blue
  { id: 'proposal', label: '30% 제안 진행', color: '#6366f1' },    // Indigo
  { id: 'negotiation', label: '50% 가격/스펙 협상', color: '#8b5cf6' }, // Purple
  { id: 'order', label: '80% 최종 계약 대기', color: '#ec4899' },  // Pink
  { id: 'closed_won', label: '100% 수주 완료', color: '#10b981' }, // Emerald
  { id: 'closed_lost', label: '0% 드랍/실패', color: '#f43f5e' }    // Rose
];

// 차트 보조 색상
const PIE_COLORS = {
  closed_won: '#10b981',   // Emerald
  closed_lost: '#f43f5e',  // Rose
  in_progress: '#3b82f6'   // Blue
};

const REASON_COLORS = ['#f43f5e', '#fb923c', '#a855f7', '#64748b', '#06b6d4', '#10b981'];

export const SalesReportDashboard: React.FC = () => {
  const { profile, role } = useAuth();

  // 원본 데이터 및 로딩 상태
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // =========================================================================
  // [영업리포트와 100% 동일한 기간 필터 상태]
  // - 프리셋 기본값: 'weekly' (주간 기본)
  // =========================================================================
  const [preset, setPreset] = useState<WorkReportPreset>('weekly');
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [dateTargetField, setDateTargetField] = useState<DateTargetField>('updated_at');

  const initialRange = useMemo(() => getWorkReportDateRange('weekly', new Date()), []);
  const [startDate, setStartDate] = useState<string>(initialRange.startDate);
  const [endDate, setEndDate] = useState<string>(initialRange.endDate);

  // 추가 서브 필터 (검색, 단계, 벤더, 구분, 담당자, 매출일지연)
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);

  // 데이터 수집 및 실시간 구독
  const loadData = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      const stored = await fetchStoredDeals(forceRefresh);
      setDeals(deduplicateDeals(stored));
    } catch (err) {
      console.error('딜 데이터 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 실시간 DB 데이터 변경 구독
    const unsubscribe = subscribeToDealChanges((updatedDeals) => {
      setDeals(deduplicateDeals(updatedDeals));
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // 프리셋 변경 시 시작일/종료일 자동 계산
  const handlePresetChange = (newPreset: WorkReportPreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const range = getWorkReportDateRange(newPreset, refDate);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  // 날짜 이동 (이전 / 오늘 / 다음)
  const handleDateNavigate = (direction: 'prev' | 'today' | 'next') => {
    if (direction === 'today') {
      const today = new Date();
      setRefDate(today);
      const range = getWorkReportDateRange(preset, today);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      return;
    }

    const newDate = new Date(refDate);
    if (preset === 'daily') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (preset === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (preset === 'monthly') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }

    setRefDate(newDate);
    const range = getWorkReportDateRange(preset, newDate);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  // 영업담당자 목록 추출
  const repOptions = useMemo(() => {
    const set = new Set<string>();
    deals.forEach(d => {
      if (d.sales_rep_name) {
        const cleanName = d.sales_rep_name.trim();
        if (cleanName) set.add(cleanName);
      }
    });
    return Array.from(set).sort();
  }, [deals]);

  // 벤더 목록 추출
  const vendorList = useMemo(() => {
    const set = new Set<string>();
    deals.forEach(d => {
      if (d.vendor) {
        const v = d.vendor.trim();
        if (v) set.add(v);
      }
    });
    return Array.from(set).sort();
  }, [deals]);

  // 지연 딜 개수 계산
  const overdueCount = useMemo(() => {
    return deals.filter(isOverdueDeal).length;
  }, [deals]);

  // =========================================================================
  // [영업리포트 필터링 로직 기반 적용]
  // =========================================================================
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // 1. 영업 담당 권한인 경우 본인의 딜만 반환
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

      // 2. 관리자 / 팀장 계정에서 영업 담당자 필터 적용 (role !== 'sales_rep')
      if (role !== 'sales_rep' && selectedRepFilter !== 'all') {
        const dealRepClean = (deal.sales_rep_name || '').replace(/\s*\(.*?\)/g, '').trim();
        const filterRepClean = selectedRepFilter.replace(/\s*\(.*?\)/g, '').trim();
        const matchesRep = deal.sales_rep_name === selectedRepFilter ||
                           (dealRepClean && filterRepClean && (dealRepClean.includes(filterRepClean) || filterRepClean.includes(dealRepClean)));
        if (!matchesRep) return false;
      }

      // 3. 지연 딜만 보기 필터
      if (onlyOverdue && !isOverdueDeal(deal)) {
        return false;
      }

      // 4. 기간 필터 적용
      if (!matchesDateRange(deal, dateTargetField, startDate, endDate)) {
        return false;
      }

      // 5. 단계 필터
      if (selectedStage !== 'all') {
        if (selectedStage === 'forecast') {
          if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') return false;
        } else if (deal.stage !== selectedStage) {
          return false;
        }
      }

      // 6. 벤더 필터
      if (selectedVendor !== 'all') {
        if ((deal.vendor || '').trim() !== selectedVendor) return false;
      }

      // 7. 구분(신규/갱신) 필터
      if (selectedType !== 'all') {
        if ((deal.deal_type || '').trim() !== selectedType) return false;
      }

      // 8. 키워드 검색 (고객사, 파트너사, 건명, 담당자, Deal-ID, 제품명)
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

      return true;
    });
  }, [deals, role, profile?.id, profile?.full_name, selectedRepFilter, onlyOverdue, dateTargetField, startDate, endDate, selectedStage, selectedVendor, selectedType, searchTerm]);

  // =========================================================================
  // [전 기간(Previous Period) 대비 증감률 계산 로직]
  // =========================================================================
  const prevPeriodRange = useMemo(() => {
    if (!startDate || !endDate) return { prevStartDate: '', prevEndDate: '' };
    
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    // 기간 일수 (종료일 포함)
    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    // 이전 기간 종료일 = 현재 시작일 - 1일
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    
    // 이전 기간 시작일 = 이전 종료일 - (diffDays - 1)일
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (diffDays - 1));
    
    const formatDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    
    return {
      prevStartDate: formatDateStr(prevStart),
      prevEndDate: formatDateStr(prevEnd)
    };
  }, [startDate, endDate]);

  // 전 기간 필터링된 딜 목록
  const prevFilteredDeals = useMemo(() => {
    if (!prevPeriodRange.prevStartDate || !prevPeriodRange.prevEndDate) return [];
    
    return deals.filter(deal => {
      // 1. 영업 담당 권한
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

      // 2. 관리자 / 팀장 필터
      if (role !== 'sales_rep' && selectedRepFilter !== 'all') {
        const dealRepClean = (deal.sales_rep_name || '').replace(/\s*\(.*?\)/g, '').trim();
        const filterRepClean = selectedRepFilter.replace(/\s*\(.*?\)/g, '').trim();
        const matchesRep = deal.sales_rep_name === selectedRepFilter ||
                           (dealRepClean && filterRepClean && (dealRepClean.includes(filterRepClean) || filterRepClean.includes(dealRepClean)));
        if (!matchesRep) return false;
      }

      // 3. 지연 딜만 보기 필터
      if (onlyOverdue && !isOverdueDeal(deal)) {
        return false;
      }

      // 4. 전 기간 날짜 필터 적용
      if (!matchesDateRange(deal, dateTargetField, prevPeriodRange.prevStartDate, prevPeriodRange.prevEndDate)) {
        return false;
      }

      // 5. 단계 필터
      if (selectedStage !== 'all') {
        if (selectedStage === 'forecast') {
          if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') return false;
        } else if (deal.stage !== selectedStage) {
          return false;
        }
      }

      // 6. 벤더 필터
      if (selectedVendor !== 'all') {
        if ((deal.vendor || '').trim() !== selectedVendor) return false;
      }

      // 7. 구분 필터
      if (selectedType !== 'all') {
        if ((deal.deal_type || '').trim() !== selectedType) return false;
      }

      // 8. 키워드 검색
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

      return true;
    });
  }, [deals, role, profile?.id, profile?.full_name, selectedRepFilter, onlyOverdue, dateTargetField, prevPeriodRange, selectedStage, selectedVendor, selectedType, searchTerm]);

  // =========================================================================
  // [KPI 요약 데이터 계산: 통화, 미팅, 이메일, 기타 및 전 기간 대비 증감률]
  // =========================================================================

  // 헬퍼: 딜에서 특정 활동 유형의 횟수를 계산 (히스토리 중복 카운트 방지)
  const countActivity = (deal: Deal, matchFn: (type?: string) => boolean) => {
    if (deal.history && deal.history.length > 0) {
      return deal.history.filter(h => matchFn(h.activity_type)).length;
    }
    return matchFn(deal.activity_type) ? 1 : 0;
  };

  // 1) 통화 활동 현황
  const callDeals = useMemo(() => {
    return filteredDeals.filter(d => countActivity(d, t => t === '통화') > 0);
  }, [filteredDeals]);

  const callActivityCount = useMemo(() => {
    return filteredDeals.reduce((sum, d) => sum + countActivity(d, t => t === '통화'), 0);
  }, [filteredDeals]);

  const prevCallActivityCount = useMemo(() => {
    return prevFilteredDeals.reduce((sum, d) => sum + countActivity(d, t => t === '통화'), 0);
  }, [prevFilteredDeals]);

  const callDealsAmount = useMemo(() => {
    return callDeals.reduce((sum, d) => sum + d.amount, 0);
  }, [callDeals]);

  // 2) 미팅 활동 현황
  const meetingDeals = useMemo(() => {
    return filteredDeals.filter(d => countActivity(d, t => t === '미팅') > 0);
  }, [filteredDeals]);

  const meetingActivityCount = useMemo(() => {
    return filteredDeals.reduce((sum, d) => sum + countActivity(d, t => t === '미팅'), 0);
  }, [filteredDeals]);

  const prevMeetingActivityCount = useMemo(() => {
    return prevFilteredDeals.reduce((sum, d) => sum + countActivity(d, t => t === '미팅'), 0);
  }, [prevFilteredDeals]);

  const meetingDealsAmount = useMemo(() => {
    return meetingDeals.reduce((sum, d) => sum + d.amount, 0);
  }, [meetingDeals]);

  // 3) 이메일 활동 현황
  const emailDeals = useMemo(() => {
    return filteredDeals.filter(d => countActivity(d, t => t === '이메일') > 0);
  }, [filteredDeals]);

  const emailActivityCount = useMemo(() => {
    return filteredDeals.reduce((sum, d) => sum + countActivity(d, t => t === '이메일'), 0);
  }, [filteredDeals]);

  const prevEmailActivityCount = useMemo(() => {
    return prevFilteredDeals.reduce((sum, d) => sum + countActivity(d, t => t === '이메일'), 0);
  }, [prevFilteredDeals]);

  const emailDealsAmount = useMemo(() => {
    return emailDeals.reduce((sum, d) => sum + d.amount, 0);
  }, [emailDeals]);

  // 4) 기타 활동 현황 (통화, 미팅, 이메일 이외의 모든 활동)
  const isOtherActivity = (type?: string) => {
    if (!type || !type.trim()) return false;
    return !['통화', '미팅', '이메일'].includes(type.trim());
  };

  const otherDeals = useMemo(() => {
    return filteredDeals.filter(d => countActivity(d, isOtherActivity) > 0);
  }, [filteredDeals]);

  const otherActivityCount = useMemo(() => {
    return filteredDeals.reduce((sum, d) => sum + countActivity(d, isOtherActivity), 0);
  }, [filteredDeals]);

  const prevOtherActivityCount = useMemo(() => {
    return prevFilteredDeals.reduce((sum, d) => sum + countActivity(d, isOtherActivity), 0);
  }, [prevFilteredDeals]);

  const otherDealsAmount = useMemo(() => {
    return otherDeals.reduce((sum, d) => sum + d.amount, 0);
  }, [otherDeals]);
  // 증감률 헬퍼 함수
  const getGrowthStats = (current: number, previous: number) => {
    const diff = current - previous;
    if (previous === 0) {
      if (current === 0) {
        return { percentStr: '0.0%', diff, isUp: false, isDown: false, text: '전기 동일 (0회)' };
      }
      return { percentStr: '+100.0%', diff, isUp: true, isDown: false, text: `전기 대비 +${diff}회 (전기 0회)` };
    }
    const rate = ((current - previous) / previous) * 100;
    const formattedRate = (rate > 0 ? '+' : '') + rate.toFixed(1) + '%';
    return {
      percentStr: formattedRate,
      diff,
      isUp: rate > 0,
      isDown: rate < 0,
      text: `전기 대비 ${diff >= 0 ? '+' : ''}${diff}회 (전기 ${previous}회)`
    };
  };

  const callGrowth = useMemo(() => getGrowthStats(callActivityCount, prevCallActivityCount), [callActivityCount, prevCallActivityCount]);
  const meetingGrowth = useMemo(() => getGrowthStats(meetingActivityCount, prevMeetingActivityCount), [meetingActivityCount, prevMeetingActivityCount]);
  const emailGrowth = useMemo(() => getGrowthStats(emailActivityCount, prevEmailActivityCount), [emailActivityCount, prevEmailActivityCount]);
  const otherGrowth = useMemo(() => getGrowthStats(otherActivityCount, prevOtherActivityCount), [otherActivityCount, prevOtherActivityCount]);

  // =========================================================================
  // [차트 1] 영업담당자별 영업 활동 현황 차트 데이터 (통화, 미팅, 이메일, 기타)
  // =========================================================================
  const repActivityChartData = useMemo(() => {
    const map = new Map<string, {
      repName: string;
      callCount: number;
      meetingCount: number;
      emailCount: number;
      otherCount: number;
      totalActivities: number;
    }>();

    filteredDeals.forEach(deal => {
      const rep = deal.sales_rep_name ? deal.sales_rep_name.trim() : '미지정';
      if (!map.has(rep)) {
        map.set(rep, {
          repName: rep,
          callCount: 0,
          meetingCount: 0,
          emailCount: 0,
          otherCount: 0,
          totalActivities: 0
        });
      }

      const entry = map.get(rep)!;

      // 1) 통화
      entry.callCount += countActivity(deal, t => t === '통화');

      // 2) 미팅
      entry.meetingCount += countActivity(deal, t => t === '미팅');

      // 3) 이메일
      entry.emailCount += countActivity(deal, t => t === '이메일');

      // 4) 기타
      entry.otherCount += countActivity(deal, isOtherActivity);

      entry.totalActivities = entry.callCount + entry.meetingCount + entry.emailCount + entry.otherCount;
    });

    return Array.from(map.values()).sort((a, b) => b.totalActivities - a.totalActivities);
  }, [filteredDeals]);

  // =========================================================================
  // [차트 2] 리드 출처(Lead Source)별 비율 차트 데이터 (PieChart)
  // =========================================================================
  const leadSourceChartData = useMemo(() => {
    const sourceMap = new Map<string, number>();

    filteredDeals.forEach(deal => {
      const source = deal.lead_source && deal.lead_source.trim() ? deal.lead_source.trim() : '기타 / 미지정';
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    });

    const total = filteredDeals.length;
    const LEAD_COLORS = [
      '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
      '#06b6d4', '#f97316', '#64748b', '#14b8a6', '#6366f1'
    ];

    return Array.from(sourceMap.entries())
      .map(([name, value], idx) => ({
        name,
        value,
        percent: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
        color: LEAD_COLORS[idx % LEAD_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDeals]);

  // =========================================================================
  // [차트 3] 딜 클로징 현황 (Win vs Lost vs 진행중 & 실패 사유)
  // =========================================================================
  const closingPieData = useMemo(() => {
    let won = 0;
    let lost = 0;
    let inProgress = 0;

    filteredDeals.forEach(d => {
      if (d.stage === 'closed_won') won++;
      else if (d.stage === 'closed_lost') lost++;
      else inProgress++;
    });

    return [
      { name: '수주 완료 (Win)', value: won, color: PIE_COLORS.closed_won },
      { name: '진행중 (In Progress)', value: inProgress, color: PIE_COLORS.in_progress },
      { name: '실패 / 드랍 (Lost)', value: lost, color: PIE_COLORS.closed_lost },
    ].filter(item => item.value > 0);
  }, [filteredDeals]);

  // 실패(Lost) 사유별 분포 데이터
  const lostReasonData = useMemo(() => {
    const reasonMap = new Map<string, number>();

    filteredDeals.forEach(d => {
      if (d.stage === 'closed_lost') {
        const reason = d.close_reason || d.lost_reason || d.lost_reason_detail || '사유 미기재';
        reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
      }
    });

    return Array.from(reasonMap.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: REASON_COLORS[index % REASON_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDeals]);

  // =========================================================================
  // [차트 4] 파이프라인 단계별 딜 수 및 예상 금액 분포 차트 데이터
  // =========================================================================
  const stageDistributionData = useMemo(() => {
    return PIPELINE_STAGES.map(stage => {
      const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
      const count = stageDeals.length;
      const totalAmount = stageDeals.reduce((sum, d) => sum + d.amount, 0);

      return {
        stageId: stage.id,
        stageLabel: stage.label,
        count,
        amountInTenThousand: Math.round(totalAmount / 10000), // 만원 단위
        color: stage.color
      };
    });
  }, [filteredDeals]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* 1. 페이지 헤더 */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Sales Analytics & Performance Overview</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            영업 현황 진행 차트
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            파이프라인 현황 데이터를 기반으로 영업 활동 및 진행 시각화 차트를 제공합니다.
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-2 self-start md:self-auto transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>{loading ? '데이터 불러오는 중...' : '차트 새로고침'}</span>
        </button>
      </div>

      {/* 2. 영업리포트와 100% 동일한 필터 컨트롤 바 */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
        
        {/* 상단: 기간 필터 프리셋 & 탐색 컨트롤 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 mr-1">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>기간 설정:</span>
            </div>

            {/* 프리셋 선택 버튼 그룹 */}
            <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => handlePresetChange('daily')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  preset === 'daily'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                일일
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('weekly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  preset === 'weekly'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                주간
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('monthly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  preset === 'monthly'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                월간
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('custom')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  preset === 'custom'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                직접선택
              </button>
            </div>
          </div>

          {/* 직접선택 날짜 피커 또는 탐색 콘트롤 */}
          <div className="flex items-center space-x-2">
            {preset === 'custom' ? (
              <div className="flex items-center space-x-1.5 text-xs bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                />
                <span className="text-slate-400 font-bold">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleDateNavigate('prev')}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer"
                  title="이전 기간"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDateNavigate('today')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  오늘
                </button>

                <button
                  type="button"
                  onClick={() => handleDateNavigate('next')}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer"
                  title="다음 기간"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="ml-2 px-3 py-1 bg-white border border-blue-200 rounded-lg text-xs font-bold text-blue-700 font-mono shadow-2xs">
                  {startDate} {startDate !== endDate ? `~ ${endDate}` : ''}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* 하단: 키워드 검색 및 추가 세그먼트 드롭다운 */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
          
          {/* 키워드 검색창 */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="고객사, 파트너사, 건명, 담당자 검색..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 필터 세그먼트 Dropdown 그룹 */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto text-xs">
            
            {/* 영업 담당자 필터 (영업담당 role === 'sales_rep' 일 때는 보이지 않음) */}
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

          </div>

        </div>

      </div>

      {/* 3. 요약 KPI 지표 카드 (통화, 미팅, 이메일, 기타 현황) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1) 통화 현황 */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600">통화 현황</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <PhoneCall className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-black text-indigo-700 font-mono">
                {callActivityCount}회
              </h3>
              <div className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                callGrowth.isUp ? 'bg-emerald-100 text-emerald-700' :
                callGrowth.isDown ? 'bg-rose-100 text-rose-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {callGrowth.isUp && <TrendingUp className="w-3 h-3 stroke-[2.5]" />}
                {callGrowth.isDown && <TrendingDown className="w-3 h-3 stroke-[2.5]" />}
                {!callGrowth.isUp && !callGrowth.isDown && <Minus className="w-3 h-3" />}
                <span>{callGrowth.percentStr}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {callGrowth.text}
            </p>
            <p className="text-[11px] text-indigo-600/80 font-medium mt-0.5">
              연관 딜: {callDeals.length}건 (₩{callDealsAmount.toLocaleString('ko-KR')})
            </p>
          </div>
        </div>

        {/* 2) 미팅 현황 */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600">미팅 현황</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-black text-emerald-700 font-mono">
                {meetingActivityCount}회
              </h3>
              <div className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                meetingGrowth.isUp ? 'bg-emerald-100 text-emerald-700' :
                meetingGrowth.isDown ? 'bg-rose-100 text-rose-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {meetingGrowth.isUp && <TrendingUp className="w-3 h-3 stroke-[2.5]" />}
                {meetingGrowth.isDown && <TrendingDown className="w-3 h-3 stroke-[2.5]" />}
                {!meetingGrowth.isUp && !meetingGrowth.isDown && <Minus className="w-3 h-3" />}
                <span>{meetingGrowth.percentStr}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {meetingGrowth.text}
            </p>
            <p className="text-[11px] text-emerald-600/80 font-medium mt-0.5">
              연관 딜: {meetingDeals.length}건 (₩{meetingDealsAmount.toLocaleString('ko-KR')})
            </p>
          </div>
        </div>

        {/* 3) 이메일 현황 */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600">이메일 현황</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Mail className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-black text-amber-700 font-mono">
                {emailActivityCount}회
              </h3>
              <div className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                emailGrowth.isUp ? 'bg-emerald-100 text-emerald-700' :
                emailGrowth.isDown ? 'bg-rose-100 text-rose-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {emailGrowth.isUp && <TrendingUp className="w-3 h-3 stroke-[2.5]" />}
                {emailGrowth.isDown && <TrendingDown className="w-3 h-3 stroke-[2.5]" />}
                {!emailGrowth.isUp && !emailGrowth.isDown && <Minus className="w-3 h-3" />}
                <span>{emailGrowth.percentStr}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {emailGrowth.text}
            </p>
            <p className="text-[11px] text-amber-600/80 font-medium mt-0.5">
              연관 딜: {emailDeals.length}건 (₩{emailDealsAmount.toLocaleString('ko-KR')})
            </p>
          </div>
        </div>

        {/* 4) 기타 현황 */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-600">기타 현황</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <MessageSquare className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-black text-purple-700 font-mono">
                {otherActivityCount}회
              </h3>
              <div className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                otherGrowth.isUp ? 'bg-emerald-100 text-emerald-700' :
                otherGrowth.isDown ? 'bg-rose-100 text-rose-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {otherGrowth.isUp && <TrendingUp className="w-3 h-3 stroke-[2.5]" />}
                {otherGrowth.isDown && <TrendingDown className="w-3 h-3 stroke-[2.5]" />}
                {!otherGrowth.isUp && !otherGrowth.isDown && <Minus className="w-3 h-3" />}
                <span>{otherGrowth.percentStr}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {otherGrowth.text}
            </p>
            <p className="text-[11px] text-purple-600/80 font-medium mt-0.5">
              연관 딜: {otherDeals.length}건 (₩{otherDealsAmount.toLocaleString('ko-KR')})
            </p>
          </div>
        </div>

      </div>

      {/* 4. 차트 영역 (영업활동, 리드출처, 클로징비율, 파이프라인 단계별) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* [차트 1] 영업담당자별 영업 활동 현황 차트 (통화, 미팅, 이메일, 기타) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>영업담당별 영업 활동 현황 (통화, 미팅, 이메일, 기타)</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                영업 담당자별 활동(통화/미팅/이메일/기타) 수행 횟수
              </p>
            </div>
          </div>

          <div className="w-full h-80 pt-2">
            {repActivityChartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                조건에 맞는 영업활동 데이터가 없습니다.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repActivityChartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="repName" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(val: any) => [`${val} 회`, '']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="callCount" name="통화" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="meetingCount" name="미팅" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="emailCount" name="이메일" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="otherCount" name="기타" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* [차트 2] 리드 출처(Lead Source)별 비중 & 비율 차트 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <span>리드 출처(Lead Source)별 비중 & 비율</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                신규 파이프라인 유입 경로 및 리드 출처 분포 비중(%)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-80 items-center">
            {/* 파이 차트 */}
            <div className="w-full h-full relative flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-slate-600 mb-1">리드 출처별 점유율</span>
              {leadSourceChartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  데이터 없음
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={leadSourceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {leadSourceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`${val}건`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 리드 출처 상세 비중 목록 */}
            <div className="flex flex-col justify-center space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 max-h-72 overflow-y-auto">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-emerald-600" />
                <span>출처별 딜 분포 현황</span>
              </span>

              {leadSourceChartData.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">조건 내 리드 출처 데이터가 없습니다.</p>
              ) : (
                leadSourceChartData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-white rounded-lg border border-slate-200/60">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700 font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 font-mono">
                      <span className="font-bold text-slate-900">{item.value}건</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {item.percent}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* [차트 3] 딜 클로징 비율 & 실패(Lost) 사유 차트 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <PieChartIcon className="w-4 h-4 text-purple-600" />
                <span>딜 클로징 비율 & 실패(Lost) 사유</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                수주 성공 / 진행중 / 실패 비율 및 실패 원인 분석
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-80 items-center">
            
            {/* Win vs Lost 파이 차트 */}
            <div className="w-full h-full relative flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-slate-600 mb-1">성공 / 실패 / 진행중 비중</span>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={closingPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {closingPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`${val}건`, '']} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 실패 사유 요약 목록 */}
            <div className="flex flex-col justify-center space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 max-h-72 overflow-y-auto">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 mb-1">
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>실패(Lost) 사유 분석</span>
              </span>

              {lostReasonData.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">조건 내 실패(Lost) 딜이 없습니다.</p>
              ) : (
                lostReasonData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-white rounded-lg border border-slate-200/60">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700 font-medium truncate">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 shrink-0 font-mono">{item.value}건</span>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

        {/* [차트 4] 파이프라인 단계별 분포 차트 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>파이프라인 단계별 딜 건수 및 예상 금액</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                진행 단계별 파이프라인 딜 수 및 금액(단위: 만원)
              </p>
            </div>
          </div>

          <div className="w-full h-80 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageDistributionData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="stageLabel" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
                <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    name === '예상 금액 (만원)' ? `₩${Number(val).toLocaleString('ko-KR')} 만원` : `${val} 건`,
                    ''
                  ]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar yAxisId="left" dataKey="count" name="딜 건수 (건)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="amountInTenThousand" name="예상 금액 (만원)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
