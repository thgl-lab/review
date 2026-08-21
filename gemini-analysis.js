/* ============================================================
 * 여기찜 — AI 리뷰 분석 (Gemini API)
 * ============================================================
 * ⚠️ API 키 설정 안내
 * GEMINI_API_KEY는 이 파일이 아니라 config.js에 둡니다.
 * config.example.js를 참고해 https://aistudio.google.com/apikey 에서
 * 발급받은 키를 채워 넣으세요. (브라우저에 그대로 노출되는 키입니다)
 * ============================================================ */

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_ANALYSIS_CACHE_KEY = "yeogijjim_gemini_analysis_cache";

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sentiment: {
      type: "OBJECT",
      properties: {
        positive: { type: "INTEGER" },
        neutral: { type: "INTEGER" },
        negative: { type: "INTEGER" },
      },
      required: ["positive", "neutral", "negative"],
    },
    keywords: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          score: { type: "INTEGER" },
          context: { type: "STRING", enum: ["positive", "negative"] },
        },
        required: ["word", "score", "context"],
      },
    },
    summary: { type: "STRING" },
  },
  required: ["sentiment", "keywords", "summary"],
};

function hasValidGeminiApiKey() {
  return (
    typeof GEMINI_API_KEY !== "undefined" &&
    GEMINI_API_KEY &&
    GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE"
  );
}

/* ---------- 캐시 (localStorage) ---------- */
function getCachedAnalysis(placeId) {
  const cache = JSON.parse(localStorage.getItem(GEMINI_ANALYSIS_CACHE_KEY) || "{}");
  return cache[placeId] || null;
}

function setCachedAnalysis(placeId, data) {
  const cache = JSON.parse(localStorage.getItem(GEMINI_ANALYSIS_CACHE_KEY) || "{}");
  cache[placeId] = data;
  localStorage.setItem(GEMINI_ANALYSIS_CACHE_KEY, JSON.stringify(cache));
}

/* ---------- Gemini 호출 ---------- */
function buildGeminiPrompt(placeName, reviews) {
  const reviewLines = reviews
    .map((r, i) => `${i + 1}. [별점 ${r.rating}] ${r.text?.trim() || "(내용 없음)"}`)
    .join("\n");

  return `너는 맛집 리뷰 분석가야. "${placeName}"라는 가게의 구글 리뷰 ${reviews.length}개를 분석해서 아래 3가지를 JSON으로만 정리해줘.

[리뷰 목록]
${reviewLines}

[분석 지침]
1. sentiment: 리뷰 각각을 긍정/보통/부정으로 분류하고 각각 몇 개인지 개수를 센다. 세 개수의 합은 반드시 리뷰 총 개수(${reviews.length})와 같아야 한다.
2. keywords: 리뷰에 자주 등장하는 핵심 단어를 8~15개 뽑는다. 음식 이름, 맛, 분위기, 서비스 관련 단어 위주로 뽑고, 각 단어마다 이 가게를 판단하는 데 얼마나 중요한지 1~10점으로 점수를 매기고, 그 단어가 주로 긍정적 맥락에서 쓰였는지(positive) 부정적 맥락에서 쓰였는지(negative) 표시한다.
3. summary: 이 가게의 리뷰 전체를 한 문장으로 자연스럽게 한국어로 요약한다.

반드시 지정된 JSON 스키마 형식으로만 응답해.`;
}

async function fetchGeminiAnalysis(placeName, reviews) {
  if (!hasValidGeminiApiKey()) {
    return { status: "error", message: "제미나이 API 키가 설정되지 않았어요. config.js에 GEMINI_API_KEY를 채워주세요." };
  }

  let res;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildGeminiPrompt(placeName, reviews) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      }),
    });
  } catch (err) {
    console.error(err);
    return { status: "error", message: "네트워크 오류로 AI 분석에 실패했어요." };
  }

  if (!res.ok) {
    return { status: "error", message: `AI 분석 중 오류가 발생했어요. (HTTP ${res.status})` };
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { status: "error", message: "AI 응답을 해석하지 못했어요." };
  }

  try {
    const parsed = JSON.parse(text);
    return { status: "ok", data: parsed };
  } catch (err) {
    console.error(err);
    return { status: "error", message: "AI 응답 형식이 올바르지 않아요." };
  }
}

/* ---------- 렌더링 ---------- */
async function runAiAnalysis(panel, place, reviews) {
  const container = panel.querySelector(".ai-analysis");
  if (!container || !reviews.length) return;

  const cached = getCachedAnalysis(place.id);
  if (cached) {
    renderAiAnalysis(container, cached);
    return;
  }

  container.innerHTML = `<p class="ai-loading">AI가 리뷰를 분석하는 중...</p>`;
  const result = await fetchGeminiAnalysis(place.place_name, reviews);

  if (result.status !== "ok") {
    container.innerHTML = `<p class="ai-error">${escapeHtml(result.message)}</p>`;
    return;
  }

  setCachedAnalysis(place.id, result.data);
  renderAiAnalysis(container, result.data);
}

function renderAiAnalysis(container, data) {
  const { positive = 0, neutral = 0, negative = 0 } = data.sentiment || {};
  const total = positive + neutral + negative || 1;
  const pct = (n) => (n / total) * 100;

  container.innerHTML = `
    <h5 class="ai-section-title">AI 리뷰 분석</h5>
    <div class="sentiment-bar" role="img" aria-label="긍정 ${positive}, 보통 ${neutral}, 부정 ${negative}">
      ${positive ? `<span class="sentiment-segment positive" style="width:${pct(positive)}%"></span>` : ""}
      ${neutral ? `<span class="sentiment-segment neutral" style="width:${pct(neutral)}%"></span>` : ""}
      ${negative ? `<span class="sentiment-segment negative" style="width:${pct(negative)}%"></span>` : ""}
    </div>
    <div class="sentiment-legend">
      <span class="legend-item"><i class="legend-dot positive"></i>긍정 ${positive}</span>
      <span class="legend-item"><i class="legend-dot neutral"></i>보통 ${neutral}</span>
      <span class="legend-item"><i class="legend-dot negative"></i>부정 ${negative}</span>
    </div>
    <div class="wordcloud-wrap"><canvas class="wordcloud-canvas"></canvas></div>
    <div class="ai-summary-bubble">${escapeHtml(data.summary || "")}</div>
  `;

  renderWordCloud(container.querySelector(".wordcloud-canvas"), data.keywords || []);
}

function renderWordCloud(canvas, keywords) {
  if (!canvas || !keywords.length) {
    if (canvas) canvas.closest(".wordcloud-wrap").hidden = true;
    return;
  }

  if (typeof WordCloud !== "function" || !WordCloud.isSupported) {
    renderWordCloudFallback(canvas, keywords);
    return;
  }

  const wrap = canvas.parentElement;
  const width = wrap.clientWidth || 280;
  const height = 200;
  canvas.width = width;
  canvas.height = height;

  const contextByWord = new Map(keywords.map((k) => [k.word, k.context]));

  WordCloud(canvas, {
    list: keywords.map((k) => [k.word, k.score]),
    weightFactor: (size) => Math.max(14, size * 6.5),
    fontFamily: "'Wanted Sans Variable', sans-serif",
    fontWeight: "700",
    color: (word) => (contextByWord.get(word) === "negative" ? "#e0554f" : "#3f9e5c"),
    backgroundColor: "#FEEAC9",
    gridSize: 8,
    rotateRatio: 0,
    shuffle: true,
    shape: "circle",
  });
}

function renderWordCloudFallback(canvas, keywords) {
  const wrap = canvas.parentElement;
  const maxScore = Math.max(...keywords.map((k) => k.score), 1);
  wrap.innerHTML = `<div class="wordcloud-fallback">${keywords
    .map((k) => {
      const size = 12 + (k.score / maxScore) * 14;
      const color = k.context === "negative" ? "#e0554f" : "#3f9e5c";
      return `<span class="wordcloud-tag" style="font-size:${size}px;color:${color}">${escapeHtml(k.word)}</span>`;
    })
    .join("")}</div>`;
}
