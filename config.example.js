/* ============================================================
 * config.js 만드는 법
 * ============================================================
 * 이 파일을 복사해서 같은 폴더에 "config.js"로 저장한 뒤,
 * 아래 값을 카카오 디벨로퍼스에서 발급받은 REST API 키로 바꾸세요.
 *
 *   1) https://developers.kakao.com 접속 후 로그인
 *   2) 내 애플리케이션 > 애플리케이션 추가
 *   3) 앱 선택 > 요약 정보 > "REST API 키" 복사
 *   4) 아래 큰따옴표 안에 붙여넣고 config.js로 저장
 *   5) (선택) 플랫폼 설정 > Web > 사이트 도메인에 이 페이지를 여는
 *      주소(예: http://localhost:xxxx)를 등록
 *
 * 구글 리뷰 기능을 쓰려면 GOOGLE_PLACES_API_KEY도 채워야 합니다.
 *   1) https://console.cloud.google.com 접속 후 프로젝트 생성/선택
 *   2) API 및 서비스 > 라이브러리 > "Places API (New)" 사용 설정
 *   3) API 및 서비스 > 사용자 인증 정보 > API 키 발급
 *   4) 발급된 키는 브라우저에 그대로 노출되므로, 키 제한 > HTTP 리퍼러
 *      (웹사이트)에 이 페이지를 여는 도메인을 반드시 등록하세요
 *
 * AI 리뷰 분석 기능을 쓰려면 GEMINI_API_KEY도 채워야 합니다.
 *   1) https://aistudio.google.com/apikey 에서 API 키 발급
 *   2) 이 키도 브라우저에 그대로 노출되니, 가능하면 별도 프로젝트로
 *      발급하고 사용량 알림을 걸어두는 걸 권장합니다
 *
 * config.js는 .gitignore에 등록되어 있어 git에 커밋되지 않습니다.
 * 이 예시 파일(config.example.js)에는 실제 키를 넣지 마세요.
 * ============================================================ */
const KAKAO_REST_API_KEY = "YOUR_KAKAO_REST_API_KEY_HERE";
const GOOGLE_PLACES_API_KEY = "YOUR_GOOGLE_PLACES_API_KEY_HERE";
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
