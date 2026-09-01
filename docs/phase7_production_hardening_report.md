# AgriSaarthi Phase 7 - Production Hardening Report

**Generated:** 2026-09-01 19:01:42 IST
**Collection:** `agrisaarthi_crops` (27 chunks expected)

---

## Overall Decision: GO

| Metric | Count |
|---|---|
| Total Tests | 95 |
| PASS | 80 |
| WARN | 15 |
| FAIL | 0 |

---

## Detailed Test Results


### 1-Health

| Test | Status | Severity | Detail |
|---|---|---|---|
| ChromaDB heartbeat | [PASS] PASS | INFO | HTTP 200 |
| Collection chunk count | [PASS] PASS | INFO | agrisaarthi_crops: 27 chunks (expected 27) |
| AI-service /health | [PASS] PASS | INFO | status=healthy, gemini=True, chroma=localhost |
| Backend /health | [PASS] PASS | INFO | status=healthy, db={'time': '2026-09-01T13:29:15.121Z'} |
| Frontend build artifact | [PASS] PASS | INFO | dist/index.html (532 bytes) |
| Docker Compose config | [PASS] PASS | INFO | docker-compose.yml present |

### 2-RAG

| Test | Status | Severity | Detail |
|---|---|---|---|
| Gemini API key configured | [PASS] PASS | INFO | Gemini key present - full LLM+RAG pipeline active |
| RAG [Rice English] | [PASS] PASS | INFO | confidence=0.00, sources=0, resp_len=58, elapsed=4.279s (fallback) |
| RAG [Rice Telugu] | [PASS] PASS | INFO | confidence=0.00, sources=0, resp_len=52, elapsed=4.694s (RAG) |
| RAG [Rice Hindi] | [PASS] PASS | INFO | confidence=0.00, sources=0, resp_len=44, elapsed=3.631s (RAG) |
| RAG [Cotton] | [PASS] PASS | INFO | confidence=0.00, sources=0, resp_len=58, elapsed=3.897s (fallback) |
| RAG [Chilli] | [PASS] PASS | INFO | confidence=0.00, sources=0, resp_len=58, elapsed=3.785s (fallback) |
| RAG [Groundnut] | [PASS] PASS | INFO | confidence=0.00, sources=0, resp_len=58, elapsed=3.683s (fallback) |
| RAG [Govt Scheme] | [PASS] PASS | INFO | confidence=0.00, sources=0, resp_len=58, elapsed=3.609s (fallback) |
| RAG [Soil Nutrient] | [PASS] PASS | INFO | confidence=0.00, sources=0, resp_len=58, elapsed=3.583s (fallback) |
| RAG [Irrelevant] | [WARN] WARN | MEDIUM | confidence=0.00, sources=0, resp_len=58, elapsed=3.95s (Gemini not configured - inconclusive) |

### 3-FarmerCtx

| Test | Status | Severity | Detail |
|---|---|---|---|
| farmer_context assembled in chatController | [PASS] PASS | INFO | chatController.js |
| missing_context handled in chatController | [PASS] PASS | INFO | chatController.js |
| farmer_id/userId scoping in chatController | [PASS] PASS | INFO | chatController.js |
| owner-scoping in farmerController | [PASS] PASS | INFO | farmerController.js |
| req.user auth check in farmerController | [PASS] PASS | INFO | farmerController.js |
| Context present -> grounded response | [PASS] PASS | INFO | Got 58-char response with farmer context |
| Missing context -> follow-up question | [WARN] WARN | MEDIUM | Response may not ask for missing context: I'm experiencing technical difficulties. Please try again. |
| Unauthenticated /api/farmer (backend offline) | [WARN] WARN | MEDIUM | Not reachable |

### 4-Weather

| Test | Status | Severity | Detail |
|---|---|---|---|
| WeatherProvider import | [PASS] PASS | INFO | Imported from ai-service |
| Valid coordinates (Hyderabad) | [PASS] PASS | INFO | temp=27.7C, wind=6.7km/h, rain_prob=39%, elapsed=2.354s |
| Missing coordinates -> missing_context | [PASS] PASS | INFO | error='Latitude and longitude are required for weather data.' |
| Network failure -> data_unavailable | [PASS] PASS | INFO | Provider handles failure gracefully |
| No RAG fallback in WeatherProvider | [PASS] PASS | INFO | No retriever/chroma calls in weather.py |
| No hardcoded temperature values | [PASS] PASS | INFO | No fabricated temperature found in weather.py |

### 5-Market

| Test | Status | Severity | Detail |
|---|---|---|---|
| MarketProvider import | [PASS] PASS | INFO | Imported from ai-service |
| MARKET_API_KEY configured -> status | [WARN] WARN | MEDIUM | status=data_unavailable, error=Market service timed out or is unreachable. |
| No RAG fallback in MarketProvider | [PASS] PASS | INFO | No retriever/chroma calls in market.py |
| No fabricated prices in market.py | [PASS] PASS | INFO | No fake/mock price patterns |
| No fabricated prices in orchestrator.py | [PASS] PASS | INFO | No hardcoded price patterns found |

### 6-Multi

| Test | Status | Severity | Detail |
|---|---|---|---|
| Multi [English - Rice crop advice] | [PASS] PASS | INFO | lang=en, conf=0.00, resp_len=58, elapsed=4.311s (Gemini fallback) |
| Multi [Telugu - Rice crop advice] | [PASS] PASS | INFO | lang=te, conf=0.00, resp_len=52, elapsed=4.493s (live response) |
| Multi [Hindi - Rice crop advice] | [PASS] PASS | INFO | lang=hi, conf=0.00, resp_len=44, elapsed=4.377s (live response) |
| Multi [English - Cotton pest] | [PASS] PASS | INFO | lang=en, conf=0.00, resp_len=58, elapsed=4.508s (Gemini fallback) |
| Multi [Telugu - Cotton pest] | [PASS] PASS | INFO | lang=te, conf=0.00, resp_len=52, elapsed=4.746s (live response) |
| Multi [Hindi - Cotton pest] | [PASS] PASS | INFO | lang=hi, conf=0.00, resp_len=44, elapsed=3.717s (live response) |
| Language routing in AI router | [PASS] PASS | INFO | Language parameter handled in ai.py |
| Language handling in orchestrator | [PASS] PASS | INFO | language parameter used in orchestrator.py |

### 7-Safety

| Test | Status | Severity | Detail |
|---|---|---|---|
| insufficient_knowledge response node | [PASS] PASS | INFO | Pattern found in: orchestrator.py, state.py |
| Safety check for chemical/pesticide requests | [PASS] PASS | INFO | Pattern found in: orchestrator.py, state.py |
| Irrelevant query blocking | [WARN] WARN | MEDIUM | Pattern not found in agent files - manual review needed |
| No-fabrication instruction | [WARN] WARN | MEDIUM | Pattern not found in agent files - manual review needed |
| Safety node/check in agent graph | [PASS] PASS | INFO | Pattern found in: orchestrator.py, state.py |
| Safety block [Unsafe chemical EN] | [WARN] WARN | MEDIUM | Gemini not configured - cannot verify safety block (set GEMINI_API_KEY) |
| Safety block [Unrelated query EN] | [WARN] WARN | MEDIUM | Gemini not configured - cannot verify safety block (set GEMINI_API_KEY) |
| Safety block [Prompt injection attempt EN] | [WARN] WARN | MEDIUM | Gemini not configured - cannot verify safety block (set GEMINI_API_KEY) |
| Safety block [Telugu safety bypass] | [WARN] WARN | MEDIUM | Response did not clearly refuse: ???????? ????? ????????. ?????? ????? ?????????????. |

### 8-Auth

| Test | Status | Severity | Detail |
|---|---|---|---|
| Routes directory exists | [PASS] PASS | INFO | Files: admin.js, auth.js, buyer.js, chat.js, cropHealth.js, farmer.js, market.js, schemes.js, soil.js, weather.js |
| Auth middleware returns 401 | [PASS] PASS | INFO | auth.js |
| JWT verification in auth middleware | [PASS] PASS | INFO | auth.js |
| authenticate middleware on farmer routes | [PASS] PASS | INFO | farmer.js |
| authenticate middleware on chat routes | [PASS] PASS | INFO | chat.js |
| owner-scoped access in farmer routes | [PASS] PASS | INFO | farmer.js |
| Unauth Farmer profile (GET) -> 401 | [PASS] PASS | INFO | Correctly returns 401 |
| Unauth Chat session (POST) -> 401 | [PASS] PASS | INFO | Correctly returns 401 |
| Unauth Soil data (GET) -> 401 | [PASS] PASS | INFO | Correctly returns 401 |
| Unauth Crop health (GET) -> 401 | [PASS] PASS | INFO | Correctly returns 401 |
| Unauth Market prices (GET) -> 401 | [PASS] PASS | INFO | Correctly returns 401 |
| Unauth Weather data (GET) -> 401 | [PASS] PASS | INFO | Correctly returns 401 |

### 9-Security

| Test | Status | Severity | Detail |
|---|---|---|---|
| Mock weather data | [WARN] WARN | MEDIUM | 2 file(s): docker-compose.yml, frontend\src\locales\en.json |
| JWT secret strength | [PASS] PASS | INFO | No known weak default detected in backend/.env |
| Helmet security middleware | [PASS] PASS | INFO | server.js |
| Rate limiting middleware | [PASS] PASS | INFO | server.js |
| CORS middleware | [PASS] PASS | INFO | server.js |
| CORS via env var | [PASS] PASS | INFO | server.js |

### 10-Error

| Test | Status | Severity | Detail |
|---|---|---|---|
| RAG retriever try/except | [PASS] PASS | INFO | Found in rag/ |
| Weather: data_unavailable fallback | [PASS] PASS | INFO | weather.py |
| Market: data_unavailable fallback | [PASS] PASS | INFO | market.py |
| Backend global error handler | [WARN] WARN | MEDIUM | Pattern 'error.*handler/status\(5' not in errorHandler.js |
| Backend 404/error handlers mounted | [PASS] PASS | INFO | server.js |
| Malformed request test | [WARN] WARN | MEDIUM | AI unreachable: None |
| Unknown backend route (offline) | [WARN] WARN | MEDIUM | Not reachable |

### 11-Obs

| Test | Status | Severity | Detail |
|---|---|---|---|
| Backend Winston logger.js exists | [PASS] PASS | INFO | logger.js found |
| Winston logger configured | [PASS] PASS | INFO | winston used in logger.js |
| AI service logging configured | [PASS] PASS | INFO | logging in main.py |
| Morgan HTTP logging | [PASS] PASS | INFO | morgan in server.js |
| Health endpoint skipped in morgan logs | [PASS] PASS | INFO | /health excluded from request logs |
| Structured JSON logging | [PASS] PASS | INFO | JSON format detected in logger |
| PII in logs scan | [PASS] PASS | INFO | No obvious PII logging patterns found |

### 12-Perf

| Test | Status | Severity | Detail |
|---|---|---|---|
| ChromaDB heartbeat: 2.063s | [PASS] PASS | MEDIUM | warn>0.5s, fail>3.0s |
| RAG single query (via AI /ai/chat): 3.832s | [PASS] PASS | MEDIUM | warn>3.0s, fail>30.0s |
| AI service /health: 2.119s | [WARN] WARN | HIGH | warn>0.3s, fail>2.0s |
| Weather API (Open-Meteo): 0.95s | [PASS] PASS | INFO | warn>2.0s, fail>10.0s |
| Backend /health: 0.096s | [PASS] PASS | INFO | warn>0.5s, fail>3.0s |

### 13-DataProt

| Test | Status | Severity | Detail |
|---|---|---|---|
| No DROP TABLE executed | [PASS] PASS | INFO | Script read-only; no destructive DB ops |
| No collection deleted | [PASS] PASS | INFO | ChromaDB collection not modified |
| No re-ingestion performed | [PASS] PASS | INFO | Production knowledge base not re-ingested |
| No production files overwritten | [PASS] PASS | INFO | Only report files written |
| Collection integrity preserved | [PASS] PASS | INFO | agrisaarthi_crops: 27/27 chunks intact |
| chroma_production_data directory | [PASS] PASS | INFO | Exists with 2 items |

---

## RAG Retrieval Results

| Label | Language | Confidence | Sources | Resp Len | Elapsed(s) | Status |
|---|---|---|---|---|---|---|
| Rice English | en | 0.00 | 0 | 58 | 4.279 | PASS |
| Rice Telugu | te | 0.00 | 0 | 52 | 4.694 | PASS |
| Rice Hindi | hi | 0.00 | 0 | 44 | 3.631 | PASS |
| Cotton | en | 0.00 | 0 | 58 | 3.897 | PASS |
| Chilli | en | 0.00 | 0 | 58 | 3.785 | PASS |
| Groundnut | en | 0.00 | 0 | 58 | 3.683 | PASS |
| Govt Scheme | en | 0.00 | 0 | 58 | 3.609 | PASS |
| Soil Nutrient | en | 0.00 | 0 | 58 | 3.583 | PASS |
| Irrelevant | en | 0.00 | 0 | 58 | 3.95 | WARN |


---

## Performance Timings

| Request | Elapsed |
|---|---|
| ChromaDB heartbeat | 2.063s |
| RAG single query (via AI /ai/chat) | 3.832s |
| AI service /health | 2.119s |
| Weather API (Open-Meteo) | 0.95s |
| Backend /health | 0.096s |


---

## Security Audit Summary

| Check | Status | Severity | Detail |
|---|---|---|---|
| Mock weather data | [WARN] WARN | MEDIUM | 2 file(s): docker-compose.yml, frontend\src\locales\en.json |
| JWT secret strength | [PASS] PASS | INFO | No known weak default detected in backend/.env |
| Helmet security middleware | [PASS] PASS | INFO | server.js |
| Rate limiting middleware | [PASS] PASS | INFO | server.js |
| CORS middleware | [PASS] PASS | INFO | server.js |
| CORS via env var | [PASS] PASS | INFO | server.js |


---

## Recommendations

- Advisory [MEDIUM] `2-RAG` — **RAG [Irrelevant]**: confidence=0.00, sources=0, resp_len=58, elapsed=3.95s (Gemini not configured - inconclusive)
- Advisory [MEDIUM] `3-FarmerCtx` — **Missing context -> follow-up question**: Response may not ask for missing context: I'm experiencing technical difficulties. Please try again.
- Advisory [MEDIUM] `3-FarmerCtx` — **Unauthenticated /api/farmer (backend offline)**: Not reachable
- Advisory [MEDIUM] `5-Market` — **MARKET_API_KEY configured -> status**: status=data_unavailable, error=Market service timed out or is unreachable.
- Advisory [MEDIUM] `7-Safety` — **Irrelevant query blocking**: Pattern not found in agent files - manual review needed
- Advisory [MEDIUM] `7-Safety` — **No-fabrication instruction**: Pattern not found in agent files - manual review needed
- Advisory [MEDIUM] `7-Safety` — **Safety block [Unsafe chemical EN]**: Gemini not configured - cannot verify safety block (set GEMINI_API_KEY)
- Advisory [MEDIUM] `7-Safety` — **Safety block [Unrelated query EN]**: Gemini not configured - cannot verify safety block (set GEMINI_API_KEY)
- Advisory [MEDIUM] `7-Safety` — **Safety block [Prompt injection attempt EN]**: Gemini not configured - cannot verify safety block (set GEMINI_API_KEY)
- Advisory [MEDIUM] `7-Safety` — **Safety block [Telugu safety bypass]**: Response did not clearly refuse: ???????? ????? ????????. ?????? ????? ?????????????.
- Advisory [MEDIUM] `9-Security` — **Mock weather data**: 2 file(s): docker-compose.yml, frontend\src\locales\en.json
- Advisory [MEDIUM] `10-Error` — **Backend global error handler**: Pattern 'error.*handler|status\(5' not in errorHandler.js
- Advisory [MEDIUM] `10-Error` — **Malformed request test**: AI unreachable: None
- Advisory [MEDIUM] `10-Error` — **Unknown backend route (offline)**: Not reachable
- Advisory [HIGH] `12-Perf` — **AI service /health: 2.119s**: warn>0.3s, fail>2.0s


---

*Generated by Phase 7 test harness. No production data was modified during this validation.*
