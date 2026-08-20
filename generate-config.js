const fs = require("fs");

const key = process.env.KAKAO_REST_API_KEY || "";

fs.writeFileSync(
  "config.js",
  `/* Vercel 빌드 시 KAKAO_REST_API_KEY 환경 변수로부터 자동 생성된 파일입니다. */\nconst KAKAO_REST_API_KEY = ${JSON.stringify(key)};\n`
);

console.log(key ? "config.js generated with API key." : "config.js generated WITHOUT an API key (KAKAO_REST_API_KEY env var not set).");
