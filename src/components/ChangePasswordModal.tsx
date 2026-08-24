/**
 * ====================================================================
 * [비밀번호 변경 모달 컴포넌트]
 * --------------------------------------------------------------------
 * - 로그인된 사용자가 자신의 비밀번호를 직접 변경합니다.
 * - Supabase auth.updateUser({ password }) API 연동
 * - 최소 6자 이상, 비밀번호 확인 일치 유효성 검증
 * ====================================================================
 */
import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Lock, Eye, EyeOff, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { isDemoMode, user, profile, updateProfile } = useAuth();

  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // 유효성 검사
    if (newPassword.length < 6) {
      setErrorMessage('새 비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      if (isSupabaseConfigured && !isDemoMode && user) {
        // Supabase Auth 비밀번호 업데이트
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          throw error;
        }
      }

      // 프로필 및 DB 비밀번호 업데이트
      if (profile) {
        await updateProfile({ password: newPassword });

        // Supabase DB profiles 테이블 업데이트
        if (isSupabaseConfigured && profile.email) {
          try {
            const cleanEmail = profile.email.trim();
            // 1) id 또는 email로 Supabase profiles 테이블의 password 컬럼 동기화
            const { error: dbUpdateErr } = await supabase
              .from('profiles')
              .update({ password: newPassword, updated_at: new Date().toISOString() })
              .or(`id.eq.${profile.id},email.ilike.${cleanEmail}`);

            if (dbUpdateErr) {
              // 2) or 필터 실패 시 email로 단독 재시도
              await supabase
                .from('profiles')
                .update({ password: newPassword, updated_at: new Date().toISOString() })
                .ilike('email', cleanEmail);
            }
          } catch (e) {
            console.warn('Supabase profile password update warning:', e);
          }
        }

        // LocalStorage 동기화
        try {
          const saved = localStorage.getItem('admin_user_profiles');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              const updatedList = parsed.map((item: any) => {
                if (item.id === profile.id || (item.email && profile.email && item.email.toLowerCase() === profile.email.toLowerCase())) {
                  return { ...item, password: newPassword };
                }
                return item;
              });
              localStorage.setItem('admin_user_profiles', JSON.stringify(updatedList));
            }
          }
        } catch (e) {}
      }

      setSuccessMessage('비밀번호가 성공적으로 변경되었습니다. 다음 로그인 시 새 비밀번호를 사용해 주세요.');

      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 2000);
    } catch (err: any) {
      console.error('Password update error:', err);
      setErrorMessage(err.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
        
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">비밀번호 변경</h3>
              <p className="text-[11px] text-slate-500">새로운 비밀번호를 설정하세요.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 메시지 알림 */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 새 비밀번호 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              새 비밀번호 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="최소 6자 이상 입력"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 새 비밀번호 확인 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              새 비밀번호 확인 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 다시 입력"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? '변경 중...' : '비밀번호 변경 저장'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
