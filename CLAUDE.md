# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**여기찜 (YeogiJjim)** — a personal restaurant archive service. Users save restaurants discovered on Instagram/etc. and tag each one with a "situation" (혼밥/카공/데이트/가족모임/친구모임/회식·술자리/기념일/비즈니스), then filter/search by that tag later. Full product spec is in `PRD_YeogiJjim.md`; visual direction is in `DESIGN_YeogiJjim.md`. Read both before making product or design decisions — they are the source of truth, not this file.

## Current state

This repo currently contains only a static landing page (`index.html`) plus the two planning docs. There is no build system, package manager, or test suite — `index.html` is a self-contained file with inline `<style>`/`<script>`. Open it directly in a browser to preview; no server or build step is needed.

The planned product (per PRD section 9) will eventually use Supabase (auth + data), Gemini API (review summarization / tag suggestion), and JSON-based data with map-link parsing (Naver Map / Kakao Map) — none of that is implemented yet.

## Design system (from DESIGN_YeogiJjim.md)

Apply these consistently to any new UI:

- **Mood**: warm & cozy, minimal layout (generous whitespace), rounded corners on cards/buttons/tags (moderate radius, not full pill)
- **Colors** (max 4, no pure black/gray): cream `#FEEAC9` (background), pink `#FDACAC` (cards/secondary), coral-red `#FD7979` (buttons/tags/accent), warm-gray `#4A3F3B` (text)
- **Fonts**: a rounded display font for headings/logo, a clean sans for body text — see below for what's actually wired up in `index.html`

### Font loading (noonnu.cc fonts)

Fonts sourced from noonnu.cc are loaded via jsDelivr `@font-face` (no npm package). Two things to check before swapping fonts:

1. **License restrictions vary per font** — some noonnu.cc fonts explicitly prohibit web embedding/CDN use even though they're "free for commercial use" (e.g. 메모먼트 꾹꾹체 was rejected for this reason). Always fetch the noonnu.cc font page and confirm web-embedding is allowed before adding a new `@font-face`.
2. **Verify the CDN URL actually resolves** (`curl -o /dev/null -w "%{http_code}"`) before wiring it in — some jsDelivr paths for a given font/version 404.

Currently used:
- Logo/"여기찜" wordmark only: `HakgyoansimDunggeunmiso` (학교안심 둥근미소, KERIS, OFL) via `cdn.jsdelivr.net/gh/projectnoonnu/2408-5@1.0/`
- Other headings: `MitmiFont` (밑미, noonnu font_page/1335) via `cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2402_1@1.0/`
- Body text: `Wanted Sans Variable` via `cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.1/`

## 반응형
- 모바일 (375)
- 태블릿 (768)
- 데스크톱 (1440)
으로 브레이크포인트 설정
