import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        // Model-unavailable (503) and validation (4xx) errors will not fix themselves; don't hammer the API.
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  })
}
