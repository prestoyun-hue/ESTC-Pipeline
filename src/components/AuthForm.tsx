/**
 * ====================================================================
 * [로그인 / 회원가입 UI 컴포넌트]
 * --------------------------------------------------------------------
 * - Tailwind CSS 스타일링이 적용된 반응형 로그인 및 회원가입 폼
 * - 탭 전환 (로그인 / 회원가입)
 * - 회원가입 시 사용자 역할(role: 영업사원, 매니저, 관리자) 선택 지원
 * - Supabase Auth API 연동 및 성공 시 세션 유지 & profiles 테이블 저장
 * - 빠른 데모 계정 체험 버튼 (영업사원 / 매니저 / 관리자)
 * - 코드 내 상세 한글 주석 포함
 * ====================================================================
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Lock, 
  Mail, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';

export const AuthForm: React.FC = () => {
  // Auth Context에서 인증 함수와 상태 가져오기
  const { 
    signInWithEmail, 
    loading, 
    error, 
    clearError,
  } = useAuth();

  // 1. 입력 폼 필드 상태
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // 2. UI 피드백 상태 (성공 메시지, 에러)
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * 폼 유효성 검사 함수
   */
  const validateForm = (): boolean => {
    setFormError(null);

    if (!email || !email.includes('@')) {
      setFormError('올바른 이메일 주소를 입력해 주세요.');
      return false;
    }

    if (!password || password.length < 6) {
      setFormError('비밀번호는 최소 6자 이상이어야 합니다.');
      return false;
    }

    return true;
  };

  /**
   * 폼 제출 이벤트 핸들러 (로그인)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormError(null);
    setSuccessMessage(null);

    const result = await signInWithEmail(email, password);
    if (result.success) {
      setSuccessMessage('로그인에 성공하였습니다.');
    } else if (result.error) {
      setFormError(result.error);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-8 px-4">
      {/* 메인 카드 컨테이너 (세련된 음영 및 반투명 테두리) */}
      <div className="bg-white/95 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl overflow-hidden text-slate-900 ring-1 ring-black/5">
        
        {/* 카드 헤더 */}
        <div className="p-8 border-b border-slate-100 text-center relative bg-gradient-to-b from-slate-50/70 to-white">
          <div className="inline-flex p-3 rounded-xl bg-blue-600 text-white mb-4 shadow-sm">
            <Briefcase className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            ESTC Sales Pipeline
          </h2>
        </div>

        {/* 폼 영역 */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          
          {/* 피드백 에러 메시지 */}
          {(formError || error) && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <span className="font-medium">{formError || error}</span>
            </div>
          )}

          {/* 피드백 성공 메시지 */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* 이메일 입력 필드 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              이메일 주소 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sales@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          {/* 비밀번호 입력 필드 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              비밀번호 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                title={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPassword ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>로그인하기</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
