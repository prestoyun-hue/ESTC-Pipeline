/**
 * ====================================================================
 * [업무보고 테이블 컴포넌트 (WorkReportTable.tsx)]
 * --------------------------------------------------------------------
 * - 업데이트 일자 기준 영업 활동 및 파이프라인 변경 사항 보고서
 * - 리포트 필터 조건: 일일 (기본), 주간, 월간, 직접선택
 * - 컬럼: 업데이트일 | 담당자 | 고객사/영업건명 | 벤더/파트너/제품 | 수량 | 예상 금액 | 진행 단계 | 마지막 히스토리 진행 내용
 * - CSV 다운로드, 클립보드 복사, 딜 수정 및 히스토리 상세 보기 지원
 * ====================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Deal, PipelineStage, UserProfile } from '../types';
import { fetchStoredDeals, subscribeToDealChanges, deduplicateDeals, isDealVisibleToUser } from '../utils/dealStorage';
import { WorkReportPreset, getWorkReportDateRange, formatDateToYMD, getKSTNow } from '../utils/dateFilter';
import { DealFormModal } from './DealFormModal';
import {
  Calendar,
  Search,
  Filter,
  FileSpreadsheet,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  User,
  Building2,
  DollarSign,
  Laptop,
  Server,
  Layers,
  History,
  Edit2,
  Sparkles,
  RefreshCw,
  FileText,
  Phone,
  Mail,
  Users as UsersIcon,
  MessageSquare
} from 'lucide-react';

// 파이프라인 단계 레이블 & 배지 스타일 매핑
const STAGE_BADGES: Record<PipelineStage, { label: string; bg: string; text: string }> = {
  lead: { label: '1. 리드 (10%)', bg: 'bg-slate-100', text: 'text-slate-700' },
  contacted: { label: '2. 미팅/접촉 (20%)', bg: 'bg-sky-50', text: 'text-sky-700' },
  proposal: { label: '3. 제안 (30%)', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  poc: { label: '4. PoC (50%)', bg: 'bg-purple-50', text: 'text-purple-700' },
  negotiation: { label: '5. 견적/협상 (70%)', bg: 'bg-amber-50', text: 'text-amber-800' },
  order: { label: '6. 주문대기 (90%)', bg: 'bg-blue-50', text: 'text-blue-800' },
  closed_won: { label: '7. 수주완료 (100%)', bg: 'bg-emerald-50', text: 'text-emerald-800' },
  closed_lost: { label: '8. 실패/드랍 (0%)', bg: 'bg-rose-50', text: 'text-rose-800' },
};

export const WorkReportTable: React.FC = () => {
  const { profile, role } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 리포트 필터 상태 (일일 기본)
  const [preset, setPreset] = useState<WorkReportPreset>('daily');
  const [refDate, setRefDate] = useState<Date>(new Date());
  
  // 날짜 범위
  const initialRange = useMemo(() => getWorkReportDateRange('daily', new Date()), []);
  const [startDate, setStartDate] = useState<string>(initialRange.startDate);
  const [endDate, setEndDate] = useState<string>(initialRange.endDate);

  // 담당자 및 키워드 검색 필터
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 딜 수정 모달 상태
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // 히스토리 전체보기 모달 상태
  const [historyModalDeal, setHistoryModalDeal] = useState<Deal | null>(null);

  // 복사 완료 피드백 상태
  const [copied, setCopied] = useState<boolean>(false);

  // 데이터 로드 및 실시간 구독
  const loadDeals = async (forceRefresh: boolean = false) => {
    setLoading(true);
    const data = await fetchStoredDeals(forceRefresh);
    setDeals(deduplicateDeals(data));
    setLoading(false);
  };

  useEffect(() => {
    loadDeals();
    const unsubscribe = subscribeToDealChanges(() => {
      loadDeals();
    });
    return () => unsubscribe();
  }, []);

  // 프리셋 변경 시 시작/종료일 자동 계산
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

  // 프로필 목록 (부서 관리자 매핑용)
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    try {
      const savedAdminProfiles = localStorage.getItem('admin_user_profiles');
      const savedPipelineProfiles = localStorage.getItem('sales_pipeline_profiles');
      const targetSaved = savedAdminProfiles || savedPipelineProfiles;
      if (targetSaved) {
        const parsed = JSON.parse(targetSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProfiles(parsed);
        }
      }
    } catch (e) {
      console.warn('프로필 로드 오류:', e);
    }
  }, []);

  // 권한에 따른 기본 가시 딜 목록
  const visibleDeals = useMemo(() => {
    return deals.filter(deal => isDealVisibleToUser(deal, profile, role, profiles));
  }, [deals, profile, role, profiles]);

  // 영업담당자 목록 추출
  const salesReps = useMemo(() => {
    const set = new Set<string>();
    visibleDeals.forEach(d => {
      if (d.sales_rep_name) set.add(d.sales_rep_name);
    });
    return Array.from(set);
  }, [visibleDeals]);

  // 필터링된 보고서 딜 목록 (업데이트 일자 기준)
  const filteredDeals = useMemo(() => {
    return visibleDeals.filter(deal => {
      // 1. 업데이트 일자 확인 (updated_at 또는 latest history date)
      let updateDateStr = deal.updated_at || deal.created_at || deal.received_date || '';
      if (updateDateStr.includes('T')) {
        updateDateStr = updateDateStr.split('T')[0];
      }

      // 날짜 필터링
      if (startDate && updateDateStr < startDate) return false;
      if (endDate && updateDateStr > endDate) return false;

      // 2. 담당자 필터
      if (selectedRep !== 'all' && deal.sales_rep_name !== selectedRep) {
        return false;
      }

      // 3. 키워드 검색
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const latestNote = deal.history && deal.history.length > 0
          ? (deal.history[deal.history.length - 1].note || deal.history[deal.history.length - 1].changes || '')
          : (deal.notes || '');

        const matchText = [
          deal.company,
          deal.title,
          deal.vendor,
          deal.partner_name,
          deal.product_name,
          deal.sales_rep_name,
          latestNote,
          deal.notes
        ].filter(Boolean).join(' ').toLowerCase();

        if (!matchText.includes(term)) return false;
      }

      return true;
    }).sort((a, b) => {
      // 최신 업데이트 일자 내림차순 정렬
      const dateA = a.updated_at || a.created_at || '';
      const dateB = b.updated_at || b.created_at || '';
      return dateB.localeCompare(dateA);
    });
  }, [visibleDeals, startDate, endDate, selectedRep, searchTerm]);

  // 요약 통계
  const stats = useMemo(() => {
    const totalCount = filteredDeals.length;
    const totalAmount = filteredDeals.reduce((sum, d) => sum + d.amount, 0);
    const totalPc = filteredDeals.reduce((sum, d) => sum + (d.pc_count || 0), 0);
    const totalServer = filteredDeals.reduce((sum, d) => sum + (d.server_count || 0), 0);
    const wonCount = filteredDeals.filter(d => d.stage === 'closed_won').length;

    return { totalCount, totalAmount, totalPc, totalServer, wonCount };
  }, [filteredDeals]);

  // 선택한 날짜 필터 범위(startDate ~ endDate) 기준 해당 딜의 모든 진행 히스토리 추출 (가장 최신순)
  const getFilterMatchedHistoryContents = (deal: Deal, start: string, end: string) => {
    const allHistory = deal.history || [];

    // 필터 기간 내 작성/수정된 히스토리 항목들 추출
    const matched = allHistory.filter(h => {
      if (!h.updated_at) return true;
      let dateStr = h.updated_at;
      if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
      else if (dateStr.includes(' ')) dateStr = dateStr.split(' ')[0];

      if (start && dateStr < start) return false;
      if (end && dateStr > end) return false;
      return true;
    });

    // 만약 특정 히스토리 항목의 날짜가 세부적으로 나뉘지 않았다면 전체 히스토리 사용 (최신순 유지)
    const listToUse = matched.length > 0 ? matched : (allHistory.length > 0 ? [allHistory[0]] : []);

    const items = listToUse.map(h => {
      let text = (h.note || h.changes || '').trim();
      text = text.replace(/^메모:\s*/, '');
      return {
        id: h.id,
        date: h.updated_at,
        author: h.updated_by_name,
        activityType: h.activity_type || deal.activity_type || '미팅',
        changes: h.changes,
        content: text || deal.notes || '등록된 진행 내용이 없습니다.'
      };
    });

    return {
      items,
      count: items.length,
      isMatched: matched.length > 0,
      totalHistoryCount: allHistory.length
    };
  };

  // CSV 다운로드
  const handleDownloadCSV = () => {
    if (filteredDeals.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const headers = [
      '업데이트일',
      '담당자',
      '고객사',
      '영업건명',
      '벤더',
      '파트너',
      '제품명',
      '수량(PC)',
      '수량(Server)',
      '예상금액(원)',
      '진행단계',
      '가능성(%)',
      '진행형태',
      '필터 기간 내 진행 내용 (최신순)'
    ];

    const rows = filteredDeals.map(deal => {
      const historyData = getFilterMatchedHistoryContents(deal, startDate, endDate);
      const updateDate = deal.updated_at?.split('T')[0] || deal.created_at?.split('T')[0] || '-';
      const stageInfo = STAGE_BADGES[deal.stage]?.label || deal.stage;

      const combinedHistoryText = historyData.items.map(item => {
        const act = item.activityType ? `[${item.activityType}] ` : '';
        const dt = item.date ? `(${item.date}) ` : '';
        return `${act}${dt}${item.content}`;
      }).join(' / ');

      return [
        `"${updateDate}"`,
        `"${deal.sales_rep_name}"`,
        `"${deal.company}"`,
        `"${deal.title}"`,
        `"${deal.vendor || ''}"`,
        `"${deal.partner_name || ''}"`,
        `"${deal.product_name || ''}"`,
        deal.pc_count || 0,
        deal.server_count || 0,
        deal.amount,
        `"${stageInfo}"`,
        deal.probability,
        `"${deal.activity_type || '미팅'}"`,
        `"${combinedHistoryText.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `영업_업무보고_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 업무보고 요약 텍스트 클립보드 복사 (Slack, 이메일 공유용)
  const handleCopyReportText = () => {
    if (filteredDeals.length === 0) {
      alert('복사할 업무보고 데이터가 없습니다.');
      return;
    }

    let presetLabel = '일일';
    if (preset === 'weekly') presetLabel = '주간';
    if (preset === 'monthly') presetLabel = '월간';
    if (preset === 'custom') presetLabel = '직접선택';

    let text = `📋 [영업 업무보고 - ${presetLabel}]\n`;
    text += `📅 기간: ${startDate} ~ ${endDate}\n`;
    text += `📊 총 ${stats.totalCount}건 | 합계 금액: ₩${stats.totalAmount.toLocaleString('ko-KR')}\n`;
    text += `--------------------------------------------------\n\n`;

    filteredDeals.forEach((deal, idx) => {
      const historyData = getFilterMatchedHistoryContents(deal, startDate, endDate);
      const updateDate = deal.updated_at?.split('T')[0] || deal.created_at?.split('T')[0] || '-';
      
      const vendorInfo = [deal.vendor, deal.partner_name, deal.product_name].filter(Boolean).join(' / ') || '-';
      const qtyInfo = [
        deal.pc_count ? `PC ${deal.pc_count}대` : null,
        deal.server_count ? `Server ${deal.server_count}대` : null
      ].filter(Boolean).join(', ') || '수량 미지정';

      text += `${idx + 1}. [${deal.company}] ${deal.title}\n`;
      text += `   • 업데이트일: ${updateDate} | 담당자: ${deal.sales_rep_name}\n`;
      text += `   • 벤더/파트너/제품: ${vendorInfo}\n`;
      text += `   • 수량: ${qtyInfo} | 예상금액: ₩${deal.amount.toLocaleString('ko-KR')} (${deal.probability}%)\n`;
      
      if (historyData.items.length > 0) {
        text += `   • 진행 내용 (필터 기간 내 ${historyData.items.length}건, 최신순):\n`;
        historyData.items.forEach((item, hIdx) => {
          const act = item.activityType ? `[${item.activityType}] ` : '';
          const dt = item.date ? `(${item.date}) ` : '';
          text += `     ${hIdx + 1}) ${act}${dt}${item.content}\n`;
        });
      } else {
        text += `   • 진행 내용: 등록된 진행 히스토리가 없습니다.\n`;
      }
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. 페이지 제목 및 컨트롤 바 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">영업 업무보고</h2>
            <span className="text-xs px-2.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-full border border-blue-200">
              업데이트 일자 기준
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            영업 담당자별 진행 중인 딜의 업데이트 이력 및 최신 업무 진행 상황 리포트
          </p>
        </div>

        {/* 내보내기 & 공유 버튼 & 새로고침 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadDeals(true)}
            disabled={loading}
            className="p-2.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center cursor-pointer"
            title="업무보고 데이터 즉시 새로고침 (DB 강제 동기화)"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          </button>

          <button
            onClick={handleCopyReportText}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
            title="보고용 요약 텍스트 복사 (슬랙/메일 공유)"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? '복사 완료!' : '보고서 텍스트 복사'}</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            title="업무보고 데이터를 엑셀 CSV 파일로 저장합니다."
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV 엑셀 다운로드</span>
          </button>
        </div>
      </div>

      {/* 2. 요약 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <p className="text-xs font-bold text-slate-500">보고 대상 딜 건수</p>
          <div className="flex items-baseline space-x-1 mt-1">
            <span className="text-xl font-extrabold text-slate-900 font-mono">{stats.totalCount}</span>
            <span className="text-xs text-slate-500 font-medium">건</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <p className="text-xs font-bold text-slate-500">업데이트 딜 총 금액</p>
          <div className="flex items-baseline space-x-1 mt-1">
            <span className="text-xl font-extrabold text-blue-700 font-mono">
              ₩{stats.totalAmount.toLocaleString('ko-KR')}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <p className="text-xs font-bold text-slate-500">수량 총계 (PC / Server)</p>
          <div className="flex items-center space-x-2 mt-1.5 text-xs font-bold text-slate-800">
            <span className="flex items-center space-x-1">
              <Laptop className="w-3.5 h-3.5 text-slate-500" />
              <span>PC {stats.totalPc}대</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center space-x-1">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>Server {stats.totalServer}대</span>
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <p className="text-xs font-bold text-slate-500">수주 완료 (Win)</p>
          <div className="flex items-baseline space-x-1 mt-1">
            <span className="text-xl font-extrabold text-emerald-600 font-mono">{stats.wonCount}</span>
            <span className="text-xs text-slate-500 font-medium">건</span>
          </div>
        </div>
      </div>

      {/* 3. 리포트 필터 조작 바 (일일, 주간, 월간, 직접선택) */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        
        {/* 상단: 기간 설정 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/90 p-3 rounded-xl border border-slate-200">
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-slate-800 flex items-center space-x-1.5 shrink-0">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>기간 설정:</span>
            </span>

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
              <div className="flex items-center space-x-1.5 text-xs bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs text-slate-800 font-bold focus:outline-none"
                />
                <span className="text-slate-400 font-bold">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs text-slate-800 font-bold focus:outline-none"
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

        {/* 하단: 담당자 필터 & 검색어 창 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 flex-1 max-w-2xl">
            
            {/* 검색창 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="고객사, 영업건명, 벤더, 파트너, 진행내용 검색..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* 담당자 선택 (영업담당자 권한 시 숨김 또는 선택 제한) */}
            {role !== 'sales_rep' && (
              <div className="flex items-center space-x-2 shrink-0">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedRep}
                  onChange={(e) => setSelectedRep(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">전체 담당자</option>
                  {salesReps.map(rep => (
                    <option key={rep} value={rep}>{rep}</option>
                  ))}
                </select>
              </div>
            )}

          </div>

          <div className="text-xs text-slate-500 font-medium">
            조회 결과: <strong className="text-blue-700">{filteredDeals.length}</strong>건
          </div>
        </div>

      </div>

      {/* 4. 업무보고 데이터 테이블 (요청된 8개 컬럼 정확하게 배치) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4 w-28 whitespace-nowrap">업데이트일</th>
                <th className="py-3.5 px-4 w-24 whitespace-nowrap">담당자</th>
                <th className="py-3.5 px-4 min-w-[180px]">고객사 / 영업건명</th>
                <th className="py-3.5 px-4 min-w-[180px]">벤더 / 파트너 / 제품</th>
                <th className="py-3.5 px-4 w-28 whitespace-nowrap text-center">수량</th>
                <th className="py-3.5 px-4 w-32 whitespace-nowrap text-right">예상 금액</th>
                <th className="py-3.5 px-4 w-32 whitespace-nowrap">진행 단계</th>
                <th className="py-3.5 px-4 min-w-[260px]">진행 형태 / 진행 내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>업무보고 데이터를 불러오는 중입니다...</span>
                  </td>
                </tr>
              ) : filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600 text-sm">해당 기간의 업무보고 내역이 없습니다.</p>
                    <p className="text-xs text-slate-400 mt-1">상단 날짜 필터를 변경하거나 다른 기간을 선택해 보세요.</p>
                  </td>
                </tr>
              ) : (
                filteredDeals.map((deal) => {
                  const historyData = getFilterMatchedHistoryContents(deal, startDate, endDate);
                  const updateDate = deal.updated_at
                    ? (deal.updated_at.includes('T') ? deal.updated_at.split('T')[0] : deal.updated_at)
                    : (deal.created_at?.split('T')[0] || deal.received_date || '-');

                  const stageBadge = STAGE_BADGES[deal.stage] || { label: deal.stage, bg: 'bg-slate-100', text: 'text-slate-700' };

                  return (
                    <tr
                      key={deal.id}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedDeal(deal);
                        setIsModalOpen(true);
                      }}
                    >
                      {/* 1. 업데이트일 */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 text-[11px] whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{updateDate}</span>
                        </div>
                      </td>

                      {/* 2. 담당자 */}
                      <td className="py-3.5 px-4 font-bold text-slate-800 text-xs whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{deal.sales_rep_name}</span>
                        </div>
                      </td>

                      {/* 3. 고객사/영업건명 */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {deal.company}
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium line-clamp-1 mt-0.5">
                          {deal.title}
                        </div>
                        {deal.deal_code && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {deal.deal_code}
                          </div>
                        )}
                      </td>

                      {/* 4. 벤더/파트너/제품 */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          {deal.vendor && (
                            <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold text-[10px] rounded border border-blue-100 mr-1">
                              {deal.vendor}
                            </span>
                          )}
                          {deal.partner_name && (
                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 font-medium text-[10px] rounded border border-slate-200 mr-1">
                              파트너: {deal.partner_name}
                            </span>
                          )}
                          {deal.product_name && (
                            <div className="text-[11px] font-semibold text-slate-800 line-clamp-1">
                              📦 {deal.product_name}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 5. 수량 */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {((deal.pc_count && deal.pc_count > 0) || (deal.server_count && deal.server_count > 0)) ? (
                          <div className="inline-flex flex-col items-center space-y-0.5 text-[11px] font-medium text-slate-700">
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
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 6. 예상 금액 */}
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 text-xs whitespace-nowrap">
                        ₩{deal.amount.toLocaleString('ko-KR')}
                      </td>

                      {/* 7. 진행 단계 */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${stageBadge.bg} ${stageBadge.text}`}>
                            {stageBadge.label}
                          </span>
                        </div>
                      </td>

                      {/* 8. 진행 내용 (필터 기준 모든 히스토리 노출) */}
                      <td className="py-3.5 px-4 min-w-[280px]">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-800 text-[11px] leading-relaxed shadow-2xs space-y-2">
                          
                          {historyData.items.length > 0 ? (
                            historyData.items.map((item, idx) => (
                              <div
                                key={item.id || idx}
                                className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between text-[10px]">
                                  <div className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-100/90 text-blue-800 rounded-md font-bold">
                                    {item.activityType === '통화' && <Phone className="w-3 h-3 text-blue-600" />}
                                    {item.activityType === '미팅' && <UsersIcon className="w-3 h-3 text-blue-600" />}
                                    {item.activityType === '이메일' && <Mail className="w-3 h-3 text-blue-600" />}
                                    {item.activityType === '기타' && <MessageSquare className="w-3 h-3 text-blue-600" />}
                                    <span>{item.activityType}</span>
                                  </div>
                                  <span className="font-mono text-slate-400 font-medium text-[10px]">
                                    {item.date ? item.date.split('T')[0] : updateDate}
                                  </span>
                                </div>

                                <div className="text-slate-800 font-medium whitespace-pre-line leading-relaxed text-[11px]">
                                  {item.content}
                                </div>

                                {item.author && (
                                  <div className="text-[10px] text-slate-400 font-sans">
                                    작성자: {item.author}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400 italic">등록된 진행 히스토리가 없습니다.</p>
                          )}

                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-[10px] text-slate-400 font-sans">
                            <span className="flex items-center space-x-1 font-medium text-slate-500">
                              <History className="w-3 h-3 text-blue-500" />
                              <span>필터 기간 내 {historyData.items.length}건 진행 (최신순)</span>
                            </span>
                            {deal.history && deal.history.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHistoryModalDeal(deal);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                              >
                                전체 히스토리 ({deal.history.length}건)
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 딜 등록/수정 모달 */}
      {isModalOpen && (
        <DealFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDeal(null);
          }}
          onSaveSuccess={() => {
            loadDeals();
            setIsModalOpen(false);
            setSelectedDeal(null);
          }}
          onDeleteSuccess={() => {
            loadDeals();
            setIsModalOpen(false);
            setSelectedDeal(null);
          }}
          dealToEdit={selectedDeal}
          currentUserId={profile?.id}
          currentUserName={profile?.full_name}
        />
      )}

      {/* 히스토리 이력 모달 */}
      {historyModalDeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  [{historyModalDeal.company}] 히스토리 변경 이력
                </h3>
              </div>
              <button
                onClick={() => setHistoryModalDeal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {historyModalDeal.history && historyModalDeal.history.length > 0 ? (
                historyModalDeal.history.map((item, idx) => (
                  <div key={item.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500 font-mono text-[10px] font-bold">
                      <span>{item.updated_at ? item.updated_at.split('T')[0] : '-'}</span>
                      <span>작성자: {item.updated_by_name || historyModalDeal.sales_rep_name}</span>
                    </div>
                    {item.changes && (
                      <div className="font-semibold text-slate-800">
                        {item.changes}
                      </div>
                    )}
                    {item.note && (
                      <div className="text-slate-600 bg-white p-2 rounded-lg border border-slate-100 mt-1">
                        {item.note.replace(/^메모:\s*/, '')}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">저장된 히스토리 이력이 없습니다.</p>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setHistoryModalDeal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
