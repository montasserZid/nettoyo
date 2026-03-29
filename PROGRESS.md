# Nettoyó — Build Progress Log

## Phase 1: Landing Page (No Database)

### 2024-03-28 — Initial Setup
- [x] Create PROGRESS.md build log
- [x] Set up i18n system with French as default language
- [x] Create translation files for FR, EN, ES
- [x] Build Navbar component with language switcher
- [x] Build Hero section with split layout
- [x] Build Service Pills component
- [x] Build Top Cleaners section
- [x] Build Footer component
- [x] Implement language persistence (localStorage)
- [x] Add responsive mobile layout
- [x] Production build successful

## Features Implemented

### i18n System
- French (fr) as default language
- Support for English (en) and Spanish (es)
- Language switcher with flag icons
- Active language highlighted with mint border
- Language preference persists via localStorage
- URL updates to /fr, /en, or /es on language switch

### Components
- **Navbar**: Logo, nav links, language switcher, login button, book CTA
- **Hero**: Split layout with headline, subheadline, CTA, and trust bar
- **ServicePills**: Horizontally scrollable service categories
- **TopCleaners**: Card grid showcasing available cleaners
- **Footer**: Logo, copyright, language switcher, nav links

### Design System
- Primary: #4FC3F7 (sky blue)
- Secondary: #A8E6CF (mint green)
- Inter font family
- Fully responsive (mobile & desktop)
- Smooth transitions and hover states

## Step 11 — Logo sizing fixed
- Investigated root cause of small/unclear logo rendering
- Applied optimal size for header logo
- Applied optimal size for footer logo
- Fixed any clipping or overflow issues on sparkle stars
- Both logos link to homepage
- Status: ✅ done

## Step 12 — "Comment ça marche" page built
- Route wired: /fr/comment-ca-marche · /en/how-it-works · /es/como-funciona
- Active nav link highlighted on this page
- Section 1: hero banner with CTA ✅
- Section 2: client/cleaner tab switcher ✅
- Section 3a: 4-step client flow ✅
- Section 3b: 4-step cleaner flow ✅
- Section 4: 4 trust cards ✅
- Section 5: 3 pricing cards ✅
- Section 6: FAQ accordion (5 questions) ✅
- Section 7: 3 client reviews + 1 cleaner testimonial ✅
- Section 8: final CTA banner ✅
- All content in FR / EN / ES ✅
- Same design system as landing page ✅
- Status: ✅ done

## Step 14 — Services page built
- Route wired: /fr/services · /en/services · /es/servicios
- Active nav link highlighted ✅
- Section 1: hero with search bar ✅
- Section 2: filter pills with active state ✅
- Section 3: 6 service cards with badges, inclusions,
  prices in $ and duration ✅
- Section 4: pricing explainer (3 blocks) ✅
- Section 5: add-ons toggle chips with live total ✅
- Section 6: business/B2B section ✅
- Section 7: eco-friendly commitment ✅
- Section 8: FAQ accordion (5 questions) ✅
- Section 9: final CTA banner ✅
- All content in FR / EN / ES ✅
- Same design system as all other pages ✅
- Status: ✅ done

## Step 15 — Authentication pages built (UI only)
- Login page: /fr/connexion · /en/login · /es/iniciar-sesion ✅
- Sign-up page: /fr/inscription · /en/signup · /es/registro ✅
- Navbar "Connexion" button links to login page ✅
- All CTA "Réserver" buttons redirect to login if not logged in ✅
- Social login buttons: Google · Facebook · Apple ✅
- Role selection cards: client · cleaner with selection state ✅
- Form reveals on role card click with smooth animation ✅
- Cleaner form has extra city field ✅
- Login ↔ Sign-up navigation buttons prominent on both pages ✅
- All content in FR / EN / ES ✅
- Fully responsive desktop + mobile ✅
- UI only — no real auth logic yet ✅
- Status: ✅ done

## Step 16 — Sign-up page Vercel deployment fixed
- Root cause: Vercel had no SPA rewrite, so direct localized auth routes like /fr/inscription were treated as missing static files instead of being served by dist/index.html
- Files changed: vercel.json · PROGRESS.md
- /fr/inscription · /en/signup · /es/registro all load ✅
- No other pages affected ✅
- Status: ✅ done
