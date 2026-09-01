# AgriSaarthi Phase 9 Report
**Generated:** 2026-09-01 19:14:07 IST

## Phase 9 — Reliability, Performance & Security

| Test | Status | Severity | Detail |
|---|---|---|---|
| .env files in .gitignore | [PASS] PASS | CRITICAL | .env protected by root .gitignore |
| GEMINI_API_KEY configured | [PASS] PASS | CRITICAL | Key present in ai-service/.env [value hidden] |
| MARKET_API_KEY configured | [PASS] PASS | HIGH | Key present in .env [value hidden] |
| JWT_SECRET strong (>=32 chars) | [PASS] PASS | CRITICAL | Strong JWT secret configured [value hidden] |
| Secret values not leaked in source | [PASS] PASS | CRITICAL | No credentials found in source/docs |
| No hardcoded secrets in source | [PASS] PASS | HIGH | No hardcoded credentials |
| PII not logged | [PASS] PASS | HIGH | No obvious PII logging detected |
| No mock weather/price defaults in production | [PASS] PASS | MEDIUM | WEATHER_USE_MOCK defaults to false |
| CORS via env var (not wildcard) | [PASS] PASS | MEDIUM | CORS_ORIGIN env var used; defaults to localhost only |
| Helmet security headers | [PASS] PASS | HIGH | helmet() in server.js |
| Rate limiting active | [PASS] PASS | HIGH | express-rate-limit on /api/ and /api/auth/ |
| Weather provider: timeout configured | [PASS] PASS | HIGH | httpx timeout in weather.py |
| Market provider: timeout + retry configured | [PASS] PASS | HIGH | httpx timeout + tenacity retry in market.py |
| PostgreSQL connection pool configured | [PASS] PASS | MEDIUM | pg.Pool with max connections |
| Production ChromaDB data directory intact | [PASS] PASS | CRITICAL | chroma_production_data exists (2 items) |
| agrisaarthi_crops collection present | [PASS] PASS | CRITICAL | Collections: ['agrisaarthi_crops'], elapsed=2.065s |
| AI service /health | [PASS] PASS | HIGH | status=healthy, gemini=True, elapsed=2.082s |

**Total:** 17 | **PASS:** 17 | **WARN:** 0 | **FAIL:** 0