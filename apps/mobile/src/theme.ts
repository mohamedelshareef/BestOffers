/**
 * Semantic design tokens — v2 re-skin (values from team/design/mockups/tokens.css `:root`).
 * Token NAMES are unchanged from v1 (a brand swap is a value edit, not a structural change), so
 * every existing screen/card/pill picks up the new look without API changes.
 *
 * v2 = warm Gulf "sand" canvas + deep teal-evergreen brand + reserved deal-gold value accent +
 * card radius 16 + full-pill chips + Rubik (display) / IBM Plex Sans Arabic (body). The brand
 * gradient + accent gradient stops live below for expo-linear-gradient call sites (hero CTA,
 * active sector, verdict ribbon).
 */
export const color = {
  brand: {
    primary: '#0B6B5B', // deep teal-evergreen — trust / good deal
    primaryPressed: '#075345', // pressed / gradient deep stop
    primarySoft: '#E3F2EE', // tinted surfaces, selected chips
    accent: '#C8881C', // deal-gold (reserved: price + best-offer verdict ONLY)
  },
  accent: {
    gold: '#C8881C',
    goldStrong: '#A86E0E',
    goldSoft: '#FBF0D9', // verdict ribbon fill / quota-warn bg
  },
  bg: { canvas: '#FBF8F3', surface: '#FFFFFF', surfaceAlt: '#F1ECE3', elevated: '#FFFFFF' },
  text: { primary: '#18211F', secondary: '#5C6864', onBrand: '#FFFFFF', onGold: '#2A1D03' },
  border: { default: '#E6DFD4', strong: '#D6CDBE' },
  state: { success: '#1E9E6A', error: '#C8442F', warning: '#B5780A' },
  overlay: { scrim: 'rgba(20,28,26,0.55)' },
} as const;

/** Gradient stops (135deg in CSS → expo-linear-gradient start/end). */
export const gradient = {
  brand: ['#0E8C74', '#075345'] as const, // hero CTA, active sector
  accent: ['#E0A93B', '#C8881C'] as const, // verdict ribbon, gold CTA
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Radius — card up to 16 (premium), chip/pill full (999), input/button 14. */
export const radius = { card: 16, input: 14, button: 14, chip: 999, pill: 999, sheet: 24 } as const;

/**
 * Font families. Loaded via expo-font in app/_layout.tsx; names below must match the loaded keys.
 * Display = Rubik (headings, prices, CTAs); body = IBM Plex Sans Arabic (Arabic body + UI).
 * On web (export) the @import in the document brings these in; native loads the .ttf via expo-font.
 */
export const font = {
  display: 'Rubik_400Regular',
  displayBold: 'Rubik_700Bold',
  displayExtraBold: 'Rubik_800ExtraBold',
  body: 'IBMPlexSansArabic_400Regular',
  bodyMedium: 'IBMPlexSansArabic_500Medium',
  bodySemiBold: 'IBMPlexSansArabic_600SemiBold',
} as const;
