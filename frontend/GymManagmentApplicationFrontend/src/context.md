STYLING CONVENTION (ARCH-128 — replaces the old "use native wind only" rule):
- The standard is inline `style={{ … }}` objects built from tokens in src/theme.ts (`T`, `SP`, `R`, `TY`, `Shadow`, `withAlpha`). This is what ~90% of the code already does.
- NativeWind `className` is allowed for simple layout utilities (flex-1, px-5, gap-*) where it already exists; don't add colours through Tailwind classes, and don't mass-convert files either way.
- No StyleSheet.create in new code unless a component is performance-critical; never hardcode hex/rgba.

SHARED UI (use before writing your own):
- src/features/common/components: Screen, ScreenHeader, BackButton, PrimaryButton, SmallButton, DetailRow, ConfirmSheet, EmptyState, FormFields (Field/SwitchRow/RowGrid), FormPage, ChipSelect, DatePicker, SearchBar, SegmentedTabs, StatusPill, BottomSheet, Toast, LoadingState, Skeleton, PaginationFooter.
- Dialogs: never call Alert.alert (it does nothing on web). Use `showAlert` / `confirm()` / `notify()` from src/features/common/components/dialogs.
- Formatting: src/features/common/utils/format.ts (formatMoney, formatDate, parseDate).
- Long lists: FlatList with a module-level keyExtractor, a useCallback renderItem and a React.memo row.

FEATURE FOLDER TEMPLATE (ARCH-138, apply gradually when touching a feature):
- features/<name>/api (raw calls + React Query hooks), types/, components/ (feature-only UI), pages/ or screens/ (one per route), hooks/, utils/.
- Components are PascalCase files with the component's exact name. Import another feature only through its pages/screens entry point or its api hooks — shared pieces move to features/common.

follow floder structure correctly by refering existing folders and files.
make all responsive for all type of mobile screens.
must follow this always on design:
Design a mobile fitness app UI using the following exact design system:

---

COLOR PALETTE (source of truth: src/theme.ts `T`, mirrored in tailwind.config.js):
- Background (Primary): #0A0F0A (T.bg)
- Surface / Card Background: #151915 (T.bgInput)
- Surface Elevated: #1C211C (T.bgInputActive)
- Border / Divider: #242B24 (T.line)
- Bottom tab bar: #111111 (T.bgNav)
- Accent / CTA Green: #7ED321 (T.brand), pressed #5FA317 (T.brandDark)
- Accent gradient: #7ED321 → #FFC107 (T.brandGradient) — CTAs, progress rings, active nav
- Text Primary: #FFFFFF (T.text)
- Text Secondary: #AAB2AA (T.textSub)
- Text Tertiary / placeholders: #6B726B (T.textFaint); disabled #454B45 (T.textDisabled)
- Text On Accent: #000000 (T.onBrand)
- Status: success #22C55E (T.ok), error #EF4444 (T.err)
- Metric accents: rose #FF4D6D, sky #4DA6FF, violet #9B7EF0
- Tints: withAlpha(token, 0.08–0.15) for badge/background tints, 0.25–0.30 for tinted borders
- Scrim over imagery: rgba(0,0,0,0.55) (T.overlay)
- Never hardcode a hex/rgba value in a screen — use a token or withAlpha(token, a).

---

TYPOGRAPHY:
- Font Family: "Inter" or "SF Pro Display" (system sans-serif)
- Hero / H1: 28–32px, font-weight 800, white, tight letter-spacing (-0.5px)
- Section Heading: 18–20px, font-weight 700, white
- Body / Description: 13–14px, font-weight 400, color #AAAAAA
- Label / Badge: 11–12px, font-weight 600, uppercase optional
- Button Text: 16px, font-weight 700, color #000000 on green

---

BUTTON STYLE:
- Primary CTA: full-width, border-radius 50px (pill shape), background #7ED321 (or the brand gradient), text black, font-weight 700, padding 16px 24px
- Icon Button (small): 36x36px circle, background #1E1E1E or #2A2A2A, border: 1px solid #333, icon white
- Arrow/Link Button: 32x32px rounded square, background #7ED321, icon black (↗ arrow)

---

CARD DESIGN:
- Border radius: 16px–20px
- Background: #151915 (T.bgInput) or #1C211C (T.bgInputActive)
- Padding: 14px–18px
- Image cards: full bleed image with dark overlay gradient at bottom (linear-gradient from transparent to rgba(0,0,0,0.75))
- Exercise list cards: 60x60px thumbnail (border-radius 12px), title bold white 15px, subtitle 12px muted gray, right-side play icon button

---

LAYOUT & SPACING:
- Screen padding: 20px horizontal
- Section gap: 24px–28px vertical
- Card gap in horizontal scroll: 12px
- List item gap: 12px
- Navigation bar: bottom tab bar, dark background #111111 (T.bgNav), icons white/muted, active indicator: small green dot below icon

---

ICONOGRAPHY:
- Style: outline / stroke icons, 20–22px, color white or #AAAAAA
- Active state: filled or white
- Notification bell icon: top-right, outline style with green accent dot

---

IMAGERY STYLE:
- Full bleed dark gym/workout photography
- High contrast, moody, desaturated slightly toward cool tones
- Subjects: athletes, weightlifters, gym environment
- Always placed behind dark overlay gradients to keep text readable

---

COMPONENT PATTERNS:
- Splash/Onboarding: full-screen image bg + dark overlay + centered text stack + pill CTA button + text link below
- Home Screen: greeting row (avatar + name + bell icon) → motivational headline → streak/progress pill card → horizontal scroll workout cards with trainer avatar badge
- Workout Detail Screen: hero image top half → floating timer pill overlay → exercise list below → sticky bottom CTA button

---

MOOD & AESTHETIC:
Dark mode only. High contrast. Athletic and premium. Minimal decoration. Accent green used sparingly — only on CTAs, active states, and key badges. No gradients except image overlays. Feels like Nike meets a high-end gym app.
