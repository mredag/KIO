// Import i18n type definitions
import './i18n';

// Kiosk types
export type KioskMode = 'digital-menu' | 'survey' | 'google-qr';

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
  sortOrder: number;
}

// Survey types
export interface Question {
  id: string;
  text: string;
  type: 'rating' | 'single-choice';
  options: string[];
  isRequired: boolean;
  trackImportant?: boolean;
  conditionalOn?: {
    questionId: string;
    values: any[];
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
  currentKioskMode: string;
  activeSurveyId?: string | null;
  currentContent: string;
  kioskLastSeen: Date;
  kioskOnline: boolean;
  sheetsLastSync: Date;
  pendingSyncCount: number;
}

export interface SystemSettings {
  slideshowTimeout: number;
  surveyTimeout: number;
  googleQrDisplayDuration: number;
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
