/**
 * ====================================================================
 * [Supabase 데이터베이스 SQL 가이드 및 스키마 제공 컴포넌트]
 * --------------------------------------------------------------------
 * Supabase 대시보드의 SQL Editor에서 즉시 실행하여 'profiles' 및 'deals'
 * 테이블과 자동 회원가입 트리거(Trigger)를 생성할 수 있는 쿼리 모음입니다.
 * ====================================================================
 */
import React, { useState } from 'react';
import { Database, Copy, Check, Terminal, ExternalLink, Code2 } from 'lucide-react';

const SQL_SCHEMA = `-- ====================================================================
-- [1. 신규 설치용] Supabase profiles 테이블 생성 (4대 권한 체계 적용)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'sales_rep' CHECK (role IN ('admin', 'dept_manager', 'manager', 'sales_rep', 'viewer')),
  avatar_url TEXT,
  department TEXT DEFAULT '영업1팀',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 테이블이 이미 존재하는 경우 CHECK 제약조건 업데이트 (마이그레이션용)
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'dept_manager', 'manager', 'sales_rep', 'viewer'));

-- 2. Row Level Security (RLS) 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS 보안 정책 설정 (인증된 사용자는 프로필 읽기 및 자신의 프로필 수정 가능)
CREATE POLICY "인증된 사용자는 모든 프로필 조회 가능" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "사용자는 자신의 프로필 수정 가능" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);

-- 4. 신규 회원가입 시 auth.users 에서 profiles 테이블로 자동 데이터 복사 트리거 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '영업 담당'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'sales_rep'),
    COALESCE(NEW.raw_user_meta_data->>'department', '영업1팀')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 트리거 바인딩 (auth.users 가 생성될 때마다 자동 실행)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. 영업 딜(deals) 테이블 생성
CREATE TABLE IF NOT EXISTS public.deals (
  id TEXT PRIMARY KEY,
  deal_code TEXT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  partner_name TEXT,
  product_name TEXT,
  pc_count INT DEFAULT 0,
  server_count INT DEFAULT 0,
  competitor_product TEXT,
  amount NUMERIC DEFAULT 0,
  lead_source TEXT,
  sales_rep_id TEXT NOT NULL,
  sales_rep_name TEXT NOT NULL,
  vendor TEXT,
  deal_type TEXT,
  probability INT DEFAULT 0,
  stage TEXT NOT NULL,
  close_reason TEXT,
  received_date TEXT,
  expected_close_date TEXT NOT NULL,
  notes TEXT,
  activity_type TEXT,
  contact_person TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  history JSONB DEFAULT '[]'::jsonb
);

-- 7. deals 테이블 RLS 활성화 및 권한 정책 (조회/추가/수정/삭제 허용)
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "모든 사용자 deals 조회/변경 허용" ON public.deals;
CREATE POLICY "모든 사용자 deals 조회/변경 허용"
  ON public.deals FOR ALL
  USING (true)
  WITH CHECK (true);
`;

export const SupabaseSqlGuide: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs">
        <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold mb-1">
          <Database className="w-4 h-4" />
          <span>Supabase DB 스키마 가이드</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          'profiles' 및 'deals' 테이블 SQL
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Supabase 대시보드 (https://supabase.com/dashboard) 의 <span className="text-blue-600 font-bold">SQL Editor</span> 에서 
          아래 쿼리를 복사하여 실행하시면 <code className="text-blue-600 font-mono font-semibold">profiles</code>, <code className="text-blue-600 font-mono font-semibold">deals</code> 테이블과 필수 RLS 정책이 세팅됩니다.
        </p>
      </div>

      {/* 기존 DB 마이그레이션 SQL 박스 (총괄 매니저 role 추가용) */}
      <div className="p-6 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-purple-900 flex items-center space-x-2">
            <Database className="w-4 h-4 text-purple-600" />
            <span>[기존 DB 마이그레이션] 총괄 매니저(manager) 역할 추가 SQL</span>
          </h4>
          <button
            onClick={() => {
              const migrationSql = `ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;\nALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'dept_manager', 'manager', 'sales_rep', 'viewer'));`;
              navigator.clipboard.writeText(migrationSql);
              alert('마이그레이션 SQL이 클립보드에 복사되었습니다. Supabase SQL Editor에서 실행해주세요.');
            }}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
          >
            <Copy className="w-3 h-3" />
            <span>마이그레이션 SQL 복사</span>
          </button>
        </div>
        <p className="text-xs text-purple-800 leading-relaxed font-medium">
          이미 profiles 테이블이 생성되어 있는 경우, Supabase PostgreSQL 제약조건(Check Constraint)에 <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-900 font-bold">'manager'</code>가 등록되어 있어야 오류 없이 저장됩니다. 아래 명령어를 Supabase SQL Editor에 붙여넣고 <span className="font-bold">Run</span> 버튼을 눌러주세요:
        </p>
        <pre className="p-3.5 bg-slate-900 text-purple-200 rounded-xl text-xs font-mono overflow-x-auto">
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'dept_manager', 'manager', 'sales_rep', 'viewer'));
        </pre>
      </div>

      {/* SQL 스니펫 및 복사 버튼 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-300 font-medium">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>schema.sql (profiles & deals & triggers)</span>
          </div>
          
          <button
            onClick={handleCopy}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>복사 완료!</span>
              </>
            ) : (              <>
                <Copy className="w-3.5 h-3.5" />
                <span>SQL 복사하기</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-5 text-xs font-mono text-slate-300 bg-slate-950 overflow-x-auto leading-relaxed">
          <code>{SQL_SCHEMA}</code>
        </pre>
      </div>

      {/* 환경변수 안내 박스 */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs">
        <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-2">
          <Code2 className="w-4 h-4 text-amber-500" />
          <span>Vite / Next.js 환경변수 설정 가이드</span>
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Supabase 프로젝트 생성 후 <code className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">.env</code> 또는 배포 환경변수에 아래 URL과 ANON KEY를 등록해야 실제 DB 연동 모드로 전환됩니다.
        </p>
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 space-y-1 font-semibold">
          <div><span className="text-blue-600">VITE_SUPABASE_URL</span>=https://your-project-id.supabase.co</div>
          <div><span className="text-blue-600">VITE_SUPABASE_ANON_KEY</span>=your-anon-key-here</div>
        </div>
      </div>
    </div>
  );
};
