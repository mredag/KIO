// Import i18n type definitions
import './i18n';

// Kiosk types
export type KioskMode = 'digital-menu' | 'survey' | 'google-qr' | 'coupon-qr' | 'slideshow';

// SSE Event Types
export interface KioskSSEEvent {
  type: 'connected' | 'mode-change' | 'survey-update' | 'menu-update' | 'settings-update';
  data?: any;
  timestamp: string;
}

export interface KioskState {
  mode: KioskMode;
  activeSurveyId?: string;
  lastSync: Date;
  isOffline: boolean;
  config?: {
    slideshowTimeout: number;
    surveyTimeout: number;
    googleQrDisplayDuration: number;
    theme?: 'classic' | 'immersive' | 'neo';
  };
}

// Massage types
export interface Session {
  name: string;
  price: number;
}

export interface Massage {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  duration: string;
  mediaType: 'video' | 'photo';
  mediaUrl: string;
  purposeTags: string[];
  sessions: Session[];
  isFeatured: boolean;
  isCampaign: boolean;
  layoutTemplate: 'price-list' | 'info-tags' | 'media-focus' | 'immersive-showcase';
  sortOrder: number;
}

// Survey types
export interface Question {
  id: string;
  text: string;
  type: 'rating' | 'single-choice';
  options: string[];
  optionIcons?: string[]; // Custom icons for each option (emoji)
  isRequired: boolean;
  trackImportant?: boolean;
  conditionalOn?: {
    questionId: string;
    values: any[];
  };
  googleReviewAction?: {
    enabled: boolean;
    minRating: number;
  };
}

export interface SurveyTemplate {
  id: string;
  name: string;
  type: 'satisfaction' | 'discovery';
  title: string;
  description: string;
  questions: Question[];
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  timestamp: Date;
  answers: Record<string, any>;
  synced: boolean;
}

// Google Review types
export interface GoogleReviewConfig {
  url: string;
  title: string;
  description: string;
  displayDuration: number;
  qrCode: string; // Base64 data URL
}

// Admin types
export interface AuthState {
  isAuthenticated: boolean;
  user: { username: string } | null;
}

export interface SystemStatus {
  todaySurveyCount: number;
  totalSurveyCount: number;
  activeCoupons: number;
  currentKioskMode: string;
  activeSurveyId?: string | null;
  currentContent: string;
  kioskLastSeen: Date;
  kioskOnline: boolean;
  sheetsLastSync: Date;
  pendingSyncCount: number;
  surveyTrend: Array<{ date: string; value: number }>;
  couponTrend: Array<{ date: string; value: number }>;
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    href?: string;
  }>;
}

export interface SystemSettings {
  slideshowTimeout: number;
  surveyTimeout: number;
  googleQrDisplayDuration: number;
  kioskTheme?: 'classic' | 'immersive';
  googleReviewUrl?: string;
  googleReviewTitle?: string;
  googleReviewDescription?: string;
  sheetsConfig: {
    sheetId: string;
    sheetName: string;
    credentials: string;
  };
}

export interface SystemLog {
  id: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  details: Record<string, any> | null;
  created_at: string;
}

// Coupon System types
export interface CouponToken {
  token: string;
  status: 'issued' | 'used' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface CouponWallet {
  phone: string;
  couponCount: number;
  totalEarned: number;
  totalRedeemed: number;
  optedInMarketing: boolean;
  lastMessageAt: Date | null;
  updatedAt: Date;
}

export interface CouponRedemption {
  id: string;
  phone: string;
  couponsUsed: number;
  status: 'pending' | 'completed' | 'rejected';
  note: string | null;
  createdAt: Date;
  notifiedAt: Date | null;
  completedAt: Date | null;
  rejectedAt: Date | null;
}

export interface CouponEvent {
  id: number;
  phone: string | null;
  event: 'issued' | 'coupon_awarded' | 'redemption_attempt' | 'redemption_granted' | 'redemption_blocked';
  token: string | null;
  details: Record<string, any> | null;
  createdAt: Date;
}
