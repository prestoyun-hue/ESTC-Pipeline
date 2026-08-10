/**
 * ====================================================================
 * [Supabase Client 세팅]
 * --------------------------------------------------------------------
 * @supabase/supabase-js 패키지를 사용하여 Supabase 클라이언트 인스턴스를 생성합니다.
 * 
 * Vercel, Next.js, Vite 환경을 모두 지원할 수 있도록
 * 1) process.env.NEXT_PUBLIC_SUPABASE_URL (Next.js / Vercel 표준)
 * 2) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 3) import.meta.env.VITE_SUPABASE_URL (Vite 표준)
 * 4) import.meta.env.VITE_SUPABASE_ANON_KEY
 * 환경변수를 자동 탐지하여 적용합니다.
 * ====================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 1. 환경변수 추출 함수 (Next.js process.env 및 Vite import.meta.env 동시 지원)
const getEnvVar = (nextKey: string, viteKey: string): string => {
  // 1) process.env 확인 (Next.js / Node.js 환경)
  if (typeof process !== 'undefined' && process.env && process.env[nextKey]) {
    return process.env[nextKey] as string;
  }
  
  // 2) import.meta.env 확인 (Vite / 번들러 환경)
  try {
    // @ts-ignore (Vite 환경 변수 접근)
    if (import.meta && import.meta.env && import.meta.env[viteKey]) {
      // @ts-ignore
      return import.meta.env[viteKey];
    }
  } catch (e) {
    // import.meta가 없는 레거시 환경 예외 처리
  }

  return '';
};

// 2. Supabase URL 및 ANON KEY 환경변수 로드
export const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

// 3. 환경변수 설정 여부 판별
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  !supabaseUrl.includes('your-project-id')
);

// 4. 안전한 Supabase 클라이언트 생성
// 환경변수가 없거나 플레이스홀더인 경우 디버그용 수동 클라이언트 혹은 모의 클라이언트로 자동 전환됩니다.
// URL 끝에 /rest/v1 등의 경로가 포함되어 있어도 자동 제거하여 올바른 프로젝트 루트 URL 생성
const cleanSupabaseUrl = supabaseUrl ? supabaseUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') : '';
const validUrl = isSupabaseConfigured ? cleanSupabaseUrl : 'https://placeholder.supabase.co';
const validKey = isSupabaseConfigured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

/**
 * 전역 Supabase 클라이언트 인스턴스
 * 애플리케이션 어디서나 import { supabase } from '@/lib/supabaseClient' 형태로 사용할 수 있습니다.
 */
export const supabase: SupabaseClient = createClient(validUrl, validKey, {
  auth: {
    persistSession: true, // 브라우저 localStorage에 로그인 세션 자동 저장
    autoRefreshToken: true, // Access Token 자동 갱신
    detectSessionInUrl: true, // OAuth 리다이렉트 시 URL의 토큰 파싱
  },
});

/**
 * 런타임에서 Supabase 연결 상태 정보를 반환하는 헬퍼 함수
 */
export const getSupabaseConfigStatus = () => {
  return {
    isConfigured: isSupabaseConfigured,
    supabaseUrl: isSupabaseConfigured ? supabaseUrl : '설정 필요 (미설정 시 데모 모드로 작동합니다)',
    hasAnonKey: Boolean(supabaseAnonKey && !supabaseAnonKey.includes('your-anon-key')),
  };
};

export default supabase;
