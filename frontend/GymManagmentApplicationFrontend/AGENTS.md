# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Project structure

`index.ts` (installs the web `Alert` shim from `src/utils/webAlert.ts`) → `App.tsx`. **No navigation library yet** — App.tsx keeps a `useState` app state (signed out / admin / trainer / member); inside an app, screens are switched with local state. Web URLs don't change per screen.

After sign-in App.tsx renders `AccessProvider` (`src/features/access/context/AccessContext.tsx`: the user's module/tab access list from `/access/me`, cached in storage, refetched on focus and every 5 min) around `AppShell` (`src/features/access/components/AppShell.tsx`), which builds every role's menu from that list and mounts the admin / trainer / member apps. The backend enforces the same grants.

Feature modules under `src/features/<feature>/` — access, ai-coach, attendance, auth, billing, branches, challenges, classes, common, dashboard, exercises, health, leads, member-app, member-billing (incl. `payments/` Razorpay checkout: script on web, WebView on phones), member-booking, members, module-access, shop (`admin/`, `store/`, `api/`, `common/`), social, tenants, trainer-app, trainers, workouts. Typical subdirs: `api/`, `components/`, `pages/` or `screens/`, `types/`, `hooks/`, `utils/`.

`src/app/providers/QueryProvider.tsx` is just a provider folder. `src/app` is *not* an Expo Router root (expo-router isn't installed, even though the Expo CLI prints "Using src/app as the root directory for Expo Router"). If expo-router is ever added, rename this folder first (e.g. to `src/providers`) or it becomes the route tree.

`src/dev/` — design preview mode (`?preview=admin|trainer|member` on a dev web build) with mock API data. Loaded only via a `__DEV__`-guarded `require` in App.tsx, so it is stripped from production bundles. Never import `src/dev` statically.

Design system doc at `src/context.md` — dark mode only, `#7ED321` green accent (green→gold gradient), 390×844 base.

# Styling

NativeWind v4 (Tailwind for RN). Configured in `babel.config.js` (`nativewind/babel` preset) and `metro.config.js` (`withNativeWind`). Run `npx expo start --clear` to reset metro cache if styles don't update. Design tokens: import `T`, `withAlpha` (and `Shadow`, `TY`, `SP`, `R`) from `src/theme.ts` — never hardcode hex/rgba colours in screens. Solid colours live in `src/theme.colors.json`, read by both `theme.ts` and `tailwind.config.js` (so classes like `text-sub` = `T.textSub`); add new colours there.

Responsive sizes: `useLayout()` and `useScale()` (scaleW/scaleH/rs that follow the window) from `src/utils/useLayout.ts`. `src/utils/scale.ts` is deprecated (start-up-only values; only LoginPage still uses it).

# API & data

- `src/config.ts` — `API_BASE_URL` from `EXPO_PUBLIC_API_URL` (build-time; set per EAS profile in `eas.json`, in Vercel env, or a local `.env`), falling back to the production Render URL.
- `src/api/axios.ts` — axios instance: 30 s timeout (`REQUEST_TIMEOUT_MS`; uploads `UPLOAD_TIMEOUT_MS` = 120 s), Bearer access token held **in memory** (`setAuthToken`), silent refresh on 401 (one shared refresh for concurrent 401s; a failed refresh ends the session once).
- `src/api/authStore.ts` — persists only the refresh token + session: SecureStore on phones, **sessionStorage on web** (per tab; see trade-off note in `src/utils/storage.ts`).
- `src/api/http.ts` — the only envelope helpers: `unwrap` / `unwrapRequired` / `unwrapResponse` / `messageOf`. A `success: false` envelope throws `ApiError` (`serverMessage`, `errors`). Show errors with `apiErrorText` / `describeApiError` / `fieldErrorsFrom` from `src/api/apiError.ts`.
- `src/api/upload.ts` — all multipart uploads: `uploadFile` (one file + extra fields), `appendFile` + `postMultipart` (several files, progress).
- `src/api/session.ts` — current session (`getSession()` outside React, `useSession()` in components, `onSessionChange()` for per-user caches to clear on sign-out).
- `src/utils/storage.ts` — `sessionStore` / `prefsStore` key-value wrappers; don't branch on `Platform.OS` for storage elsewhere.
- Endpoints: newer features keep a local `EP`/`BASE` map in their `*Api.ts`; `src/api/endpoints.ts` covers older admin features only — don't add to it.
- Query keys: `src/api/queryKeys.ts` or a feature-local `K` factory; each feature has a unique root, and invalidation uses keys/prefixes from those factories, not inline literals.
- React Query pattern: `api/{feature}Api.ts` (raw calls) → `api/{feature}Queries.ts` (`useQuery`/`useMutation`). Defaults in QueryProvider (1 min staleTime, no retry on 4xx; AppState wired to focusManager on phones).
- Response shape: `{ success, message, data, errors }`.

# Commands

| Command | Action |
|---------|--------|
| `npm start` | Expo dev server |
| `npm run android` | Start on Android |
| `npm run ios` | Start on iOS |
| `npm run web` | Start on Web |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` (ESLint flat config `eslint.config.js`, eslint-config-expo; errors fail, React Compiler rules are warnings for now) |
| `npm test` | Jest (`jest-expo` preset, `jest.config.js`); tests live in `src/**/__tests__/*.test.ts` and import `describe/it/expect` from `@jest/globals` |

No formatter (Prettier) yet. Web is hosted on Vercel (`vercel.json` at the repo root: build, SPA rewrite, security headers incl. CSP — add any new third-party script/API/frame origin there).

Shared UI lives in `src/features/common/components/` (Screen, ScreenHeader, BackButton, PrimaryButton, SearchBar, SegmentedTabs, StatusPill, BottomTabBar, LoadingState, Skeleton, PaginationFooter, EmptyState, FormFields, FormPage, ChipSelect, DatePicker, SmallButton, DetailRow, ConfirmSheet, UploadField, and `dialogs` — use `showAlert`/`confirm`/`notify` instead of `Alert.alert`); styling convention in `src/context.md`.
