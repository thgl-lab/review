const fs = require("fs");

const kakaoKey = process.env.KAKAO_REST_API_KEY || "";
const googleKey = process.env.GOOGLE_PLACES_API_KEY || "";
const geminiKey = process.env.GEMINI_API_KEY || "";
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";

fs.writeFileSync(
  "config.js",
  `/* Vercel 빌드 시 환경 변수로부터 자동 생성된 파일입니다. */\nconst KAKAO_REST_API_KEY = ${JSON.stringify(kakaoKey)};\nconst GOOGLE_PLACES_API_KEY = ${JSON.stringify(googleKey)};\nconst GEMINI_API_KEY = ${JSON.stringify(geminiKey)};\nconst SUPABASE_URL = ${JSON.stringify(supabaseUrl)};\nconst SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(supabasePublishableKey)};\n`
);

console.log(kakaoKey ? "config.js: KAKAO_REST_API_KEY set." : "config.js: KAKAO_REST_API_KEY NOT set (env var missing).");
console.log(googleKey ? "config.js: GOOGLE_PLACES_API_KEY set." : "config.js: GOOGLE_PLACES_API_KEY NOT set (env var missing).");
console.log(geminiKey ? "config.js: GEMINI_API_KEY set." : "config.js: GEMINI_API_KEY NOT set (env var missing).");
console.log(supabaseUrl ? "config.js: SUPABASE_URL set." : "config.js: SUPABASE_URL NOT set (env var missing).");
console.log(supabasePublishableKey ? "config.js: SUPABASE_PUBLISHABLE_KEY set." : "config.js: SUPABASE_PUBLISHABLE_KEY NOT set (env var missing).");
