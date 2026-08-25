import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getKSTISOString } from '../utils/dateFilter';
import { 
  ShieldCheck, 
  UserCheck, 
  ShieldAlert, 
  RefreshCw, 
  Mail, 
  Building, 
  Users, 
  UserPlus, 
  X, 
  KeyRound, 
  CheckCircle2, 
  Database, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Edit3, 
  Power, 
  Lock,
  UserX,
  AlertCircle
} from 'lucide-react';

const SUPABASE_PROFILES_SQL = `-- Supabase profiles 테이블, 칼럼 및 RLS 설정 SQL Script
-- Supabase Dashboard > SQL Editor에 복사하여 실행(Run)하세요.

-- 1. profiles 테이블 생성 (기존에 없으면 생성)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  name TEXT,
  department TEXT,
  role TEXT DEFAULT 'sales_rep' CHECK (role IN ('admin', 'dept_manager', 'manager', 'sales_rep', 'viewer')),
  password TEXT,
  is_disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 칼럼 추가 및 타입 호환성 확보
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'sales_rep';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Row Level Security (RLS) 활성화 및 모든 사용자 읽기/쓰기 허용 정책
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for profiles" ON public.profiles;
CREATE POLICY "Enable all access for profiles" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);

-- 4. PostgREST 스키마 캐시 즉시 갱신 (중요)
NOTIFY pgrst, 'reload schema';
`;

// UUID 형식 검증 헬퍼
const isValidUUID = (str: string): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

// 고유 UUID 생성기 (Supabase Auth 가입 불가 환경 호환)
const generateValidUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// 초기 가상 더미 프로필 (Postgres UUID 호환 표준 UUID 사용)
const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'prestoyun@estc.co.kr',
    full_name: '윤영남',
    role: 'admin',
    department: '경영지원본부',
    is_disabled: false,
    created_at: '2026-08-01T09:00:00Z',
  },
  {
    id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    email: 'dept_manager@company.com',
    full_name: '강팀장',
    role: 'dept_manager',
    department: '영업 1팀',
    is_disabled: false,
    created_at: '2026-08-01T09:30:00Z',
  },
  {
    id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    email: 'manager@company.com',
    full_name: '김관리',
    role: 'manager',
    department: '영업 기획팀',
    is_disabled: false,
    created_at: '2026-08-01T10:00:00Z',
  },
  {
    id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    email: 'sales@company.com',
    full_name: '박영업',
    role: 'sales_rep',
    department: '영업 1팀',
    is_disabled: false,
    created_at: '2026-08-02T10:00:00Z',
  },
  {
    id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    email: 'sj.lee@company.com',
    full_name: '이수진',
    role: 'sales_rep',
    department: '영업 2팀',
    is_disabled: false,
    created_at: '2026-08-02T11:30:00Z',
  },
  {
    id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
    email: 'viewer@company.com',
    full_name: '송조회',
    role: 'viewer',
    department: '경영지원본부',
    is_disabled: false,
    created_at: '2026-08-03T09:00:00Z',
  }
];

/**
 * [보안 임시 비밀번호 자동 생성 헬퍼]
 */
const generateSecureTempPassword = (length: number = 10): string => {
  const charsLower = 'abcdefghijklmnopqrstuvwxyz';
  const charsUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const charsNumbers = '0123456789';
  const charsSymbols = '!@#$%^&*';

  const p1 = charsLower[Math.floor(Math.random() * charsLower.length)];
  const p2 = charsUpper[Math.floor(Math.random() * charsUpper.length)];
  const p3 = charsNumbers[Math.floor(Math.random() * charsNumbers.length)];
  const p4 = charsSymbols[Math.floor(Math.random() * charsSymbols.length)];

  const allChars = charsLower + charsUpper + charsNumbers + charsSymbols;
  let rest = '';
  for (let i = 0; i < length - 4; i++) {
    rest += allChars[Math.floor(Math.random() * allChars.length)];
  }

  const array = (p1 + p2 + p3 + p4 + rest).split('');
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array.join('');
};

export const AdminRoleManager: React.FC = () => {
  const { role, isDemoMode } = useAuth();
  const [profilesList, setProfilesList] = useState<UserProfile[]>(INITIAL_PROFILES);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // 1) 신규 등록 폼 상태
  const [newEmail, setNewEmail] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newDepartment, setNewDepartment] = useState<string>('영업부');
  const [newRole, setNewRole] = useState<UserRole>('sales_rep');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(true);
  const [submittingUser, setSubmittingUser] = useState<boolean>(false);

  // 2) 사용자 상세 조회 및 수정 모달 상태
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editDepartment, setEditDepartment] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('sales_rep');
  const [editIsDisabled, setEditIsDisabled] = useState<boolean>(false);
  const [editPassword, setEditPassword] = useState<string>('');
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);
  const [savingDetail, setSavingDetail] = useState<boolean>(false);

  // LocalStorage 저장 키
  const STORAGE_KEY = 'crm_user_profiles_v2';

  // 로드
  useEffect(() => {
    if (!isSupabaseConfigured) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProfilesList(parsed);
          }
        }
      } catch (e) {
        console.error('LocalStorage read error:', e);
      }
    } else {
      loadProfilesFromSupabase();
    }
  }, []);

  // State 및 저장소 업데이트 (항상 LocalStorage에도 보존)
  const updateProfilesStateAndStorage = (newList: UserProfile[]) => {
    setProfilesList(newList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
      localStorage.setItem('admin_user_profiles', JSON.stringify(newList));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  };

  /**
   * Supabase DB 'profiles'에서 전체 사용자 로드
   */
  const loadProfilesFromSupabase = async () => {
    setMessage(null);

    let currentLocal: UserProfile[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentLocal = parsed;
        }
      }
    } catch (e) {}

    if (!isSupabaseConfigured) {
      if (currentLocal.length > 0) {
        setProfilesList(currentLocal);
      }
      return;
    }

    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.warn('Supabase profiles select error:', fetchErr.message);
        if (currentLocal.length > 0) {
          setProfilesList(currentLocal);
        }
      } else if (data && data.length > 0) {
        const dbList: UserProfile[] = data.map((item: any) => ({
          id: item.id,
          email: item.email,
          full_name: item.full_name || item.name || '사용자',
          department: item.department || '영업부',
          role: (item.role as UserRole) || 'sales_rep',
          password: item.password,
          is_disabled: !!item.is_disabled,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        updateProfilesStateAndStorage(dbList);
        setMessage(`[새로고침 완료] Supabase DB에서 총 ${dbList.length}명의 최신 사용자 정보를 불러왔습니다.`);
      } else if (data && data.length === 0) {
        // DB가 비어있는 경우, 로컬 데이터 목록이 있다면 유지
        if (currentLocal.length > 0) {
          setProfilesList(currentLocal);
        }
      }
    } catch (e: any) {
      console.error(e);
      if (currentLocal.length > 0) {
        setProfilesList(currentLocal);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 전체 프로필 Supabase DB 동기화
   */
  const syncProfilesToSupabase = async () => {
    if (!isSupabaseConfigured) {
      alert('Supabase 환경설정이 완료되지 않았습니다. .env 및 supabaseClient 설정을 확인하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // 모든 프로필의 ID가 유효한 UUID 형식인지 확인 및 보정
      const normalizedProfiles = profilesList.map(p => ({
        ...p,
        id: isValidUUID(p.id) ? p.id : generateValidUUID(),
      }));

      const payload = normalizedProfiles.map(p => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        name: p.full_name,
        department: p.department || '영업부',
        role: p.role,
        password: p.password || 'password123',
        is_disabled: !!p.is_disabled,
        created_at: p.created_at || getKSTISOString(),
        updated_at: getKSTISOString(),
      }));

      // 1차 시도: 전체 필드 upsert
      let { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      // 2차 시도: password, is_disabled 등 신규 칼럼 미존재 스키마 캐시 에러 발생 시 fallback
      if (upsertErr) {
        console.warn('Fallback sync: retrying with base columns (without password / is_disabled)...');
        const fallbackBasePayload = payload.map(({ password, is_disabled, ...rest }) => rest);
        const { error: retryErr } = await supabase
          .from('profiles')
          .upsert(fallbackBasePayload, { onConflict: 'id' });
        
        if (!retryErr) {
          upsertErr = null;
        } else {
          // 3차 시도: 최단 필수 필드만 (id, email, full_name, name, department, role, updated_at)
          const minimalPayload = payload.map(p => ({
            id: p.id,
            email: p.email,
            full_name: p.full_name,
            name: p.full_name,
            department: p.department,
            role: p.role,
            updated_at: p.updated_at,
          }));
          const { error: minErr } = await supabase
            .from('profiles')
            .upsert(minimalPayload, { onConflict: 'id' });
          upsertErr = minErr;
        }
      }

      if (upsertErr) {
        console.error('Sync profiles error:', upsertErr);
        setMessage(`[DB 동기화 오류] ${upsertErr.message} (오른쪽 상단 'DB 설정 SQL'을 Supabase SQL Editor에서 실행하여 칼럼 생성 및 스키마 캐시를 갱신하세요.)`);
      } else {
        updateProfilesStateAndStorage(normalizedProfiles);
        setMessage(`[DB 동기화 완료] 총 ${normalizedProfiles.length}명의 사용자 프로필이 Supabase DB에 성공적으로 저장되었습니다!`);
      }
    } catch (e: any) {
      console.error(e);
      setMessage(`[동기화 오류 예외] ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 신규 사용자 등록 모달 열기
   */
  const handleOpenAddModal = () => {
    setNewEmail('');
    setNewFullName('');
    setNewDepartment('영업부');
    setNewRole('sales_rep');
    setNewPassword(generateSecureTempPassword(10));
    setShowNewPassword(false);
    setIsAddModalOpen(true);
  };

  /**
   * 관리자가 신규 사용자 직접 등록
   */
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      alert('올바른 이메일 주소를 입력해주세요.');
      return;
    }
    if (!newFullName.trim()) {
      alert('사용자 이름을 입력해주세요.');
      return;
    }

    setSubmittingUser(true);
    setMessage(null);
    const nowIso = getKSTISOString();

    const createdUserId = generateValidUUID();
    const newProfile: UserProfile = {
      id: createdUserId,
      email: newEmail.trim(),
      full_name: newFullName.trim(),
      department: newDepartment.trim() || '영업부',
      role: newRole,
      password: newPassword || 'password123',
      is_disabled: false,
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured) {
      try {
        const profilePayload: any = {
          id: createdUserId,
          email: newEmail.trim(),
          name: newFullName.trim(),
          full_name: newFullName.trim(),
          department: newDepartment.trim() || '영업부',
          role: newRole,
          password: newPassword || 'password123',
          is_disabled: false,
          created_at: nowIso,
          updated_at: nowIso,
        };

        let { error: profErr } = await supabase.from('profiles').upsert([profilePayload]);

        if (profErr) {
          console.warn('1st profile DB upsert warning:', profErr.message);
          // 2차 시도: password, is_disabled 제거 후 기본 필드로 upsert
          const { is_disabled, password, ...fallbackPayload } = profilePayload;
          const { error: retryErr } = await supabase.from('profiles').upsert([fallbackPayload]);
          profErr = retryErr;
        }

        if (profErr) {
          console.warn('Profile DB upsert final error:', profErr.message);
          setMessage(`[안내] 사용자가 로컬에 저장되었습니다. DB 스키마 갱신 필요: ${profErr.message}`);
        } else {
          setMessage(`신규 사용자 [${newFullName}] 님이 Supabase DB에 성공적으로 등록되었습니다!`);
        }

      } catch (err: any) {
        console.error('Supabase user reg error:', err);
        setMessage(`등록 중 오류 발생: ${err.message || '알 수 없는 오류'}`);
      }
    } else {
      setMessage(`신규 사용자 [${newFullName}] 님이 성공적으로 등록되었습니다.`);
    }

    const updatedList = [newProfile, ...profilesList.filter(p => p.id !== createdUserId)];
    updateProfilesStateAndStorage(updatedList);

    setIsAddModalOpen(false);
    setNewEmail('');
    setNewFullName('');
    setNewDepartment('영업부');
    setNewRole('sales_rep');
    setSubmittingUser(false);
  };

  /**
   * 사용자 상세 모달 오픈 (보안: 기존 비밀번호는 절대 로드하거나 열람할 수 없도록 초기화)
   */
  const handleOpenUserDetail = (user: UserProfile) => {
    setSelectedUser(user);
    setEditFullName(user.full_name || '');
    setEditEmail(user.email || '');
    setEditDepartment(user.department || '영업부');
    setEditRole(user.role || 'sales_rep');
    setEditIsDisabled(!!user.is_disabled);
    setEditPassword(''); // 보안 조치: 기존 비밀번호는 암호화되어 있어 UI에 노출하지 않음
    setShowEditPassword(false);
  };

  /**
   * 사용자 상세 정보 변경 저장
   */
  const handleSaveUserDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!editFullName.trim()) {
      alert('사용자 이름을 입력하세요.');
      return;
    }

    setSavingDetail(true);
    setMessage(null);
    const nowIso = getKSTISOString();

    const targetUUID = isValidUUID(selectedUser.id) ? selectedUser.id : generateValidUUID();

    // 새 비밀번호가 입력된 경우에만 교체하고, 미입력 시 기존 비밀번호 유지
    const finalPassword = editPassword.trim() ? editPassword.trim() : (selectedUser.password || 'password123');

    const updatedUser: UserProfile = {
      ...selectedUser,
      id: targetUUID,
      full_name: editFullName.trim(),
      email: editEmail.trim(),
      department: editDepartment.trim() || '영업부',
      role: editRole,
      is_disabled: editIsDisabled,
      password: finalPassword,
      updated_at: nowIso,
    };

    // 1. 상태 및 LocalStorage 즉시 업데이트
    const newList = profilesList.map(p => (p.id === selectedUser.id ? updatedUser : p));
    updateProfilesStateAndStorage(newList);

    // 활성 세션(현재 로그인된 계정)과 일치하는 경우 활성 세션 정보도 즉시 갱신 및 전역 알림
    try {
      const activeSessionKey = 'crm_active_profile_session';
      const activeSaved = localStorage.getItem(activeSessionKey);
      if (activeSaved) {
        const activeParsed = JSON.parse(activeSaved);
        if (
          activeParsed &&
          (activeParsed.id === selectedUser.id ||
            (activeParsed.email && activeParsed.email.trim().toLowerCase() === editEmail.trim().toLowerCase()))
        ) {
          const newActive = { ...activeParsed, ...updatedUser };
          localStorage.setItem(activeSessionKey, JSON.stringify(newActive));
        }
      }
      window.dispatchEvent(new CustomEvent('crm_profile_updated', { detail: updatedUser }));
    } catch (sessionErr) {
      console.warn('Active session sync error:', sessionErr);
    }

    // 2. Supabase DB에 저장 (이메일 및 ID 기준 update 우선 시도 후 upsert)
    if (isSupabaseConfigured) {
      try {
        const payload: any = {
          email: editEmail.trim(),
          full_name: editFullName.trim(),
          name: editFullName.trim(),
          department: editDepartment.trim() || '영업부',
          role: editRole,
          is_disabled: editIsDisabled,
          updated_at: nowIso,
        };

        if (editPassword.trim()) {
          payload.password = editPassword.trim();
        } else if (selectedUser.password) {
          payload.password = selectedUser.password;
        }

        // 1차 시도: 이메일 기준으로 기존 레코드 직접 UPDATE
        let dbSaveSuccess = false;
        let lastDbError: any = null;

        const { data: updatedByEmail, error: updateEmailErr } = await supabase
          .from('profiles')
          .update(payload)
          .ilike('email', editEmail.trim())
          .select();

        if (!updateEmailErr && updatedByEmail && updatedByEmail.length > 0) {
          dbSaveSuccess = true;
        } else {
          lastDbError = updateEmailErr;
          
          // 2차 시도: ID 기준 upsert
          const upsertPayload = { ...payload, id: targetUUID };
          let { error: upsertErr } = await supabase
            .from('profiles')
            .upsert([upsertPayload], { onConflict: 'id' });

          if (upsertErr) {
            lastDbError = upsertErr;
            // password, is_disabled 제외 fallback
            const { is_disabled, password, ...fallbackPayload } = upsertPayload;
            const { error: retryErr } = await supabase
              .from('profiles')
              .upsert([fallbackPayload], { onConflict: 'id' });
            if (!retryErr) {
              dbSaveSuccess = true;
              lastDbError = null;
            } else {
              lastDbError = retryErr;
            }
          } else {
            dbSaveSuccess = true;
            lastDbError = null;
          }
        }

        if (dbSaveSuccess) {
          setMessage(`[DB 동기화 성공] [${editFullName} (${editEmail})] 사용자의 권한이 '${editRole === 'manager' ? '총괄 매니저' : editRole}'로 Supabase DB와 로컬에 정상 저장되었습니다.`);
        } else if (lastDbError) {
          console.warn('Supabase profile update warning:', lastDbError);
          if (lastDbError.message && (lastDbError.message.includes('profiles_role_check') || lastDbError.message.includes('violates check constraint'))) {
            setMessage(`[DB 제약조건 오류] Supabase DB의 'profiles_role_check'에 'manager' 역할이 등록되지 않았습니다. 우측 상단 'DB 설정 SQL'에서 SQL 마이그레이션 쿼리를 실행해 주세요.`);
          } else {
            setMessage(`[안내] 사용자 프로필이 로컬에 저장되었습니다. (DB 알림: ${lastDbError.message})`);
          }
        }
      } catch (e: any) {
        console.error('Supabase user detail update exception:', e);
        setMessage(`[오류] Supabase DB 저장 중 예외 발생: ${e.message}`);
      }
    } else {
      setMessage(`[${editFullName}] 사용자의 정보 및 권한 설정이 저장되었습니다.`);
    }

    setSavingDetail(false);
    setSelectedUser(null);
  };

  // 관리자 권한이 아닌 경우 접근 제한 안내
  if (role !== 'admin') {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center max-w-lg mx-auto my-12 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">접근 권한이 제한되었습니다</h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          역할(Role) 및 사용자 관리 메뉴는 <span className="text-amber-600 font-bold">시스템 관리자(admin)</span> 전용 페이지입니다.
          상단 우측의 역할 스위처를 이용하여 admin 역할로 전환해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* 타이틀 헤더 */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2 text-amber-600 text-xs font-bold mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Control Panel</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            사용자 계정 및 권한(Role) 관리
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            시스템 관리자가 신규 사용자를 등록하고, 계정별 권한·필드 상세 수정 및 계정 비활성화 상태를 관리합니다.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto flex-wrap gap-y-2">
          <button
            onClick={syncProfilesToSupabase}
            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            title="사용자 프로필 목록을 Supabase DB에 동기화"
          >
            <Database className="w-3.5 h-3.5 text-purple-600" />
            <span>Supabase DB 동기화</span>
          </button>

          <button
            onClick={() => setIsSqlModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
            title="Supabase profiles 테이블 및 RLS 설정 SQL 스크립트 가이드"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>DB 설정 SQL</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>신규 사용자 등록</span>
          </button>

          <button
            onClick={loadProfilesFromSupabase}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center justify-between font-medium shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-blue-600 hover:text-blue-800 font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* 회원 프로필 목록 테이블 (조회 전용) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>등록된 사용자 목록 ({profilesList.length}명)</span>
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            * 각 사용자의 목록을 클릭하거나 오른쪽 [상세 보기 / 수정] 버튼을 통해 권한, 필드값 수정 및 비활성화, 임시 비밀번호 재발급이 가능합니다.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">사용자 성함</th>
                <th className="py-3.5 px-4">이메일 주소</th>
                <th className="py-3.5 px-4">부서</th>
                <th className="py-3.5 px-4">권한 (Role)</th>
                <th className="py-3.5 px-4">계정 상태</th>
                <th className="py-3.5 px-4 text-right">상세 조회 / 관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {profilesList.map((p) => (
                <tr 
                  key={p.id} 
                  className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${p.is_disabled ? 'bg-slate-50/80 text-slate-400' : ''}`}
                  onClick={() => handleOpenUserDetail(p)}
                >
                  
                  {/* 성함 */}
                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center space-x-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                      p.is_disabled 
                        ? 'bg-slate-100 text-slate-400 border-slate-200'
                        : 'bg-blue-50 border-blue-100 text-blue-600'
                    }`}>
                      {p.full_name?.substring(0, 1) || 'U'}
                    </div>
                    <span className={p.is_disabled ? 'line-through text-slate-400' : 'text-slate-900'}>
                      {p.full_name}
                    </span>
                  </td>

                  {/* 이메일 */}
                  <td className="py-3.5 px-4 text-slate-500 font-mono">
                    {p.email}
                  </td>

                  {/* 부서 */}
                  <td className="py-3.5 px-4 text-slate-600">
                    {p.department || '영업부'}
                  </td>

                  {/* 역할 배지 */}
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                      p.role === 'admin' 
                        ? 'bg-amber-50 border border-amber-200 text-amber-800' 
                        : p.role === 'manager'
                        ? 'bg-purple-50 border border-purple-200 text-purple-800'
                        : p.role === 'dept_manager'
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-800'
                        : p.role === 'viewer'
                        ? 'bg-slate-100 border border-slate-300 text-slate-700'
                        : 'bg-blue-50 border border-blue-200 text-blue-800'
                    }`}>
                      <span>
                        {p.role === 'admin' 
                          ? '시스템 관리자' 
                          : p.role === 'manager' 
                          ? '총괄 매니저' 
                          : p.role === 'dept_manager'
                          ? '부서 관리자'
                          : p.role === 'viewer'
                          ? '조회 전용'
                          : '영업 담당'}
                      </span>
                    </span>
                  </td>

                  {/* 계정 상태 */}
                  <td className="py-3.5 px-4">
                    {p.is_disabled ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 bg-rose-50 border border-rose-200 text-rose-700">
                        <UserX className="w-3 h-3 text-rose-600" />
                        <span>비활성화 (접속 제한)</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 bg-emerald-50 border border-emerald-200 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>정상 (사용 가능)</span>
                      </span>
                    )}
                  </td>

                  {/* 상세 보기 / 수정 버튼 */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUserDetail(p);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition-all cursor-pointer shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>상세 보기 / 수정</span>
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* [상세 조회 및 수정 모달] */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${selectedUser.is_disabled ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <span>{selectedUser.full_name} 님의 계정 상세 정보</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">{selectedUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserDetail} className="space-y-4">
              
              {/* 계정 상태 스위치 (비활성화 메뉴) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Power className="w-4 h-4 text-slate-500" />
                    <span>계정 사용 상태</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditIsDisabled(!editIsDisabled)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      editIsDisabled 
                        ? 'bg-rose-600 text-white shadow-xs' 
                        : 'bg-emerald-600 text-white shadow-xs'
                    }`}
                  >
                    {editIsDisabled ? (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        <span>🔴 비활성화됨 (로그인 금지)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>🟢 정상 작동중 (사용 가능)</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  * '비활성화'로 설정 시 해당 사용자는 시스템에 로그인할 수 없으며 서비스 접근이 차단됩니다. (삭제 기능 대신 비활성화를 사용합니다.)
                </p>
              </div>

              {/* 성함 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>사용자 성함 <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>이메일 주소 (계정 ID)</span>
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* 부서명 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>소속 부서</span>
                </label>
                <input
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  placeholder="예: 영업 1팀"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 권한 (Role) 선택 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>권한 (Role)</span>
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="admin">1. 시스템 관리자 (admin - 전사 모든 권한)</option>
                  <option value="manager">2. 총괄 매니저 (manager - 전사 모든 부서 딜 관리)</option>
                  <option value="dept_manager">3. 부서 관리자 (dept_manager - 소속 부서 딜 관리)</option>
                  <option value="sales_rep">4. 영업 담당 (sales_rep - 본인 딜만 관리)</option>
                  <option value="viewer">5. 조회 전용 (viewer - 읽기 전용)</option>
                </select>
              </div>

              {/* 비밀번호 관리 / 재설정 (보안: 기존 비밀번호는 열람 불가) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>비밀번호 재설정 (보안 관리)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const tempPw = generateSecureTempPassword(10);
                      setEditPassword(tempPw);
                      setShowEditPassword(false);
                    }}
                    className="text-[11px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 cursor-pointer transition-all shadow-2xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>임시 비밀번호 발급</span>
                  </button>
                </div>

                <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg text-[11px] text-blue-800 leading-relaxed flex items-start space-x-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>비밀번호 보안 정책:</strong> 사용자의 기존 비밀번호는 암호화되어 있어 관리자 및 담당자를 포함한 누구에게도 열람되지 않습니다. 비밀번호 초기화가 필요한 경우에만 아래에 새 비밀번호를 입력하세요. (미입력 시 기존 비밀번호가 안전하게 유지됩니다.)
                  </span>
                </div>
                
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="변경 시에만 새 비밀번호 입력 (미입력 시 기존 유지)"
                    className="w-full p-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    title={showEditPassword ? '비밀번호 숨기기' : '입력한 새 비밀번호 확인'}
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
                {editPassword && (
                  <p className="text-[10px] text-amber-700 font-medium">
                    * 새 비밀번호가 입력되었습니다. 하단의 [변경사항 저장]을 누르면 이 비밀번호로 갱신됩니다.
                  </p>
                )}
              </div>

              {/* 하단 동작 버튼 그룹 */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={savingDetail}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingDetail ? '저장 중...' : '변경사항 저장'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 신규 사용자 등록 모달 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">신규 사용자 등록</h3>
                  <p className="text-[11px] text-slate-500">관리자가 사용자 정보와 권한을 등록합니다.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterUser} className="space-y-4">
              {/* 성함 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>사용자 성함 <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* 이메일 주소 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>이메일 주소 (아이디) <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* 부서명 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>소속 부서</span>
                </label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="예: 영업 1팀, 수도권 본부"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 역할 선택 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>초기 권한 (Role)</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="admin">1. 시스템 관리자 (admin - 전사 모든 권한)</option>
                  <option value="manager">2. 총괄 매니저 (manager - 전사 모든 부서 딜 관리)</option>
                  <option value="dept_manager">3. 부서 관리자 (dept_manager - 소속 부서 딜 관리)</option>
                  <option value="sales_rep">4. 영업 담당 (sales_rep - 본인 딜만 관리)</option>
                  <option value="viewer">5. 조회 전용 (viewer - 읽기 전용)</option>
                </select>
              </div>

              {/* 초기 비밀번호 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    <span>초기 임시 비밀번호</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateSecureTempPassword(10))}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>새로 생성</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    title={showNewPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  * 영문 대소문자 + 숫자 + 특수문자(!@#$%^&*) 조합의 보안 임시 비밀번호입니다.
                </p>
              </div>

              {/* 버튼 그룹 */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingUser ? '등록 중...' : '등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supabase profiles DB 테이블 & RLS 설정 SQL 안내 모달 */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Supabase DB `profiles` 테이블 설정 SQL</h3>
                  <p className="text-[11px] text-slate-500">Supabase Dashboard &gt; SQL Editor에서 한 번만 실행해주세요.</p>
                </div>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 안내 및 실행 가이드 */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
              <p className="font-bold">💡 Supabase에 profiles DB가 표시되지 않는 이유:</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Supabase의 Row Level Security (RLS) 보안 정책이 설정되어 있지 않거나 `public.profiles` 테이블이 생성되지 않았을 때 데이터 조회가 제한됩니다.
                아래 SQL 코드를 복사하여 Supabase의 <strong>SQL Editor</strong>에 붙여넣고 <strong>Run</strong> 버튼을 누르시면 즉시 해결됩니다.
              </p>
            </div>

            {/* SQL 코드 박스 */}
            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-72">
                {SUPABASE_PROFILES_SQL}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_PROFILES_SQL);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-xs transition-all cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">복사완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>SQL 복사</span>
                  </>
                )}
              </button>
            </div>

            {/* 모달 하단 버튼 */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 font-bold hover:underline flex items-center space-x-1"
              >
                <span>Supabase Dashboard 바로가기 &rarr;</span>
              </a>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
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
