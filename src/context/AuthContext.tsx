/**
 * ====================================================================
 * [Supabase Auth 및 프로필(profiles) 전역 상태 Context]
 * --------------------------------------------------------------------
 * - Supabase Auth 세션(Session) 상태 감지 (onAuthStateChange)
 * - 로그인 성공 시 auth.users와 연동된 'profiles' 테이블에서 사용자 프로필
 *   및 역할(role: sales_rep, manager, admin) 조회 및 관리
 * - 회원가입(SignUp), 로그인(SignIn), 로그아웃(SignOut) 기능
 * - Supabase 설정 미완료 상태에서도 미리 둘러볼 수 있는 데모 모드 지원
 * ====================================================================
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { UserProfile, UserRole } from '../types';

// 미리 정의된 테스트/데모 사용자 계정 목록 (Supabase 설정 전 체험용)
export const DEMO_PROFILES: UserProfile[] = [
  {
    id: 'e5270c53-b328-4f81-8b74-123456789abc',
    email: 'prestoyun@gmail.com',
    full_name: '윤영남',
    role: 'admin',
    department: '영업 본부',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    created_at: new Date().toISOString(),
  },
  {
    id: 'f6381d64-c439-4f92-8c85-234567890bcd',
    email: 'prestoyun@estc.co.kr',
    full_name: '윤영남',
    role: 'admin',
    department: '영업 본부',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-sales-rep-01',
    email: 'rep@company.com',
    full_name: '김영업',
    role: 'sales_rep',
    department: '영업 1팀',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-sales-rep-02',
    email: 'soojin@company.com',
    full_name: '이수진',
    role: 'sales_rep',
    department: '영업 2팀',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-dept-manager-01',
    email: 'dept_manager@company.com',
    full_name: '강팀장',
    role: 'dept_manager',
    department: '영업 1팀',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-viewer-01',
    email: 'viewer@company.com',
    full_name: '송조회',
    role: 'viewer',
    department: '경영지원본부',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-manager-01',
    email: 'manager@company.com',
    full_name: '박관리',
    role: 'manager',
    department: '영업 본부',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-admin-01',
    email: 'admin@company.com',
    full_name: '최관리',
    role: 'admin',
    department: 'IT 경영지원팀',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    created_at: new Date().toISOString(),
  },
];

const MOCK_PROFILES: Record<UserRole, UserProfile> = {
  sales_rep: DEMO_PROFILES[0],
  dept_manager: DEMO_PROFILES[3],
  manager: DEMO_PROFILES[5],
  admin: DEMO_PROFILES[6],
  viewer: DEMO_PROFILES[4],
};

// 활성 로그인 세션 영속화 키
const ACTIVE_SESSION_STORAGE_KEY = 'crm_active_profile_session_v1';

/**
 * 로컬 스토리지 활성 세션 조회 헬퍼
 */
const getStoredActiveSession = (): UserProfile | null => {
  try {
    const saved = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (saved) {
      const parsed: UserProfile = JSON.parse(saved);
      if (parsed && parsed.email) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[활성 세션 로드 경고]:', e);
  }
  return null;
};

/**
 * 로컬 스토리지 활성 세션 저장/삭제 헬퍼
 */
const setStoredActiveSession = (profileToSave: UserProfile | null) => {
  try {
    if (profileToSave) {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(profileToSave));
    } else {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[활성 세션 저장 경고]:', e);
  }
};

// Auth Context 인터페이스
interface AuthContextType {
  user: User | null;                  // Supabase 인증 사용자 정보
  session: Session | null;            // Supabase Auth 세션
  profile: UserProfile | null;        // profiles 테이블에서 불러온 사용자 프로필
  role: UserRole;                     // 현재 로그인 사용자의 역할 (sales_rep | manager | admin)
  loading: boolean;                   // 세션 및 프로필 로딩 상태
  error: string | null;               // 인증 발생 에러 메시지
  isDemoMode: boolean;                // 데모 모드 작동 여부
  
  // 인증 액션 함수들
  signInWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string, 
    pass: string, 
    fullName: string, 
    role?: UserRole
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  
  // 데모 체험용 액션 함수들
  loginAsDemoUser: (demoId: string) => void;
  loginAsDemoRole: (role: UserRole) => void;
  toggleDemoMode: (enable: boolean) => void;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

// React Context 생성
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => getStoredActiveSession());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Supabase가 연동되지 않았거나 데모 계정 선택 시 데모 모드로 전환
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured);

  /**
   * 1. Supabase 'profiles' 테이블에서 특정 사용자 ID의 프로필 조회
   * ------------------------------------------------------------------
   * @param userId - auth.users 의 UUID
   */
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured) return null;

    try {
      // Supabase profiles 테이블에서 id로 프로필 정보 1건 가져오기
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchErr) {
        console.warn('[Supabase 프로필 조회 경고]:', fetchErr.message);
        
        // 만약 profiles 테이블이 없거나 데이터가 존재하지 않는 경우 기본 프로필 객체 생성 시도
        if (fetchErr.code === 'PGRST116' || fetchErr.message.includes('profiles')) {
          const defaultProfile: UserProfile = {
            id: userId,
            email: user?.email || '',
            full_name: user?.user_metadata?.full_name || '영업 담당',
            role: (user?.user_metadata?.role as UserRole) || 'sales_rep',
            created_at: new Date().toISOString(),
          };
          return defaultProfile;
        }
        return null;
      }

      if (data) {
        return {
          id: data.id,
          email: data.email || user?.email || '',
          full_name: data.full_name || data.name || user?.user_metadata?.full_name || '영업 담당',
          role: (data.role || user?.user_metadata?.role || 'sales_rep') as UserRole,
          department: data.department || '영업부',
          password: data.password,
          is_disabled: data.is_disabled,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      }
      return null;
    } catch (err: any) {
      console.error('[Supabase 프로필 조회 에러]:', err);
      return null;
    }
  };

  /**
   * 2. 컴포넌트 마운트 시 Supabase Auth 및 로컬 영속 세션 초기화
   * ------------------------------------------------------------------
   * - 페이지 새로고침 또는 브라우저 재진입 시에도 로그인 세션을 안정적으로 유지합니다.
   * - 백그라운드 토큰 만료 이벤트로 인해 프로필이 강제 로그아웃되지 않도록 보호합니다.
   */
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        setLoading(true);

        // 1) 로컬 스토리지에 저장된 활성 프로필 세션 확인
        const savedSession = getStoredActiveSession();

        // 2) Supabase Auth 세션 확인 (Supabase가 설정된 경우)
        if (isSupabaseConfigured) {
          try {
            const { data } = await supabase.auth.getSession();
            const initialSession = data?.session;

            if (initialSession?.user && isMounted) {
              setSession(initialSession);
              setUser(initialSession.user);
              setIsDemoMode(false);

              // profiles 테이블에서 최신 프로필 정보 동기화
              const userProfile = await fetchProfile(initialSession.user.id);
              if (isMounted && userProfile) {
                if (userProfile.is_disabled) {
                  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                  setStoredActiveSession(null);
                  setProfile(null);
                  setLoading(false);
                  return;
                }
                setProfile(userProfile);
                setStoredActiveSession(userProfile);
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            console.warn('[Supabase Auth 세션 확인 안내]:', e);
          }
        }

        // 3) Supabase Auth 세션이 없더라도 로컬에 저장된 활성 프로필이 있는 경우 복원
        if (savedSession && isMounted) {
          let isUserDisabled = Boolean(savedSession.is_disabled);

          // Supabase DB가 연결되어 있다면 비활성화 여부 및 최신 역할/부서 정보 갱신
          if (isSupabaseConfigured && savedSession.email) {
            try {
              const { data: dbProfiles } = await supabase
                .from('profiles')
                .select('*')
                .ilike('email', savedSession.email.trim())
                .limit(1);

              if (dbProfiles && dbProfiles.length > 0) {
                const latest = dbProfiles[0];
                if (latest.is_disabled) {
                  isUserDisabled = true;
                } else {
                  savedSession.role = latest.role || savedSession.role;
                  savedSession.department = latest.department || savedSession.department;
                  savedSession.full_name = latest.full_name || latest.name || savedSession.full_name;
                  savedSession.id = latest.id || savedSession.id;
                }
              }
            } catch (_) {}
          }

          if (isUserDisabled) {
            setStoredActiveSession(null);
            setProfile(null);
          } else {
            setProfile(savedSession);
            setIsDemoMode(true);
            setStoredActiveSession(savedSession);
          }
        } else if (!isSupabaseConfigured && isMounted) {
          // Supabase 미설정 환경 기본 데모 계정
          setProfile(MOCK_PROFILES.sales_rep);
          setStoredActiveSession(MOCK_PROFILES.sales_rep);
        }
      } catch (err: any) {
        console.warn('[초기 인증 세션 확인 완료]:', err?.message || err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Supabase Auth 세션 변화 이벤트 수신기 (로그인, 로그아웃, 토큰갱신 등)
    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!isMounted) return;

        try {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            if (newSession?.user) {
              setSession(newSession);
              setUser(newSession.user);
              setIsDemoMode(false);

              // 세션 변경 시 프로필 및 role 재조회
              const userProfile = await fetchProfile(newSession.user.id);
              if (userProfile && isMounted) {
                setProfile(userProfile);
                setStoredActiveSession(userProfile);
              }
            }
          } else if (event === 'SIGNED_OUT') {
            // [중요]: Supabase Auth SDK 내부의 토큰 갱신 타이머 만료로 인한 자동 로그아웃 방어
            // 로컬에 활성 프로필 세션(savedSession)이 존재하는 경우, Supabase Auth의 SIGNED_OUT 이벤트로
            // 사용자 프로필을 강제 해제(setProfile(null))하지 않고 프로필 세션을 지속 유지합니다.
            const currentActiveSession = getStoredActiveSession();
            if (!currentActiveSession) {
              setSession(null);
              setUser(null);
              setProfile(null);
            } else {
              setSession(null);
              setUser(null);
            }
          }
        } catch (eventErr) {
          console.warn('[Supabase Auth Event 처리 경고]:', eventErr);
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else {
      return () => {
        isMounted = false;
      };
    }
  }, []);

  /**
   * LocalStorage 또는 DEMO_PROFILES에서 이메일로 사용자 프로필 검색
   */
  const findLocalProfileByEmail = (searchEmail: string): UserProfile | null => {
    const normalizedEmail = searchEmail.trim().toLowerCase();
    const STORAGE_KEY = 'crm_user_profiles_v2';
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: UserProfile[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const found = parsed.find(p => p.email && p.email.trim().toLowerCase() === normalizedEmail);
          if (found) return found;
        }
      }
    } catch (e) {
      console.error('LocalStorage profile search error:', e);
    }

    const demoFound = DEMO_PROFILES.find(p => p.email && p.email.trim().toLowerCase() === normalizedEmail);
    if (demoFound) return demoFound;

    return null;
  };

  /**
   * 3. 이메일/비밀번호 로그인 처리
   * ------------------------------------------------------------------
   * - 파라미터 정제 및 엄격한 유효성 검사 적용
   * - 불필요한 token?grant_type=password 400 Bad Request 호출 방지
   * - 에러 발생 시 무한 재시도 없이 명확한 피드백 반환
   */
  const signInWithEmail = async (email: string, pass: string) => {
    setError(null);
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (pass || '').trim();

    // 1. 필수 파라미터 및 이메일 형식 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      const errMsg = '올바른 이메일 주소 형식을 입력해 주세요.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }

    if (!cleanPass || cleanPass.length < 6) {
      const errMsg = '비밀번호는 최소 6자 이상이어야 합니다.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }

    setLoading(true);

    try {
      let matchedProfile: UserProfile | null = null;

      // 2. Supabase DB가 설정되어 있으면 profiles 테이블에서 사용자 조회
      if (isSupabaseConfigured) {
        try {
          const { data: dbData } = await supabase
            .from('profiles')
            .select('*')
            .ilike('email', cleanEmail)
            .limit(1);

          if (dbData && dbData.length > 0) {
            const item = dbData[0];
            matchedProfile = {
              id: item.id,
              email: item.email,
              full_name: item.full_name || item.name || cleanEmail.split('@')[0],
              role: item.role || 'sales_rep',
              department: item.department || '영업부',
              password: item.password,
              is_disabled: Boolean(item.is_disabled),
              created_at: item.created_at,
            };
          }
        } catch (e) {
          console.warn('DB profile fetch error:', e);
        }
      }

      // Supabase DB에 없거나 미설정 시 LocalStorage에서 검색
      if (!matchedProfile) {
        matchedProfile = findLocalProfileByEmail(cleanEmail);
      }

      // 비활성화 계정 로그인 차단 검사
      if (matchedProfile && matchedProfile.is_disabled) {
        setLoading(false);
        const errMsg = '해당 계정은 비활성화 처리되어 로그인할 수 없습니다. 관리자에게 문의하세요.';
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      // 3. DB profiles 테이블 또는 로컬 계정 검증
      // (profiles 테이블 기반 계정은 Supabase Auth auth.users에 등록되어 있지 않으므로
      //  불필요한 signInWithPassword 400 Bad Request 호출을 방지하고 안전하게 검증합니다.)
      if (matchedProfile) {
        const profilePass = matchedProfile.password;
        
        // 1) 비밀번호가 아직 설정되지 않았거나 기본값인 경우: 사용자가 입력한 비밀번호(6자 이상)를 유효하게 인정하고 저장
        const isUnsetOrDefault = !profilePass || profilePass === 'password123' || profilePass === '';
        
        // 2) 커스텀 비밀번호가 설정된 경우: 해당 비밀번호 또는 마스터 초기화 비밀번호(password123)와 일치하는지 확인
        const isCustomMatch = profilePass && (cleanPass === profilePass || cleanPass === 'password123');

        if (isUnsetOrDefault || isCustomMatch) {
          const updatedProfile: UserProfile = {
            ...matchedProfile,
            password: cleanPass,
          };

          // DB 및 로컬 스토리지에 비밀번호 동기화 (다음 로그인 시 보안 검증용)
          if (isSupabaseConfigured && matchedProfile.email) {
            (async () => {
              try {
                const targetEmail = matchedProfile.email.trim();
                const { error: syncErr } = await supabase
                  .from('profiles')
                  .update({ password: cleanPass, updated_at: new Date().toISOString() })
                  .or(`id.eq.${matchedProfile.id},email.ilike.${targetEmail}`);

                if (syncErr) {
                  await supabase
                    .from('profiles')
                    .update({ password: cleanPass, updated_at: new Date().toISOString() })
                    .ilike('email', targetEmail);
                }
              } catch (err: any) {
                console.warn('[비밀번호 DB 갱신 안내]:', err?.message);
              }
            })();
          }

          setProfile(updatedProfile);
          setStoredActiveSession(updatedProfile);
          setIsDemoMode(true);
          setUser(null);
          setSession(null);
          setLoading(false);
          return { success: true };
        } else {
          // 비밀번호가 설정되어 있으나 입력값과 불일치하는 경우
          setLoading(false);
          const errMsg = '비밀번호가 올바르지 않습니다. 다시 확인해 주세요.';
          setError(errMsg);
          return { success: false, error: errMsg };
        }
      }

      // 4. Supabase Auth (auth.users) 연동 계정 로그인 시도 (profiles에 없는 신규 Auth 사용자)
      if (isSupabaseConfigured && !isDemoMode) {
        try {
          const { data, error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPass,
          });

          if (!authError && data?.user) {
            setUser(data.user);
            setSession(data.session);

            let userProfile = await fetchProfile(data.user.id);

            if (!userProfile) {
              userProfile = {
                id: data.user.id,
                email: data.user.email || cleanEmail,
                full_name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
                role: (data.user.user_metadata?.role as UserRole) || 'sales_rep',
                department: '영업부',
                created_at: new Date().toISOString(),
              };
            }

            if (userProfile?.is_disabled) {
              await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
              setStoredActiveSession(null);
              setUser(null);
              setSession(null);
              setLoading(false);
              const errMsg = '해당 계정은 비활성화 처리되어 로그인할 수 없습니다. 관리자에게 문의하세요.';
              setError(errMsg);
              return { success: false, error: errMsg };
            }

            setProfile(userProfile);
            setStoredActiveSession(userProfile);
            setIsDemoMode(false);
            setLoading(false);
            return { success: true };
          }
        } catch (authReqErr: any) {
          console.warn('[Supabase Auth 요청 처리]:', authReqErr?.message);
        }
      }

      // 5. 로그인 실패 처리 (등록되지 않은 계정)
      setLoading(false);
      const errMsg = '등록되지 않은 이메일이거나 비밀번호가 올바르지 않습니다.';
      setError(errMsg);
      return { success: false, error: errMsg };

    } catch (err: any) {
      setLoading(false);
      const errMsg = err?.message || '로그인 처리 중 오류가 발생했습니다.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  /**
   * 4. 이메일/비밀번호 회원가입 처리
   * ------------------------------------------------------------------
   * 1) Supabase auth.signUp 호출 (user_metadata에 full_name과 role 담기)
   * 2) 회원가입 성공 후 'profiles' 테이블에 신규 프로필 행 생성 (upsert)
   */
  const signUpWithEmail = async (
    email: string, 
    pass: string, 
    fullName: string, 
    role: UserRole = 'sales_rep'
  ) => {
    setError(null);

    // 데모 모드인 경우
    if (isDemoMode || !isSupabaseConfigured) {
      const newDemoProfile: UserProfile = {
        id: `demo-${Date.now()}`,
        email,
        full_name: fullName,
        role,
        department: role === 'admin' ? '경영지원' : role === 'manager' ? '영업관리' : '영업1팀',
        created_at: new Date().toISOString(),
      };
      setProfile(newDemoProfile);
      setStoredActiveSession(newDemoProfile);
      return { success: true };
    }

    try {
      setLoading(true);

      // Supabase 회원가입 API 호출 (메타데이터 포함)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: {
            full_name: fullName,
            role: role,
          }
        }
      });

      if (signUpError) {
        setError(`회원가입 실패: ${signUpError.message}`);
        setLoading(false);
        return { success: false, error: signUpError.message };
      }

      if (data.user) {
        // 'profiles' 테이블에 사용자 역할(role)과 함께 프로필 행 저장
        const newProfile: UserProfile = {
          id: data.user.id,
          email: email,
          full_name: fullName,
          role: role,
          department: role === 'admin' ? '경영진/IT' : role === 'manager' ? '영업관리팀' : '영업1팀',
          created_at: new Date().toISOString(),
        };

        // Supabase profiles 테이블에 저장 (upsert)
        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert([newProfile]);

        if (profileErr) {
          console.warn('[profiles 테이블 저장 경고]:', profileErr.message);
          // RLS 규칙이나 테이블 미생성 시에도 Auth 메타데이터 프로필은 유지
        }

        setProfile(newProfile);
        setStoredActiveSession(newProfile);
        setUser(data.user);
        setSession(data.session);

        setLoading(false);
        return { success: true };
      }

      setLoading(false);
      return { success: false, error: '회원가입 처리에 실패했습니다.' };
    } catch (err: any) {
      const errMsg = err.message || '회원가입 중 에러가 발생했습니다.';
      setError(errMsg);
      setLoading(false);
      return { success: false, error: errMsg };
    }
  };

  /**
   * 5. 로그아웃 처리
   * ------------------------------------------------------------------
   * Supabase auth.signOut() 호출 및 상태 초기화
   */
  const signOut = async () => {
    try {
      setLoading(true);
      setStoredActiveSession(null);
      if (isSupabaseConfigured) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    } catch (err) {
      console.error('[로그아웃 에러]:', err);
    } finally {
      setStoredActiveSession(null);
      setUser(null);
      setSession(null);
      setProfile(null);
      setError(null);
      setLoading(false);
    }
  };

  /**
   * 6. 사용자 프로필 업데이트 (이름, 부서 등)
   */
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return { success: false, error: '로그인되어 있지 않습니다.' };

    try {
      const updated = { ...profile, ...updates, updated_at: new Date().toISOString() };
      
      if (isSupabaseConfigured && profile.email) {
        try {
          const targetEmail = profile.email.trim();
          await supabase
            .from('profiles')
            .update(updates)
            .or(`id.eq.${profile.id},email.ilike.${targetEmail}`);
        } catch (e) {
          console.warn('updateProfile DB sync notice:', e);
        }
      }

      setProfile(updated);
      setStoredActiveSession(updated);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  /**
   * 7. 데모 사용자 ID로 즉시 로그인
   */
  const loginAsDemoUser = (demoId: string) => {
    const found = DEMO_PROFILES.find(p => p.id === demoId) || DEMO_PROFILES[0];
    setIsDemoMode(true);
    setProfile(found);
    setStoredActiveSession(found);
    setUser(null);
    setSession(null);
    setError(null);
    setLoading(false);
  };

  /**
   * 데모 사용자 역할 즉시 전환 (영업사원 / 매니저 / 관리자 테스트용)
   */
  const loginAsDemoRole = (targetRole: UserRole) => {
    setIsDemoMode(true);
    const p = MOCK_PROFILES[targetRole];
    setProfile(p);
    setStoredActiveSession(p);
    setUser(null);
    setSession(null);
    setError(null);
    setLoading(false);
  };

  /**
   * 8. 데모 모드 토글
   */
  const toggleDemoMode = (enable: boolean) => {
    setIsDemoMode(enable);
    if (enable) {
      setProfile(MOCK_PROFILES.sales_rep);
      setStoredActiveSession(MOCK_PROFILES.sales_rep);
    } else {
      setStoredActiveSession(null);
      setProfile(null);
      if (user) {
        fetchProfile(user.id).then((p) => {
          if (p) {
            setProfile(p);
            setStoredActiveSession(p);
          }
        });
      }
    }
  };

  /**
   * 9. 프로필 수동 새로고침
   */
  const refreshProfile = async () => {
    if (user && isSupabaseConfigured) {
      const p = await fetchProfile(user.id);
      if (p) setProfile(p);
    }
  };

  const clearError = () => setError(null);

  // 현재 사용자의 최종 role (기본값: sales_rep)
  const role: UserRole = profile?.role || 'sales_rep';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        error,
        isDemoMode,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateProfile,
        loginAsDemoUser,
        loginAsDemoRole,
        toggleDemoMode,
        clearError,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook: Auth Context 사용을 위한 useAuth 훅
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 안에서만 사용되어야 합니다.');
  }
  return context;
};
