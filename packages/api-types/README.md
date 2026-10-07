# @agriminds/api-types

Generated TypeScript types for the AgriMinds API. `openapi.json` is exported from the FastAPI app;
`src/schema.d.ts` is generated from it by `openapi-typescript`; `src/index.ts` adds readable aliases.

```bash
make api-types        # export schema from backend + regenerate types
```

Consumed by `frontend` and `mobile` via the pnpm workspace (`"@agriminds/api-types": "workspace:*"`).
