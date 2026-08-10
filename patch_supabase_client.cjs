const fs = require('fs');

let content = fs.readFileSync('src/lib/supabaseClient.ts', 'utf8');

// Replace raw URL extraction with sanitization
content = content.replace(
  "const validUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';",
  `// URL 끝에 /rest/v1 등의 경로가 포함되어 있어도 자동 제거하여 올바른 프로젝트 루트 URL 생성
const cleanSupabaseUrl = supabaseUrl ? supabaseUrl.trim().replace(/\\/rest\\/v1\\/?$/, '').replace(/\\/+$/, '') : '';
const validUrl = isSupabaseConfigured ? cleanSupabaseUrl : 'https://placeholder.supabase.co';`
);

fs.writeFileSync('src/lib/supabaseClient.ts', content);
console.log('Successfully updated supabaseClient.ts');
