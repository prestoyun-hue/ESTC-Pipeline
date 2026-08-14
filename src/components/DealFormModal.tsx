import React, { useState, useEffect } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Deal, PipelineStage, UserProfile, DealHistoryItem } from '../types';
import { saveOrUpdateDeal, removeDeal } from '../utils/dealStorage';
import { getKSTTodayString, getKSTISOString, getKSTNow, getKSTFormattedDateTime } from '../utils/dateFilter';
import { 
  X, 
  Sparkles, 
  Building2, 
  DollarSign, 
  Calendar, 
  User, 
  Layers, 
  Tag, 
  Laptop, 
  Server, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Trash2,
  Percent,
  HelpCircle,
  History,
  Clock,
  Phone,
  Mail,
  Users,
  MessageSquare,
  Pencil,
  Edit3,
  Save,
  RotateCcw,
  Copy
} from 'lucide-react';

interface DealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealToEdit?: Deal | null;       // 수정할 딜 (없으면 신규 생성 모드)
  onSaveSuccess?: (savedDeal: Deal, isUpdate: boolean) => void;
  onSave?: (savedDeal?: Deal, isUpdate?: boolean) => void;
  onDeleteSuccess?: (deletedId: string) => void;
  currentUserId?: string;
  currentUserName?: string;
}

// 단계와 진행률(확률 %) 매핑 헬퍼
const STAGE_PROBABILITY_MAP: Record<PipelineStage, number> = {
  lead: 10,
  contacted: 20,
  proposal: 30,
  poc: 50,
  negotiation: 70,
  order: 90,
  closed_won: 100,
  closed_lost: 0
};

export const DealFormModal: React.FC<DealFormModalProps> = ({
  isOpen,
  onClose,
  dealToEdit,
  onSaveSuccess,
  onSave,
  onDeleteSuccess,
  currentUserId = '',
  currentUserName = ''
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isSalesRep = role === 'sales_rep';
  const isManagerOrAdmin = role === 'manager' || role === 'admin';

  // 모드 판별
  const isEditMode = !!dealToEdit;

  // Supabase profiles 목록 (영업담당자 선택용)
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // 폼 입력 상태
  const [dealCode, setDealCode] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [partnerName, setPartnerName] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [pcCount, setPcCount] = useState<number | ''>('');
  const [serverCount, setServerCount] = useState<number | ''>('');
  const [competitorProduct, setCompetitorProduct] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');

  // Select 항목
  const [leadSource, setLeadSource] = useState<string>('홈페이지');
  const [salesRepId, setSalesRepId] = useState<string>(currentUserId);
  const [salesRepName, setSalesRepName] = useState<string>(currentUserName);
  const [vendor, setVendor] = useState<string>('기타');
  const [dealType, setDealType] = useState<string>('신규');
  const [probability, setProbability] = useState<number>(10);
  const [stage, setStage] = useState<PipelineStage>('lead');
  const [closeReason, setCloseReason] = useState<string>('');

  // 날짜 및 텍스트
  const [receivedDate, setReceivedDate] = useState<string>(getKSTTodayString());
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>(
    getKSTTodayString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  );
  const [notes, setNotes] = useState<string>('');
  const [activityType, setActivityType] = useState<string>(''); // 진행 형태 (기본: 선택 안됨, 필수)
  const [title, setTitle] = useState<string>('');

  // 변경 히스토리 이력 상태 (삭제만 가능)
  const [historyList, setHistoryList] = useState<DealHistoryItem[]>([]);

  // 처리 상태 및 피드백
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [historyToDelete, setHistoryToDelete] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 계정 관리 리스트(profiles) 목록 조회 (로컬 스토리지 및 Supabase DB 연동)
  useEffect(() => {
    async function fetchProfiles() {
      let loadedProfiles: UserProfile[] = [];

      // 1. 로컬스토리지 계정 관리 리스트에서 1차 로드
      try {
        const savedAdminProfiles = localStorage.getItem('admin_user_profiles');
        const savedPipelineProfiles = localStorage.getItem('sales_pipeline_profiles');
        const targetSaved = savedAdminProfiles || savedPipelineProfiles;
        if (targetSaved) {
          const parsed = JSON.parse(targetSaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedProfiles = parsed as UserProfile[];
          }
        }
      } catch (e) {
        console.warn('로컬 프로필 로드 중 오류:', e);
      }

      // 2. Supabase DB 구성 시 DB에서 최신 profiles 로드
      if (isSupabaseConfigured && supabase) {
        try {
          setLoadingProfiles(true);
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, email, department');
          
          if (!error && data && data.length > 0) {
            loadedProfiles = data as UserProfile[];
          }
        } catch (err) {
          console.warn('profiles DB 조회 예외 (로컬 계정 리스트 사용):', err);
        } finally {
          setLoadingProfiles(false);
        }
      }

      if (loadedProfiles.length > 0) {
        setProfiles(loadedProfiles);
      }
    }

    if (isOpen) {
      fetchProfiles();
    }
  }, [isOpen]);

  // 수정 모드 / 신규 모드 시 폼 초기화
  useEffect(() => {
    if (!isOpen) return;

    const todayStr = getKSTTodayString();
    const cleanUserName = (currentUserName || '').replace(/\s*\(.*?\)/g, '').trim();

    if (dealToEdit) {
      setDealCode(dealToEdit.deal_code || dealToEdit.id || '');
      setCompany(dealToEdit.company || '');
      setPartnerName(dealToEdit.partner_name || '');
      setProductName(dealToEdit.product_name || '');
      setPcCount(dealToEdit.pc_count !== undefined ? dealToEdit.pc_count : '');
      setServerCount(dealToEdit.server_count !== undefined ? dealToEdit.server_count : '');
      setCompetitorProduct(dealToEdit.competitor_product || '');
      setAmount(dealToEdit.amount || 0);

      setLeadSource(dealToEdit.lead_source || '홈페이지');

      // 영업 사원인 경우 본인 정보로 강제 고정, 매니저/관리자는 편집 대상 딜의 영업담당자 정보를 유지
      if (isSalesRep) {
        setSalesRepId(currentUserId || 'demo-sales-rep-id');
        setSalesRepName(cleanUserName || '김영업');
      } else {
        setSalesRepId(dealToEdit.sales_rep_id || currentUserId || 'demo-sales-rep-id');
        setSalesRepName((dealToEdit.sales_rep_name || cleanUserName || '김영업').replace(/\s*\(.*?\)/g, '').trim());
      }

      setVendor(dealToEdit.vendor || 'ESET');
      setDealType(dealToEdit.deal_type || '신규');
      setProbability(dealToEdit.probability ?? 10);
      setStage(dealToEdit.stage || 'lead');
      setCloseReason(dealToEdit.close_reason || '');

      setReceivedDate(todayStr); // 오늘로 자동 등록 및 고정
      setExpectedCloseDate(dealToEdit.expected_close_date || todayStr);
      setNotes(dealToEdit.notes || '');
      setActivityType(dealToEdit.activity_type || ''); // 진행 형태 (선택 안됨 시 빈값)
      setTitle(dealToEdit.title || '');
      setHistoryList(dealToEdit.history ? [...dealToEdit.history] : []);
    } else {
      // 신규 등록 시 기본값 생성
      const randomCode = `DEAL-${getKSTNow().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setDealCode(randomCode);
      setCompany('');
      setPartnerName('');
      setProductName('');
      setPcCount('');
      setServerCount('');
      setCompetitorProduct('');
      setAmount('');

      setLeadSource('파트너 영업');
      
      // 관리자(admin)인 경우 계정 목록 중 시스템 관리자가 아닌 영업담당자 계정을 기본값으로 설정
      const nonAdminProfiles = profiles.filter(p => p.role !== 'admin');
      const firstNonAdmin = nonAdminProfiles.length > 0 ? nonAdminProfiles[0] : null;

      if (isAdmin && firstNonAdmin) {
        setSalesRepId(firstNonAdmin.id);
        setSalesRepName((firstNonAdmin.full_name || firstNonAdmin.name || '').replace(/\s*\(.*?\)/g, '').trim());
      } else {
        setSalesRepId(currentUserId || 'demo-sales-rep-id');
        setSalesRepName(cleanUserName || '영업담당자');
      }

      setVendor('ESET');
      setDealType('신규');
      setProbability(10);
      setStage('lead');
      setCloseReason('');

      setReceivedDate(todayStr); // 오늘로 자동 등록 및 고정
      setExpectedCloseDate(getKSTTodayString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
      setNotes('');
      setActivityType(''); // 진행 형태 기본: 선택 안됨
      setTitle('');
      setHistoryList([]);
    }
    setToastMessage(null);
  }, [isOpen, dealToEdit, currentUserId, currentUserName, isSalesRep]);

  // 히스토리 삭제 처리 핸들러
  const handleDeleteHistoryItem = (histId: string) => {
    setHistoryToDelete(histId);
  };

  const confirmDeleteHistory = () => {
    if (historyToDelete) {
      setHistoryList(prev => prev.filter(h => h.id !== historyToDelete));
      setToastMessage({ type: 'success', text: '히스토리 이력이 삭제되었습니다. (저장 시 적용됨)' });
      setHistoryToDelete(null);
    }
  };

  // 파이프라인 단계 변경 시 진행률(Probability) 자동 연동
  const handleStageChange = (newStage: PipelineStage) => {
    setStage(newStage);
    const mappedProb = STAGE_PROBABILITY_MAP[newStage];
    if (mappedProb !== undefined) {
      setProbability(mappedProb);
    }
    // Win / Lost 단계가 아니면 수주/실주 사유 초기화
    if (newStage !== 'closed_won' && newStage !== 'closed_lost') {
      setCloseReason('');
    }
  };

  // 진행률 변경 시 단계 자동 연동
  const handleProbabilityChange = (newProb: number) => {
    setProbability(newProb);
    if (newProb === 100) setStage('closed_won');
    else if (newProb === 0) setStage('closed_lost');
    else if (newProb >= 90) setStage('order');
    else if (newProb >= 70) setStage('negotiation');
    else if (newProb >= 50) setStage('poc');
    else if (newProb >= 30) setStage('proposal');
    else if (newProb >= 20) setStage('contacted');
    else setStage('lead');
  };

  // 영업담당자 선택 변경 핸들러
  const handleSalesRepSelect = (selectedId: string) => {
    setSalesRepId(selectedId);
    const matched = profiles.find(p => p.id === selectedId);
    if (matched) {
      setSalesRepName(matched.full_name);
    }
  };

  // 폼 제출 (INSERT / UPDATE)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!company.trim()) {
      setToastMessage({ type: 'error', text: '고객사명을 입력해 주세요.' });
      return;
    }
    if (amount === '' || Number(amount) < 0) {
      setToastMessage({ type: 'error', text: '올바른 예상 계약 금액을 입력해 주세요.' });
      return;
    }
    if (!expectedCloseDate) {
      setToastMessage({ type: 'error', text: '예상 매출일을 입력해 주세요.' });
      return;
    }
    if (!activityType) {
      setToastMessage({ type: 'error', text: '진행 형태를 선택해 주세요. (통화, 미팅, 이메일, 기타)' });
      return;
    }

    setSubmitting(true);
    setToastMessage(null);

    const generatedTitle = title.trim() 
      || `${company} ${productName ? productName + ' 도입' : '영업 건'}`;

    const nowIso = getKSTISOString();
    const formattedNow = getKSTFormattedDateTime(getKSTNow());

    // 영업담당자 최종 정보 계산 (sales_rep 권한은 본인 계정 고정, manager/admin은 선택값 사용)
    const cleanCurrentName = (currentUserName || '').replace(/\s*\(.*?\)/g, '').trim();
    const finalSalesRepName = isSalesRep 
      ? (cleanCurrentName || '김영업') 
      : (salesRepName || '영업담당자').replace(/\s*\(.*?\)/g, '').trim();
    const finalSalesRepId = isSalesRep 
      ? (currentUserId || 'demo-sales-rep-id') 
      : (salesRepId || 'demo-user');

    // 수정자 로그 이름 구성 (예: '박팀장 (영업 관리자)', '최관리 (관리자)', '김영업 (영업 담당)')
    let roleLabel = '영업 담당';
    if (role === 'admin') roleLabel = '시스템 관리자';
    else if (role === 'manager') roleLabel = '영업 관리자';
    const updaterDisplayName = `${cleanCurrentName || finalSalesRepName} (${roleLabel})`;

    let updatedHistory: DealHistoryItem[] = [...historyList];

    if (isEditMode && dealToEdit) {
      const changeList: string[] = [];
      
      const oldRepClean = (dealToEdit.sales_rep_name || '').replace(/\s*\(.*?\)/g, '').trim();
      if (oldRepClean !== finalSalesRepName) {
        changeList.push(`담당자 변경: ${oldRepClean || '미지정'} ➔ ${finalSalesRepName}`);
      }

      if (dealToEdit.stage !== stage) {
        const stageNames: Record<string, string> = {
          lead: '1. 신규 리드', contacted: '2. 미팅/접촉', proposal: '3. 제안', poc: '4. PoC',
          negotiation: '5. 견적/협상', order: '6. 주문대기', closed_won: '7. 수주', closed_lost: '8. 실패(드랍)'
        };
        changeList.push(`단계: ${stageNames[dealToEdit.stage] || dealToEdit.stage} ➔ ${stageNames[stage] || stage}`);
      }
      if (Number(dealToEdit.amount) !== Number(amount)) {
        changeList.push(`금액: ₩${Number(dealToEdit.amount).toLocaleString('ko-KR')} ➔ ₩${Number(amount).toLocaleString('ko-KR')}`);
      }
      if (dealToEdit.expected_close_date !== expectedCloseDate) {
        changeList.push(`예상매출일: ${dealToEdit.expected_close_date || '-'} ➔ ${expectedCloseDate}`);
      }
      if ((dealToEdit.notes || '') !== (notes.trim() || '')) {
        changeList.push(`진행내용 업데이트`);
      }
      if ((dealToEdit.activity_type || '') !== activityType) {
        changeList.push(`진행 형태: ${dealToEdit.activity_type || '미지정'} ➔ ${activityType}`);
      }
      if (dealToEdit.company !== company.trim()) {
        changeList.push(`고객사명: ${dealToEdit.company} ➔ ${company.trim()}`);
      }
      if (dealToEdit.vendor !== vendor) {
        changeList.push(`벤더: ${dealToEdit.vendor || '-'} ➔ ${vendor}`);
      }

      const summaryText = changeList.length > 0 ? changeList.join(', ') : `[${activityType}] 정보 업데이트`;

      const historyItem: DealHistoryItem = {
        id: `hist-${Date.now()}`,
        updated_at: formattedNow,
        updated_by_name: updaterDisplayName,
        changes: summaryText,
        note: notes.trim() ? notes.trim() : undefined,
        activity_type: activityType
      };

      updatedHistory = [historyItem, ...updatedHistory];
    } else {
      const historyItem: DealHistoryItem = {
        id: `hist-${Date.now()}`,
        updated_at: formattedNow,
        updated_by_name: updaterDisplayName,
        changes: isManagerOrAdmin 
          ? `신규 영업 딜 등록 (지정 영업담당: ${finalSalesRepName})` 
          : '신규 영업 딜 등록',
        note: notes.trim() ? notes.trim() : undefined,
        activity_type: activityType
      };
      updatedHistory = [historyItem];
    }

    const payload: Partial<Deal> = {
      deal_code: dealCode || `DEAL-${Date.now()}`,
      title: generatedTitle,
      company: company.trim(),
      partner_name: partnerName.trim() || undefined,
      product_name: productName.trim() || undefined,
      pc_count: pcCount !== '' ? Number(pcCount) : 0,
      server_count: serverCount !== '' ? Number(serverCount) : 0,
      competitor_product: competitorProduct.trim() || undefined,
      amount: Number(amount),

      lead_source: leadSource,
      sales_rep_id: finalSalesRepId,
      sales_rep_name: finalSalesRepName,
      vendor: vendor,
      deal_type: dealType,
      probability: Number(probability),
      stage: stage,
      close_reason: (stage === 'closed_won' || stage === 'closed_lost') ? closeReason : undefined,

      received_date: receivedDate,
      expected_close_date: expectedCloseDate,
      notes: notes.trim() || undefined,
      activity_type: activityType,
      updated_at: nowIso,
      history: updatedHistory
    };

    try {
      const targetId = dealToEdit?.id || `deal-${Date.now()}`;
      const targetCreatedAt = dealToEdit?.created_at || getKSTISOString();

      const savedResultDeal: Deal = {
        id: targetId,
        created_at: targetCreatedAt,
        ...payload
      } as Deal;

      // 중앙 딜 스토리지 및 Supabase 저장 동기화
      await saveOrUpdateDeal(savedResultDeal, isEditMode);

      // 즉시 화면 및 부모 컴포넌트에 반영
      if (onSaveSuccess) {
        onSaveSuccess(savedResultDeal, isEditMode);
      }
      if (onSave) {
        onSave(savedResultDeal, isEditMode);
      }

      setToastMessage({
        type: 'success',
        text: isEditMode ? '영업 딜 정보가 성공적으로 수정되었습니다!' : '신규 영업 딜이 성공적으로 등록되었습니다!'
      });

      setTimeout(() => {
        onClose();
      }, 500);

    } catch (err: any) {
      console.error('딜 저장 오류:', err);
      setToastMessage({
        type: 'error',
        text: err.message || '딜 저장 중 오류가 발생했습니다. 다시 시도해 주세요.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 삭제 처리
  const handleDelete = async () => {
    if (!dealToEdit || !onDeleteSuccess) return;
    if (!isAdmin) {
      alert('딜 삭제 권한이 없습니다. (관리자 전용 기능)');
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!dealToEdit || !onDeleteSuccess) return;
    setDeleting(true);
    try {
      await removeDeal(dealToEdit.id);
      onDeleteSuccess(dealToEdit.id);
      onClose();
    } catch (err) {
      console.error('딜 삭제 오류:', err);
      setToastMessage({ type: 'error', text: '딜 삭제 실패' });
    } finally {
      setDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  // 기존 딜 데이터 기반으로 수정 후 '새로운 딜로 복제 생성'
  const handleSaveAsNew = async () => {
    if (!company.trim()) {
      setToastMessage({ type: 'error', text: '고객사명을 입력해 주세요.' });
      return;
    }
    if (amount === '' || Number(amount) < 0) {
      setToastMessage({ type: 'error', text: '올바른 예상 계약 금액을 입력해 주세요.' });
      return;
    }
    if (!expectedCloseDate) {
      setToastMessage({ type: 'error', text: '예상 매출일을 입력해 주세요.' });
      return;
    }
    if (!activityType) {
      setToastMessage({ type: 'error', text: '진행 형태를 선택해 주세요. (통화, 미팅, 이메일, 기타)' });
      return;
    }

    setSubmitting(true);
    setToastMessage(null);

    const generatedTitle = title.trim() 
      || `${company} ${productName ? productName + ' 도입' : '영업 건'}`;

    const nowIso = getKSTISOString();
    const formattedNow = getKSTFormattedDateTime(getKSTNow());

    const cleanCurrentName = (currentUserName || '').replace(/\s*\(.*?\)/g, '').trim();
    const finalSalesRepName = isSalesRep 
      ? (cleanCurrentName || '김영업') 
      : (salesRepName || '영업담당자').replace(/\s*\(.*?\)/g, '').trim();
    const finalSalesRepId = isSalesRep 
      ? (currentUserId || 'demo-sales-rep-id') 
      : (salesRepId || 'demo-user');

    let roleLabel = '영업 담당';
    if (role === 'admin') roleLabel = '시스템 관리자';
    else if (role === 'manager') roleLabel = '영업 관리자';
    const updaterDisplayName = `${cleanCurrentName || finalSalesRepName} (${roleLabel})`;

    const historyItem: DealHistoryItem = {
      id: `hist-${Date.now()}`,
      updated_at: formattedNow,
      updated_by_name: updaterDisplayName,
      changes: `딜 복제 신규 등록 (원본 딜: ${dealToEdit?.company || '기존 딜'})`,
      note: notes.trim() ? notes.trim() : undefined,
      activity_type: activityType
    };

    // DEAL-ID 규칙 (DEAL-YYYY-XXXX)에 맞춰 새 딜 코드 및 ID 생성
    const currentYear = getKSTNow().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newDealCode = `DEAL-${currentYear}-${randomSuffix}`;
    const newDealId = `deal-${Date.now()}`;

    const savedResultDeal: Deal = {
      id: newDealId,
      created_at: nowIso,
      deal_code: newDealCode,
      title: generatedTitle,
      company: company.trim(),
      partner_name: partnerName.trim() || undefined,
      product_name: productName.trim() || undefined,
      pc_count: pcCount !== '' ? Number(pcCount) : 0,
      server_count: serverCount !== '' ? Number(serverCount) : 0,
      competitor_product: competitorProduct.trim() || undefined,
      amount: Number(amount),

      lead_source: leadSource,
      sales_rep_id: finalSalesRepId,
      sales_rep_name: finalSalesRepName,
      vendor: vendor,
      deal_type: dealType,
      probability: Number(probability),
      stage: stage,
      close_reason: (stage === 'closed_won' || stage === 'closed_lost') ? closeReason : undefined,

      received_date: receivedDate,
      expected_close_date: expectedCloseDate,
      notes: notes.trim() || undefined,
      activity_type: activityType,
      updated_at: nowIso,
      history: [historyItem]
    };

    try {
      // 복제 생성이므로 isUpdate = false
      await saveOrUpdateDeal(savedResultDeal, false);

      if (onSaveSuccess) {
        onSaveSuccess(savedResultDeal, false);
      }
      if (onSave) {
        onSave(savedResultDeal, false);
      }

      setToastMessage({
        type: 'success',
        text: '현재 수정된 내용으로 새로운 영업 딜이 성공적으로 복제 생성되었습니다!'
      });

      setTimeout(() => {
        onClose();
      }, 500);

    } catch (err: any) {
      console.error('새로운 딜 복제 생성 오류:', err);
      setToastMessage({
        type: 'error',
        text: err.message || '새로운 딜 복제 중 오류가 발생했습니다.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isWinOrLost = stage === 'closed_won' || stage === 'closed_lost';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${isEditMode ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'} shadow-xs`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isEditMode ? `영업 딜 수정 (${dealCode})` : '딜 등록'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isAdmin ? (
                  isSupabaseConfigured 
                    ? 'Supabase `deals` 테이블에 실시간 반영되는 CRUD 폼입니다.' 
                    : 'Supabase 연동 준비 모드 (로컬 실시간 업데이트)'
                ) : (
                  '파이프라인 영업 딜 항목을 세부 관리하는 폼입니다.'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast 알림 */}
        {toastMessage && (
          <div className={`px-6 py-3 border-b text-xs flex items-center space-x-2 font-medium ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Form Body - Grid Layout */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* 섹션 1: 고객 정보 */}
          <div>
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Building2 className="w-4 h-4" />
              <span>1. 고객 정보</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* 고객사명 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  고객사명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="예: 삼성전자"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* 파트너명 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  파트너명
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="예: 이셋코리아"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 예상 금액 (단위 $ 삭제) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  예상 금액 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="50000000"
                  step={1000000}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              {/* 영업 건명 / 제목 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  영업 건명 (Deal Title)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="미입력 시 [고객사명 + 제품명]으로 자동 생성됩니다"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

            </div>
          </div>

          {/* 섹션 2: 솔루션 정보 */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Laptop className="w-4 h-4" />
              <span>2. 솔루션 정보</span>
            </h4>

            {/* 줄 1: 벤더 | 솔루션명 | 구분 (신규, 갱신) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* 벤더 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  벤더 (Vendor)
                </label>
                <select
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="ESET">ESET</option>
                  <option value="Hillstone">Hillstone</option>
                  <option value="SealSuite">SealSuite</option>
                  <option value="RidgeSecurity">RidgeSecurity</option>
                  <option value="ISLOnline">ISLOnline</option>
                  <option value="Wondershare">Wondershare</option>
                  <option value="Corel">Corel</option>
                  <option value="AXGate">AXGate</option>
                  <option value="Paloalto">Paloalto</option>
                  <option value="Fortinet">Fortinet</option>
                  <option value="Nueshield">Nueshield</option>
                  <option value="Veeam">Veeam</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              {/* 솔루션명 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  솔루션명
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="예: ESET EDR"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 구분 (신규, 갱신 - 두 항목만) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  구분 (Deal Type)
                </label>
                <select
                  value={dealType}
                  onChange={(e) => setDealType(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="신규">신규</option>
                  <option value="갱신">갱신</option>
                </select>
              </div>
            </div>

            {/* 줄 2: PC 수량 | Server 수량 | 경쟁제품 / 타사솔루션 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* PC 수량 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Laptop className="w-3.5 h-3.5 text-slate-400" />
                  <span>PC 수량 (PC#)</span>
                </label>
                <input
                  type="number"
                  value={pcCount}
                  onChange={(e) => setPcCount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  min={0}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Server 수량 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  <span>Server 수량 (Server#)</span>
                </label>
                <input
                  type="number"
                  value={serverCount}
                  onChange={(e) => setServerCount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  min={0}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* 경쟁제품 / 타사솔루션 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  경쟁제품 / 타사솔루션
                </label>
                <input
                  type="text"
                  value={competitorProduct}
                  onChange={(e) => setCompetitorProduct(e.target.value)}
                  placeholder="예: 타사 A보안, B솔루션"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 영업담당자 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>영업담당자 (Sales Rep)</span>
                  {isSalesRep ? (
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                      본인 계정 고정
                    </span>
                  ) : (
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                      매니저/관리자 지정 권한
                    </span>
                  )}
                </label>
                <select
                  value={salesRepName}
                  disabled={isSalesRep}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setSalesRepName(newName);
                    const matched = profiles.find(p => p.full_name && p.full_name.replace(/\s*\(.*?\)/g, '').trim() === newName);
                    if (matched) {
                      setSalesRepId(matched.id);
                    } else if (currentUserName && currentUserName.replace(/\s*\(.*?\)/g, '').trim() === newName) {
                      setSalesRepId(currentUserId || 'current-user-id');
                    } else {
                      setSalesRepId(`rep-${Date.now()}`);
                    }
                  }}
                  className={`w-full p-2.5 border font-semibold rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isSalesRep 
                      ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed' 
                      : 'bg-white border-slate-300 text-slate-900 cursor-pointer'
                  }`}
                >
                  {(() => {
                    // 담당자 목록 Map (시스템 관리자 제외: 계정 관리 등록자 + 비관리자 사용자 + 기존 딜 담당자)
                    const repMap = new Map<string, { id: string; name: string; dept?: string; role?: string }>();

                    // 1. 계정 관리(profiles) 리스트 중 시스템 관리자(admin) 제외
                    profiles.forEach(p => {
                      if (p.role === 'admin') return; // 시스템 관리자는 제외
                      const cleanName = (p.full_name || p.name || '').replace(/\s*\(.*?\)/g, '').trim();
                      if (cleanName) {
                        repMap.set(cleanName, {
                          id: p.id,
                          name: cleanName,
                          dept: p.department,
                          role: p.role
                        });
                      }
                    });

                    // 2. 현재 로그인 사용자 (단, 시스템 관리자가 아닌 경우에만 포함)
                    if (currentUserName && role !== 'admin') {
                      const cleanCurrent = currentUserName.replace(/\s*\(.*?\)/g, '').trim();
                      if (cleanCurrent && !repMap.has(cleanCurrent)) {
                        repMap.set(cleanCurrent, {
                          id: currentUserId || 'current-user-id',
                          name: cleanCurrent,
                          role: role
                        });
                      }
                    }

                    // 3. 수정 중인 기존 딜의 담당자 (시스템 관리자가 아닌 경우 유지)
                    if (salesRepName) {
                      const cleanExisting = salesRepName.replace(/\s*\(.*?\)/g, '').trim();
                      if (cleanExisting && !repMap.has(cleanExisting)) {
                        const matchedP = profiles.find(p => (p.full_name || p.name || '').replace(/\s*\(.*?\)/g, '').trim() === cleanExisting);
                        if (!matchedP || matchedP.role !== 'admin') {
                          repMap.set(cleanExisting, {
                            id: salesRepId || 'existing-rep-id',
                            name: cleanExisting
                          });
                        }
                      }
                    }

                    const reps = Array.from(repMap.values());
                    const myCleanName = currentUserName ? currentUserName.replace(/\s*\(.*?\)/g, '').trim() : '';

                    return reps.map((rep) => {
                      const isMe = rep.name === myCleanName;
                      const deptStr = rep.dept ? ` (${rep.dept})` : '';
                      const roleStr = rep.role === 'manager' ? ' [매니저]' : '';
                      return (
                        <option key={rep.name} value={rep.name}>
                          {rep.name}{deptStr}{roleStr}{isMe ? ' - (현재 로그인)' : ''}
                        </option>
                      );
                    });
                  })()}
                </select>
                {isSalesRep && (
                  <p className="mt-1 text-[11px] text-slate-500 font-medium">
                    영업담당 권한은 본인명의 딜만 생성/수정 가능합니다.
                  </p>
                )}
                {isManagerOrAdmin && (
                  <p className="mt-1 text-[11px] text-blue-600 font-medium">
                    매니저/관리자는 다른 영업담당자를 지정해 딜을 등록/수정할 수 있으며, 이 때 로그가 저장됩니다.
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* 섹션 3: 영업 단계 및 예상 매출일 */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Layers className="w-4 h-4" />
              <span>3. 영업 단계 및 예상 매출일</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Source (리드 출처) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Source (리드 출처)
                </label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="파트너 영업">파트너 영업</option>
                  <option value="갱신 대상">갱신 대상</option>
                  <option value="인바운드">인바운드</option>
                  <option value="해피콜">해피콜</option>
                  <option value="아웃바운드">아웃바운드</option>
                  <option value="기존 고객">기존 고객</option>
                  <option value="지인 소개">지인 소개</option>
                  <option value="세미나/전시회">세미나/전시회</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              {/* 예상매출일 (3번 섹션으로 이동) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>예상매출일 (Expected Close Date) <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              {/* 단계 (Stage) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  단계 (Pipeline Stage) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={stage}
                  onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="lead">1. 신규 리드 - 10%</option>
                  <option value="contacted">2. 미팅/접촉 - 20%</option>
                  <option value="proposal">3. 제안 - 30%</option>
                  <option value="poc">4. PoC - 50%</option>
                  <option value="negotiation">5. 견적/협상 - 70%</option>
                  <option value="order">6. 주문대기 - 90%</option>
                  <option value="closed_won">7. 수주 - 100%</option>
                  <option value="closed_lost">8. 실패 - 0%</option>
                </select>
              </div>

              {/* 진행률 (Probability %) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>진행률 / 수주 확률</span>
                  <span className="font-bold text-blue-600 font-mono">{probability}%</span>
                </label>
                <select
                  value={probability}
                  onChange={(e) => handleProbabilityChange(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={0}>0% (실패 / 드랍)</option>
                  <option value={10}>10% (신규 리드)</option>
                  <option value={20}>20% (미팅/접촉)</option>
                  <option value={30}>30% (제안)</option>
                  <option value={50}>50% (PoC)</option>
                  <option value={70}>70% (견적/협상)</option>
                  <option value={90}>90% (주문대기)</option>
                  <option value={100}>100% (수주)</option>
                </select>
              </div>

              {/* 수주/드랍 사유 (Win/Lost 시 활성화) */}
              <div className="md:col-span-2">
                <label className={`block text-xs font-semibold mb-1 flex items-center space-x-1 ${
                  isWinOrLost ? 'text-blue-900 font-bold' : 'text-slate-400'
                }`}>
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>수주/드랍 사유 {isWinOrLost && <span className="text-rose-500">*</span>}</span>
                </label>
                <input
                  type="text"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  disabled={!isWinOrLost}
                  placeholder={
                    stage === 'closed_won' 
                      ? '수주 성공 사유 (예: 가격 경쟁력, 신속한 기술 지원)' 
                      : stage === 'closed_lost' 
                      ? '드랍 사유 (예: 타사 경쟁 단가 열위, 예산 수립 취소)' 
                      : '수주(100%) 또는 드랍(0%) 단계 선택 시 작성 가능'
                  }
                  className={`w-full p-2.5 rounded-xl text-xs transition-all ${
                    isWinOrLost 
                      ? 'bg-amber-50/60 border border-amber-300 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500' 
                      : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  required={isWinOrLost}
                />
              </div>

            </div>
          </div>

          {/* 섹션 4: 상세 진행 내용 및 진행 형태 */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Calendar className="w-4 h-4" />
              <span>4. 상세 진행 내용</span>
            </h4>

            {/* 진행 형태 선택 */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                진행 형태
              </label>

              <div className="grid grid-cols-4 gap-2 p-1.5 rounded-xl border border-slate-200 bg-slate-100/90">
                {[
                  { id: '통화', label: '통화', icon: Phone },
                  { id: '미팅', label: '미팅', icon: Users },
                  { id: '이메일', label: '이메일', icon: Mail },
                  { id: '기타', label: '기타', icon: MessageSquare }
                ].map((item) => {
                  const IconComp = item.icon;
                  const isSelected = activityType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActivityType(item.id)}
                      className={`py-2 px-1.5 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center space-x-0 sm:space-x-1.5 space-y-1 sm:space-y-0 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                      <span className="text-[11px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 진행내용 (최신 진행상황) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                진행내용 (최신 진행상황 및 메모)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="클라이언트 요구사항, 미팅 결과 및 향후 액션 플랜을 기록하세요..."
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />
            </div>

          </div>

          {/* 섹션 5: 변경 히스토리 (History) 타임라인 - 삭제만 가능 */}
          {historyList && historyList.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>5. 변경 히스토리 이력 ({historyList.length}건)</span>
                </h4>
                <span className="text-[11px] text-slate-400">불필요한 히스토리 항목은 삭제할 수 있습니다.</span>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 max-h-56 overflow-y-auto space-y-2.5">
                {historyList.map((h, idx) => (
                  <div key={h.id || idx} className="bg-white p-3 rounded-xl border border-slate-200/80 text-xs shadow-2xs space-y-1.5 group hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center space-x-1 font-bold text-blue-900">
                          <Clock className="w-3 h-3 text-blue-500" />
                          <span>{h.updated_at}</span>
                        </span>

                        {h.activity_type && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-100">
                            [{h.activity_type}]
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 font-semibold text-[10px]">
                          작성자: {h.updated_by_name || '담당자'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDeleteHistoryItem(h.id)}
                          title="이력 삭제"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="font-semibold text-slate-800 text-xs">
                      {h.changes}
                    </div>

                    {h.note && (
                      <div className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {h.note.replace(/^메모:\s*/, '')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div>
            {isEditMode && onDeleteSuccess && isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || submitting}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleting ? '삭제 중...' : '딜 삭제'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              취소
            </button>

            {isEditMode && !isSalesRep && (
              <button
                type="button"
                onClick={handleSaveAsNew}
                disabled={submitting || deleting}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                title="현재 폼에 입력된 내용으로 별도의 새로운 딜로 신규 생성합니다."
              >
                <Copy className="w-4 h-4 text-emerald-600" />
                <span>신규 저장</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || deleting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>저장 처리 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isEditMode ? '수정 저장' : '신규 저장'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
      {/* 딜 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="딜 삭제 확인"
        message={dealToEdit ? `'${dealToEdit.company}'의 딜 [${dealToEdit.deal_code || dealToEdit.id}]을 삭제하시겠습니까?` : '정말 삭제하시겠습니까?'}
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        confirmText="삭제"
        cancelText="취소"
        isDestructive={true}
      />

      {/* 히스토리 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!historyToDelete}
        title="이력 삭제 확인"
        message="해당 변경 히스토리 항목을 삭제하시겠습니까?"
        onConfirm={confirmDeleteHistory}
        onCancel={() => setHistoryToDelete(null)}
        confirmText="삭제"
        cancelText="취소"
        isDestructive={true}
      />
    </div>
  );
};
