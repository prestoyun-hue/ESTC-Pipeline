/**
 * ====================================================================
 * [상단 네비게이션 바 컴포넌트]
 * --------------------------------------------------------------------
 * - 현재 로그인한 사용자의 프로필, 부서, 역할(role: sales_rep, manager, admin) 표시
 * - Supabase 연동 상태 및 데모 모드 인디케이터
 * - 역할 변경 테스트 스위처 및 로그아웃 기능
 * ====================================================================
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { ChangePasswordModal } from './ChangePasswordModal';
import { UserManualModal } from './UserManualModal';
import { 
  Briefcase, 
  LogOut, 
  ShieldCheck, 
  Users, 
  ChevronDown,
  LayoutGrid,
  ListFilter,
  FileText,
  BarChart3,
  TrendingUp,
  Settings,
  Database,
  Menu,
  X,
  KeyRound,
  HelpCircle
} from 'lucide-react';

export const Navbar: React.FC<{ activeTab: string; setActiveTab: (tab: string) => void }> = ({
  activeTab,
  setActiveTab,
}) => {
  const { profile, role, signOut, isDemoMode, loginAsDemoUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);

  /**
   * 역할(Role) 배지 버블 색상 및 한글명 매핑
   */
  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return {
          label: '시스템 관리자',
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          icon: <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-600" />,
        };
      case 'dept_manager':
        return {
          label: profile?.department ? `${profile.department} 관리자` : '부서 관리자',
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
          icon: <Briefcase className="w-3.5 h-3.5 mr-1 text-indigo-600" />,
        };
      case 'manager':
        return {
          label: '총괄 매니저',
          bg: 'bg-purple-50 border-purple-200 text-purple-800',
          icon: <Briefcase className="w-3.5 h-3.5 mr-1 text-purple-600" />,
        };
      case 'viewer':
        return {
          label: '조회 전용 (Viewer)',
          bg: 'bg-slate-100 border-slate-300 text-slate-700',
          icon: <Users className="w-3.5 h-3.5 mr-1 text-slate-500" />,
        };
      case 'sales_rep':
      default:
        return {
          label: '영업 담당',
          bg: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: <Users className="w-3.5 h-3.5 mr-1 text-blue-600" />,
        };
    }
  };

  const badgeInfo = getRoleBadge(role);

  const navItems = [
    { id: 'pipeline', label: '파이프라인 보드', icon: LayoutGrid, roleRequired: null },
    { id: 'pipeline-table', label: '파이프라인 현황', icon: ListFilter, roleRequired: null },
    { id: 'work-report', label: '영업 리포트', icon: FileText, roleRequired: null },
    { id: 'reports', label: '영업 현황', icon: BarChart3, roleRequired: null },
    { id: 'analytics', label: '팀 성과 분석', icon: TrendingUp, roleRequired: ['dept_manager', 'manager', 'admin', 'viewer'] },
    { id: 'roles', label: '역할(Role) 관리', icon: Settings, roleRequired: ['admin'] },
  ];

  const visibleNavItems = navItems.filter(item => {
    if (!item.roleRequired) return true;
    return item.roleRequired.includes(role);
  });

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* 브랜드 로고 & 제목 (링크 클릭 제거) */}
          <div className="flex items-center space-x-2.5 text-left select-none">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">ESTC Sales Pipeline</span>
              {role === 'admin' && (
                <span className="hidden sm:inline-block ml-2 text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 font-medium rounded-full border border-slate-200">
                  Supabase Auth
                </span>
              )}
            </div>
          </div>

          {/* 데스크탑 메인 네비게이션 탭 */}
          <nav className="hidden lg:flex items-center space-x-1">
            {visibleNavItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 우측 프로필 & 모바일 메뉴 토글 */}
          <div className="flex items-center space-x-2 sm:space-x-3">

            {/* 사용자 프로필 배지 */}
            <div className="flex items-center space-x-2 bg-slate-50 p-1 pl-2.5 sm:p-1.5 sm:pl-3 rounded-xl border border-slate-200">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-900">
                  {profile?.full_name || '사용자'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {profile?.email}
                </div>
              </div>

              {/* Role 배지 */}
              <div className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold border ${badgeInfo.bg}`}>
                {badgeInfo.icon}
                <span>{badgeInfo.label}</span>
              </div>
            </div>

            {/* 매뉴얼 열기 버튼 */}
            <button
              onClick={() => setIsManualOpen(true)}
              title="사용 매뉴얼"
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* 비밀번호 변경 버튼 */}
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              title="비밀번호 변경"
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* 로그아웃 버튼 */}
            <button
              onClick={signOut}
              title="로그아웃"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* 모바일 / 태블릿 메뉴 토글 버튼 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              aria-label="메뉴 열기"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>

        </div>

        {/* 모바일 / 중소형 화면 메뉴 드롭다운 */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 py-3 px-2 bg-white space-y-1">
            {visibleNavItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2.5 cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <IconComp className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* 매뉴얼 모달 */}
      <UserManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />

      {/* 비밀번호 변경 모달 */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
};
