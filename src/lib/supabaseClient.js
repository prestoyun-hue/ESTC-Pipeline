/**
 * ====================================================================
 * [lib/supabaseClient.js 호환 모듈]
 * TypeScript / JavaScript 환경 모두에서 lib/supabaseClient.js 경로 접근이
 * 가능하도록 re-export 하는 파일입니다.
 * ====================================================================
 */

export { 
  supabase, 
  supabaseUrl, 
  supabaseAnonKey, 
  isSupabaseConfigured, 
  getSupabaseConfigStatus,
  default 
} from './supabaseClient.ts';
