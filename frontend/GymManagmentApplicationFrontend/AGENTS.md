# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Project structure

`index.ts` → `App.tsx` (simple `useState`-based routing). No navigation library yet.

Feature-based modules under `src/features/{auth,branches,common,dashboard,tenants,trainers}/`, each with `api/`, `components/`, `types/` subdirs (some also have `hooks/`, `pages/`). Shared layer at `src/api/` (axios instance, endpoints, query keys) and `src/config.ts` (hardcoded API base URL).

Design system doc at `src/context.md` — dark mode only, `#AAFF00` accent, 390×844 base. Components use `scaleW/scaleH/rs` helpers for responsive sizing.

# Styling

NativeWind v4 (Tailwind for RN). Configured in `babel.config.js` (`nativewind/babel` preset) and `metro.config.js` (`withNativeWind`). Run `npx expo start --clear` to reset metro cache if styles don't update. Custom Tailwind theme (dark palette) in `tailwind.config.js`. Design tokens also available as `T` import from `src/features/trainers/components/theme.ts`.

# API & data

Axios instance (`src/api/axios.ts`) with request interceptor for Bearer JWT; token stored **in-memory only** via `setAuthToken()`. React Query pattern: `api/{feature}Api.ts` (raw axios calls) → `api/{feature}Queries.ts` (`useQuery`/`useMutation` hooks). Shared query keys in `src/api/queryKeys.ts`. Response shape: `{ success, message, data, errors }`.

# Commands

| Command | Action |
|---------|--------|
| `npm start` | Expo dev server |
| `npm run android` | Start on Android |
| `npm run ios` | Start on iOS |
| `npm run web` | Start on Web |
| `npx tsc --noEmit` | Type-check manually |

No linter, formatter, or test scripts exist. `src/config/` directory is empty. Two `LoginPage.tsx` files exist — use `src/features/auth/components/LoginPage.tsx` (production, wired to `useLogin`), not the stale mock in `src/features/common/`.
