import React from 'react';
import { BookOpen, X } from 'lucide-react';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div 
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">영업담당(Sales Rep) 사용 매뉴얼</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 매뉴얼 본문 내용 */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar text-sm text-slate-700 space-y-8">
          
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">📖 ESTC Sales Pipeline - 영업담당(Sales Rep) 사용 매뉴얼</h3>
            <p className="text-slate-600 leading-relaxed">
              환영합니다! 본 매뉴얼은 <strong>영업담당(Sales Rep)</strong> 권한을 가진 사용자가 영업 파이프라인 시스템을 효율적으로 활용할 수 있도록 안내하는 가이드입니다.
            </p>
          </div>

          <hr className="border-slate-200" />

          {/* 1. 시작하기 및 보안 관리 */}
          <section className="space-y-4">
            <h4 className="text-lg font-bold text-slate-900">1. 시작하기 및 보안 관리</h4>
            
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>🔐 1.1 로그인 및 비밀번호 관리</span>
                </h5>
                <ul className="list-disc list-inside space-y-1.5 ml-1 text-slate-600">
                  <li><strong>로그인:</strong> 지급받은 이메일 계정과 비밀번호로 로그인합니다.</li>
                  <li><strong>비밀번호 변경:</strong> 우측 상단 네비게이션 바의 <strong>[열쇠(🔑) 아이콘]</strong>을 클릭하여 언제든 비밀번호를 변경할 수 있습니다.</li>
                  <li className="text-rose-600 font-medium"><strong>🚨 보안 안내:</strong> 사용자의 기존 비밀번호는 엄격하게 암호화되어 있어 <strong>관리자를 포함한 그 누구도 열람할 수 없습니다.</strong> 만약 비밀번호를 잊어버린 경우, 관리자에게 '임시 비밀번호 발급'을 요청한 뒤 로그인하여 즉시 새 비밀번호로 변경하시기 바랍니다.</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>🛡️ 1.2 권한 및 노출 범위 (중요)</span>
                </h5>
                <ul className="list-disc list-inside space-y-1.5 ml-1 text-slate-600">
                  <li><strong>나의 딜만 보입니다:</strong> 영업담당자는 보안 및 업무 집중도를 위해 <strong>'본인이 담당자(Sales Rep)로 지정된 딜'만 조회하고 관리</strong>할 수 있습니다. 타 영업사원의 딜은 노출되지 않습니다.</li>
                  <li><strong>삭제 권한 제한:</strong> 한 번 등록한 딜은 영업 사원이 임의로 삭제할 수 없습니다. (실수나 진행 취소 건은 단계를 `Lost(계약 실패)`로 변경하거나, 삭제가 꼭 필요한 경우 관리자에게 요청해주세요.)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 2. 주요 메뉴 가이드 */}
          <section className="space-y-4">
            <h4 className="text-lg font-bold text-slate-900">2. 주요 메뉴 가이드</h4>
            <p className="text-slate-600">좌측(또는 상단)의 탭을 통해 다양한 뷰(View)로 영업 현황을 파악할 수 있습니다.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                <h5 className="font-bold text-blue-700 mb-2">📊 파이프라인 보드 (보드 뷰)</h5>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li><strong>기능:</strong> 진행 중인 영업 딜들을 단계별 칸반(Kanban) 보드 형태로 한눈에 봅니다.</li>
                  <li><strong>단계 이동:</strong> 딜 카드를 마우스로 <strong>드래그 앤 드롭</strong>하여 다른 단계로 손쉽게 이동시킬 수 있습니다.</li>
                  <li className="text-xs mt-1"><strong>단계 구성:</strong> 신규 리드 ➡️ 미팅/접촉 ➡️ 제안 ➡️ PoC 진행 ➡️ 협상 ➡️ 주문/발주 ➡️ 계약 성공(Win) / 계약 실패(Lost)</li>
                </ul>
              </div>
              
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                <h5 className="font-bold text-blue-700 mb-2">📑 파이프라인 현황 (목록 뷰)</h5>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li><strong>기능:</strong> 모든 딜을 엑셀 형식의 표(Table)로 모아보고, 다양한 조건(고객사, 솔루션 등)으로 검색/정렬할 수 있습니다.</li>
                  <li><strong>데이터 추출:</strong> 우측 상단의 다운로드 버튼을 통해 현재 리스트를 <strong>CSV(엑셀) 파일로 내보내기</strong> 할 수 있어 보고서 작성 시 유용합니다.</li>
                </ul>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                <h5 className="font-bold text-blue-700 mb-2">📝 영업 리포트</h5>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li><strong>기능:</strong> 내가 등록한 딜의 상세 '영업 활동(히스토리)' 내역만 날짜별로 모아보는 메뉴입니다.</li>
                  <li><strong>활용 팁:</strong> 주간 미팅, 일일 업무 보고 시 특정 기간(예: 이번 주)을 필터링하여 진행한 미팅, 통화 내역을 빠르게 리뷰할 수 있습니다.</li>
                </ul>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                <h5 className="font-bold text-blue-700 mb-2">📈 영업 현황 (대시보드)</h5>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li><strong>기능:</strong> 나의 수주 확률, 예상 매출액, 파이프라인 퍼널(깔때기) 통계를 차트와 그래프로 시각화하여 확인합니다.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3. 딜(영업 건) 등록 및 관리하기 */}
          <section className="space-y-4">
            <h4 className="text-lg font-bold text-slate-900">3. 딜(영업 건) 등록 및 관리하기</h4>
            
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h5 className="font-bold text-slate-800 mb-2">📝 3.1 신규 딜 등록하기</h5>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>파이프라인 보드나 현황 메뉴에서 우측 상단의 <strong>[+ 딜 등록]</strong> 버튼을 클릭합니다.</li>
                  <li>고객사, 솔루션/제품 정보, 예상 매출 금액 등을 입력합니다.</li>
                  <li><strong>참고:</strong> 영업담당자(Sales Rep) 항목은 본인의 계정으로 <strong>자동 고정</strong>되며 변경할 수 없습니다.</li>
                </ol>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h5 className="font-bold text-slate-800 mb-2">🔄 3.2 딜 수정 및 활동 내역(History) 기록하기</h5>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>등록된 딜 카드나 목록을 클릭하면 상세 수정 창이 열립니다.</li>
                  <li>진행 상황이 바뀔 때마다 <strong>상세 창 하단의 [진행 내역 / 히스토리 추가]</strong> 부분에 내용을 기록합니다.</li>
                  <li>`미팅`, `통화`, `이메일` 등의 유형을 선택하고 상세 내용을 남기면, 일자별로 영업 이력이 누적되어 관리됩니다.<br/>
                    <span className="text-xs text-blue-600 ml-4 font-medium">* Tip: 본인이 작성한 히스토리는 휴지통(🗑️) 아이콘을 눌러 개별 삭제할 수 있습니다.</span>
                  </li>
                  <li>내용을 추가한 후 하단의 <strong>[수정 저장]</strong>을 반드시 클릭해야 반영됩니다.</li>
                </ol>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="space-y-4 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
            <h4 className="text-lg font-bold text-indigo-900">❓ FAQ (자주 묻는 질문)</h4>
            
            <div className="space-y-4 text-slate-700">
              <div>
                <p className="font-bold text-indigo-800">Q. 진행 중이던 딜이 갑자기 보이지 않아요!</p>
                <p className="mt-1 ml-4 border-l-2 border-indigo-200 pl-3">
                  A. 담당자가 타인으로 변경되었거나, 상단 검색/필터(예: 날짜 필터, 단계 필터)가 적용되어 숨김 처리되었을 수 있습니다. 필터 조건을 초기화해 보세요.
                </p>
              </div>

              <div>
                <p className="font-bold text-indigo-800">Q. 비슷한 딜을 새로 등록해야 하는데 복제(Save As New) 기능이 없나요?</p>
                <p className="mt-1 ml-4 border-l-2 border-indigo-200 pl-3">
                  A. 영업담당 권한은 무분별한 데이터 중복 방지를 위해 복제 저장 기능이 제한되어 있습니다. [신규 등록] 버튼을 통해 새로 작성해 주시기 바랍니다.
                </p>
              </div>

              <div>
                <p className="font-bold text-indigo-800">Q. Win/Lost 시 사유를 꼭 적어야 하나요?</p>
                <p className="mt-1 ml-4 border-l-2 border-indigo-200 pl-3">
                  A. 네, 딜 단계를 <code>계약 성공(Win)</code> 또는 <code>계약 실패(Lost)</code>로 변경 시 사유 입력 칸이 활성화됩니다. 추후 정확한 성과 분석을 위해 명확히 기재하는 것을 권장합니다.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50/80 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
