/**
 * ====================================================================
 * [영업 파이프라인 메인 애플리케이션 App.tsx]
 * --------------------------------------------------------------------
 * - AuthProvider 세션 및 profiles 테이블 프로필 상태 관리
 * - 미인증 사용자 -> 로그인 / 회원가입 UI (AuthForm) 렌더링
 * - 인증된 사용자 -> 네비게이션 바 및 역할(role: sales_rep, manager, admin)에
 *   따른 영업 파이프라인, 성과 분석, 사용자 역할 관리 화면 출력
 * - 모든 코드 한글 상세 주석 적용
 * ====================================================================
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthForm } from './components/AuthForm';
import { SalesPipeline } from './components/SalesPipeline';
import { SalesPipelineTable } from './components/SalesPipelineTable';
import { WorkReportTable } from './components/WorkReportTable';
import { SalesReportDashboard } from './components/SalesReportDashboard';
import { TeamAnalytics } from './components/TeamAnalytics';
import { AdminRoleManager } from './components/AdminRoleManager';
import { SupabaseSqlGuide } from './components/SupabaseSqlGuide';
import { PipelineFilterOptions } from './types';

/**
 * 메인 대시보드 및 파이프라인 콘텐츠 렌더러
 */
const MainContent: React.FC = () => {
  const { profile, role, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('pipeline');
  const [tableFilters, setTableFilters] = useState<PipelineFilterOptions>({ stage: 'all' });

  // 파이프라인 보드 금액 카드 클릭 시 해당 조건 필터(단계, 검색어, 담당자, 기간 등)를 적용하고 파이프라인 현황 탭으로 이동
  const handleNavigateToTableWithFilter = (filters: PipelineFilterOptions) => {
    setTableFilters(filters);
    setActiveTab('pipeline-table');
  };

  // 로딩 상태 렌더링
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-700">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold tracking-wider text-slate-600">
          사용자 세션 및 프로필 불러오는 중...
        </p>
      </div>
    );
  }

  // 로그인되어 있지 않은 경우 로그인/회원가입 UI 출력
  if (!profile) {
    return (
      <div className="relative min-h-screen flex items-center justify-center py-12 px-4 overflow-hidden bg-slate-900">
        {/* 데이터 비즈니스 배경 이미지 (은은한 투명도 + 오버레이) */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2000&q=80')`,
            opacity: 0.22,
          }}
        />
        
        {/* 은은한 그라데이션 및 비즈니스 그리드 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/80 to-blue-950/40 backdrop-blur-[2px]" />
        
        {/* 미세한 테크 그리드 패턴 */}
        <div 
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)`,
            backgroundSize: '28px 28px'
          }}
        />

        {/* 상단/하단 은은한 앰비언트 글로우 */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full">
          <AuthForm />
        </div>
      </div>
    );
  }

  // 로그인 완료된 경우 파이프라인 메인 화면 출력
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* 상단 네비게이션 바 */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'pipeline' && <SalesPipeline onNavigateToTable={handleNavigateToTableWithFilter} />}
        {activeTab === 'pipeline-table' && (
          <SalesPipelineTable 
            initialFilters={tableFilters} 
            onFiltersChange={setTableFilters} 
          />
        )}
        {activeTab === 'work-report' && <WorkReportTable />}
        {activeTab === 'reports' && <SalesReportDashboard />}
        {activeTab === 'analytics' && <TeamAnalytics />}
        {activeTab === 'roles' && <AdminRoleManager />}
        {activeTab === 'sql-guide' && role === 'admin' && <SupabaseSqlGuide />}
      </main>


    </div>
  );
};

/**
 * Root App 컴포넌트
 */
export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
