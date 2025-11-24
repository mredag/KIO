/**
 * Type definitions for database models
 */

export interface Massage {
  id: string;
  name: string;
  short_description: string;
  long_description: string | null;
  duration: string | null;
  media_type: 'video' | 'photo' | null;
  media_url: string | null;
  purpose_tags: string[]; // Stored as JSON in DB
  sessions: Session[]; // Stored as JSON in DB
  is_featured: number; // SQLite boolean (0 or 1)
  is_campaign: number; // SQLite boolean (0 or 1)
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  name: string;
  price: number;
}

export interface MassageInput {
  name: string;
  short_description: string;
  long_description?: string;
  duration?: string;
  media_type?: 'video' | 'photo';
  media_url?: string;
  purpose_tags?: string[];
  sessions?: Session[];
  is_featured?: boolean;
  is_campaign?: boolean;
  sort_order?: number;
}

export interface SurveyTemplate {
  id: string;
  name: string;
  type: 'satisfaction' | 'discovery';
  title: string;
  description: string | null;
  questions: Question[]; // Stored as JSON in DB
  is_active: number; // SQLite boolean (0 or 1)
  created_at: string;
  updated_at: string;
}

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

export interface SurveyTemplateInput {
  name?: string;
  type?: 'satisfaction' | 'discovery';
  title?: string;
  description?: string;
  questions?: Question[];
  is_active?: boolean;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  answers: Record<string, any>; // Stored as JSON in DB
  synced: number; // SQLite boolean (0 or 1)
  sync_attempts: number;
  last_sync_attempt: string | null;
  created_at: string;
}

export interface SurveyResponseInput {
  survey_id: string;
  answers: Record<string, any>;
}

export interface KioskState {
  id: number;
  mode: 'digital-menu' | 'survey' | 'google-qr';
  active_survey_id: string | null;
  last_heartbeat: string;
  updated_at: string;
}

export interface KioskStateUpdate {
  mode?: 'digital-menu' | 'survey' | 'google-qr';
  active_survey_id?: string | null;
}

export interface SystemSettings {
  id: number;
  slideshow_timeout: number;
  survey_timeout: number;
  google_qr_display_duration: number;
  google_review_url: string | null;
  google_review_title: string | null;
  google_review_description: string | null;
  sheets_sheet_id: string | null;
  sheets_sheet_name: string | null;
  sheets_credentials: string | null;
  admin_password_hash: string;
  updated_at: string;
}

export interface SystemSettingsUpdate {
  slideshow_timeout?: number;
  survey_timeout?: number;
  google_qr_display_duration?: number;
  google_review_url?: string;
  google_review_title?: string;
  google_review_description?: string;
  sheets_sheet_id?: string;
  sheets_sheet_name?: string;
  sheets_credentials?: string;
  admin_password_hash?: string;
}

export interface SystemLog {
  id: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  details: Record<string, any> | null; // Stored as JSON in DB
  created_at: string;
}

export interface SystemLogInput {
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, any>;
}
