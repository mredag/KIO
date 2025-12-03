/**
 * Kiosk Theme System
 * Provides theme configurations for kiosk screens (Google QR, Coupon QR)
 * Requirements: 15.1, 15.4, 16.1-16.5, 17.1-17.5
 */

import { useKioskStore } from '../stores/kioskStore';

// Theme type
export type KioskThemeId = 'classic' | 'neo' | 'immersive' | 'showcase';

// Theme configuration interface
export interface KioskThemeConfig {
  id: KioskThemeId;
  name: string;
  description: string;
  
  // Background styles
  background: {
    gradient: string;
    overlay?: string;
  };
  
  // Text colors
  text: {
    primary: string;
    secondary: string;
    accent: string;
  };
  
  // Button styles
  button: {
    primary: string;
    secondary: string;
    close: string;
  };
  
  // QR code container
  qrContainer: {
    background: string;
    border?: string;
    shadow: string;
  };
  
  // Progress bar (for Coupon QR)
  progressBar: {
    track: string;
    fill: string;
  };
  
  // Animations
  animations: {
    enabled: boolean;
    floatAnimation?: boolean;
    pulseAnimation?: boolean;
    glowEffect?: boolean;
  };
}

// Classic Theme - Professional and clean look
export const classicTheme: KioskThemeConfig = {
  id: 'classic',
  name: 'Klasik',
  description: 'Profesyonel ve temiz görünüm',
  
  background: {
    gradient: 'bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900',
  },
  
  text: {
    primary: 'text-white',
    secondary: 'text-gray-300',
    accent: 'text-blue-300',
  },
  
  button: {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    secondary: 'bg-white/20 hover:bg-white/30 text-white',
    close: 'bg-white/20 hover:bg-white/30 backdrop-blur-sm',
  },
  
  qrContainer: {
    background: 'bg-white',
    shadow: 'shadow-2xl',
  },
  
  progressBar: {
    track: 'bg-black/30',
    fill: 'bg-blue-400',
  },
  
  animations: {
    enabled: true,
    floatAnimation: true,
  },
};

// Neo Theme - Modern dark theme with accent colors
export const neoTheme: KioskThemeConfig = {
  id: 'neo',
  name: 'Neo',
  description: 'Modern ve karanlık tema',
  
  background: {
    gradient: 'bg-gradient-to-br from-gray-950 via-slate-900 to-zinc-900',
    overlay: 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent',
  },
  
  text: {
    primary: 'text-white',
    secondary: 'text-gray-400',
    accent: 'text-cyan-400',
  },
  
  button: {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500/50',
    secondary: 'bg-gray-800/80 hover:bg-gray-700/80 text-white border border-gray-700',
    close: 'bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700',
  },
  
  qrContainer: {
    background: 'bg-white',
    border: 'border-4 border-cyan-500/30',
    shadow: 'shadow-[0_0_60px_rgba(6,182,212,0.3)]',
  },
  
  progressBar: {
    track: 'bg-gray-800',
    fill: 'bg-gradient-to-r from-cyan-500 to-blue-500',
  },
  
  animations: {
    enabled: true,
    floatAnimation: true,
    glowEffect: true,
  },
};


// Immersive Theme - Full-screen visual experience
export const immersiveTheme: KioskThemeConfig = {
  id: 'immersive',
  name: 'Immersive',
  description: 'Tam ekran görsel deneyim',
  
  background: {
    gradient: 'bg-gradient-to-br from-violet-950 via-fuchsia-950 to-rose-950',
    overlay: 'bg-[conic-gradient(from_180deg_at_50%_50%,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-fuchsia-500/10',
  },
  
  text: {
    primary: 'text-white',
    secondary: 'text-violet-200',
    accent: 'text-fuchsia-300',
  },
  
  button: {
    primary: 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white',
    secondary: 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-md',
    close: 'bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20',
  },
  
  qrContainer: {
    background: 'bg-white',
    border: 'border-4 border-white/20',
    shadow: 'shadow-[0_0_80px_rgba(168,85,247,0.4)]',
  },
  
  progressBar: {
    track: 'bg-white/10',
    fill: 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500',
  },
  
  animations: {
    enabled: true,
    floatAnimation: true,
    pulseAnimation: true,
    glowEffect: true,
  },
};

// Showcase Theme - Video-centric four-column layout with dark navy/charcoal palette
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.1
export const showcaseTheme: KioskThemeConfig = {
  id: 'showcase',
  name: 'Showcase',
  description: 'Video odaklı dört sütunlu görsel deneyim',
  
  background: {
    // Dark navy (#0a0f1a) to charcoal (#1a1f2e) gradient - Requirement 5.1
    gradient: 'bg-gradient-to-br from-[#0a0f1a] via-[#111827] to-[#1a1f2e]',
    overlay: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-900/10 via-transparent to-transparent',
  },
  
  text: {
    // Soft white (#f0f4f8) for primary text - Requirement 5.2
    primary: 'text-[#f0f4f8]',
    // Muted gray (#94a3b8) for secondary text - Requirement 5.4
    secondary: 'text-[#94a3b8]',
    // Teal (#14b8a6) for accent elements - Requirement 5.3
    accent: 'text-[#14b8a6]',
  },
  
  button: {
    // Teal accent for primary buttons - Requirement 5.3
    primary: 'bg-[#14b8a6] hover:bg-[#0d9488] text-white transition-colors duration-200',
    secondary: 'bg-white/10 hover:bg-white/15 text-[#f0f4f8] backdrop-blur-md border border-white/10',
    close: 'bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20',
  },
  
  qrContainer: {
    background: 'bg-white',
    border: 'border-4 border-[#14b8a6]/30',
    shadow: 'shadow-[0_0_60px_rgba(20,184,166,0.3)]',
  },
  
  progressBar: {
    track: 'bg-white/10',
    fill: 'bg-gradient-to-r from-[#14b8a6] to-[#0d9488]',
  },
  
  animations: {
    enabled: true,
    floatAnimation: false, // Showcase uses its own column animations
    pulseAnimation: false,
    glowEffect: true,
  },
};

// Showcase theme specific color constants for use in ShowcaseMode components
export const SHOWCASE_COLORS = {
  background: {
    start: '#0a0f1a',    // Dark navy
    end: '#1a1f2e',      // Charcoal
  },
  text: {
    primary: '#f0f4f8',  // Soft white
    secondary: '#94a3b8', // Muted gray
  },
  accent: '#14b8a6',     // Teal
  glass: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.2)',
    blur: '16px',
  },
};

// Animation timing constants for Showcase theme
export const SHOWCASE_ANIMATION_CONFIG = {
  columnExpand: 400,           // ms - column width transition
  cardSlideIn: 300,            // ms - glass card entrance
  cardSlideOut: 200,           // ms - glass card exit
  entranceStagger: 100,        // ms - delay between column fade-ins
  autoCycleInterval: 10000,    // ms - time between auto-advances
  pauseDuration: 60000,        // ms - pause duration after interaction
};

// Theme map for easy lookup
export const kioskThemes: Record<KioskThemeId, KioskThemeConfig> = {
  classic: classicTheme,
  neo: neoTheme,
  immersive: immersiveTheme,
  showcase: showcaseTheme,
};

// Coupon QR theme overrides - emerald/teal color scheme
export const couponThemeOverrides: Record<KioskThemeId, Partial<KioskThemeConfig>> = {
  classic: {
    background: {
      gradient: 'bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900',
    },
    text: {
      primary: 'text-white',
      secondary: 'text-emerald-200',
      accent: 'text-emerald-300',
    },
    progressBar: {
      track: 'bg-black/30',
      fill: 'bg-emerald-400',
    },
  },
  neo: {
    background: {
      gradient: 'bg-gradient-to-br from-gray-950 via-emerald-950 to-teal-950',
      overlay: 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent',
    },
    text: {
      primary: 'text-white',
      secondary: 'text-gray-400',
      accent: 'text-emerald-400',
    },
    qrContainer: {
      background: 'bg-white',
      border: 'border-4 border-emerald-500/30',
      shadow: 'shadow-[0_0_60px_rgba(16,185,129,0.3)]',
    },
    progressBar: {
      track: 'bg-gray-800',
      fill: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    },
  },
  immersive: {
    background: {
      gradient: 'bg-gradient-to-br from-emerald-950 via-teal-950 to-cyan-950',
      overlay: 'bg-[conic-gradient(from_180deg_at_50%_50%,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-teal-500/10',
    },
    text: {
      primary: 'text-white',
      secondary: 'text-emerald-200',
      accent: 'text-emerald-300',
    },
    qrContainer: {
      background: 'bg-white',
      border: 'border-4 border-emerald-500/20',
      shadow: 'shadow-[0_0_80px_rgba(16,185,129,0.4)]',
    },
    progressBar: {
      track: 'bg-white/10',
      fill: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500',
    },
  },
  showcase: {
    // Showcase theme already uses teal, so minimal overrides needed
    background: {
      gradient: 'bg-gradient-to-br from-[#0a0f1a] via-emerald-950 to-[#1a1f2e]',
      overlay: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/15 via-transparent to-transparent',
    },
    text: {
      primary: 'text-[#f0f4f8]',
      secondary: 'text-emerald-200',
      accent: 'text-emerald-400',
    },
    qrContainer: {
      background: 'bg-white',
      border: 'border-4 border-emerald-500/30',
      shadow: 'shadow-[0_0_60px_rgba(16,185,129,0.3)]',
    },
    progressBar: {
      track: 'bg-white/10',
      fill: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    },
  },
};

// Theme classes return type
export interface ThemeClasses {
  container: string;
  overlay?: string;
  title: string;
  subtitle: string;
  accent: string;
  button: string;
  closeButton: string;
  qrContainer: string;
  progressTrack: string;
  progressFill: string;
}

// Hook return type
export interface UseKioskThemeReturn {
  theme: KioskThemeConfig;
  themeId: KioskThemeId;
  setTheme: (themeId: KioskThemeId) => void;
  getThemeClasses: (variant?: 'googleQr' | 'couponQr') => ThemeClasses;
}

/**
 * useKioskTheme Hook
 * Reads theme from kioskStore and returns theme classes
 * Requirements: 15.1, 15.4
 */
export function useKioskTheme(): UseKioskThemeReturn {
  const themeId = useKioskStore((state) => state.theme);
  const setThemeInStore = useKioskStore((state) => state.setTheme);
  
  // Get base theme
  const baseTheme = kioskThemes[themeId] || classicTheme;
  
  // Set theme function
  const setTheme = (newThemeId: KioskThemeId) => {
    setThemeInStore(newThemeId);
  };
  
  // Get theme classes based on variant
  const getThemeClasses = (variant?: 'googleQr' | 'couponQr'): ThemeClasses => {
    let theme = baseTheme;
    
    // Apply coupon overrides if variant is couponQr
    if (variant === 'couponQr') {
      const overrides = couponThemeOverrides[themeId];
      theme = {
        ...baseTheme,
        background: { ...baseTheme.background, ...overrides.background },
        text: { ...baseTheme.text, ...overrides.text },
        qrContainer: { ...baseTheme.qrContainer, ...overrides.qrContainer },
        progressBar: { ...baseTheme.progressBar, ...overrides.progressBar },
      };
    }
    
    // Build container classes
    const containerClasses = [
      theme.background.gradient,
      'px-8',
      'relative',
    ];
    
    // Build QR container classes
    const qrContainerClasses = [
      theme.qrContainer.background,
      'p-8',
      'rounded-3xl',
      theme.qrContainer.shadow,
    ];
    if (theme.qrContainer.border) {
      qrContainerClasses.push(theme.qrContainer.border);
    }
    
    // Build close button classes
    const closeButtonClasses = [
      theme.button.close,
      'rounded-full',
      'flex',
      'items-center',
      'justify-center',
      'transition-all',
      'duration-200',
      'transform',
      'hover:scale-110',
    ];
    
    return {
      container: containerClasses.join(' '),
      overlay: theme.background.overlay,
      title: `${theme.text.primary} font-bold`,
      subtitle: theme.text.secondary,
      accent: theme.text.accent,
      button: theme.button.primary,
      closeButton: closeButtonClasses.join(' '),
      qrContainer: qrContainerClasses.join(' '),
      progressTrack: theme.progressBar.track,
      progressFill: `${theme.progressBar.fill} transition-all duration-1000 ease-linear`,
    };
  };
  
  return {
    theme: baseTheme,
    themeId,
    setTheme,
    getThemeClasses,
  };
}

// Export default themes list for settings page
export const themesList: KioskThemeConfig[] = [
  classicTheme,
  neoTheme,
  immersiveTheme,
  showcaseTheme,
];

/**
 * Massage Selection Algorithm for Showcase Theme
 * 
 * Selects exactly 4 massages for display in the Showcase theme columns.
 * Priority: Featured massages first (sorted by sortOrder), then non-featured.
 * 
 * Requirements: 1.2
 * - Filter featured massages first
 * - Fill remaining slots with non-featured if needed
 * - Return exactly 4 massages (or fewer if not enough exist)
 * 
 * @param massages - Array of all available massages
 * @returns Array of exactly 4 massages (or fewer if not enough exist)
 */
export interface MassageForSelection {
  id: string;
  isFeatured: boolean;
  sortOrder: number;
  [key: string]: unknown;
}

export function selectDisplayMassages<T extends MassageForSelection>(massages: T[]): T[] {
  const TARGET_COUNT = 4;
  
  // Handle empty or invalid input
  if (!massages || !Array.isArray(massages) || massages.length === 0) {
    return [];
  }
  
  // Sort all massages by sortOrder for consistent ordering
  const sortedMassages = [...massages].sort((a, b) => a.sortOrder - b.sortOrder);
  
  // Separate featured and non-featured massages
  const featured = sortedMassages.filter(m => m.isFeatured);
  const nonFeatured = sortedMassages.filter(m => !m.isFeatured);
  
  // If we have 4 or more featured, take first 4
  if (featured.length >= TARGET_COUNT) {
    return featured.slice(0, TARGET_COUNT);
  }
  
  // Otherwise, combine featured with non-featured to fill remaining slots
  const remainingSlots = TARGET_COUNT - featured.length;
  const fillers = nonFeatured.slice(0, remainingSlots);
  
  return [...featured, ...fillers];
}
