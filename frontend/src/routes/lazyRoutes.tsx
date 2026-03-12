import { lazy } from 'react';

/**
 * Lazy-loaded route components for code splitting
 * Each route is loaded only when needed, reducing initial bundle size
 */

// Kiosk
export const KioskPage = lazy(() => import('../pages/KioskPage'));

// Admin - Auth
export const LoginPage = lazy(() => import('../pages/admin/LoginPage'));

// Admin - Dashboard
export const DashboardPage = lazy(() => import('../pages/admin/DashboardPage'));

// Admin - Massages
export const MassagesPage = lazy(() => import('../pages/admin/MassagesPage'));
export const MassageFormPage = lazy(() => import('../pages/admin/MassageFormPage'));

// Admin - Kiosk Control
export const KioskControlPage = lazy(() => import('../pages/admin/KioskControlPage'));

// Admin - Surveys
export const SurveysPage = lazy(() => import('../pages/admin/SurveysPage'));
export const SurveyEditorPage = lazy(() => import('../pages/admin/SurveyEditorPage'));
export const SurveyAnalyticsPage = lazy(() => import('../pages/admin/SurveyAnalyticsPage'));
export const SurveyResponsesPage = lazy(() => import('../pages/admin/SurveyResponsesPage'));

// Admin - Coupons
export const CouponIssuePage = lazy(() => import('../pages/admin/CouponIssuePage'));
export const CouponRedemptionsPage = lazy(() => import('../pages/admin/CouponRedemptionsPage'));
export const CouponWalletLookupPage = lazy(() => import('../pages/admin/CouponWalletLookupPage'));
export const CouponSettingsPage = lazy(() => import('../pages/admin/CouponSettingsPage'));

// Admin - Automation
export const InteractionsPage = lazy(() => import('../pages/admin/InteractionsPage'));
export const ServicesPage = lazy(() => import('../pages/admin/ServicesPage'));
export const KnowledgeBasePage = lazy(() => import('../pages/admin/KnowledgeBasePage'));
export const WorkflowTestPage = lazy(() => import('../pages/admin/WorkflowTestPage'));

// Admin - Mission Control
export const MCDashboardPage = lazy(() => import('../pages/admin/mc/MCDashboardPage'));
export const MCWorkshopPage = lazy(() => import('../pages/admin/mc/MCWorkshopPage'));
export const MCAgentsPage = lazy(() => import('../pages/admin/mc/MCAgentsPage'));
export const MCConversationsPage = lazy(() => import('../pages/admin/mc/MCConversationsPage'));
export const MCCostsPage = lazy(() => import('../pages/admin/mc/MCCostsPage'));
export const MCPoliciesPage = lazy(() => import('../pages/admin/mc/MCPoliciesPage'));
export const MCJarvisPage = lazy(() => import('../pages/admin/mc/MCJarvisPage'));
export const MCDMKontrolPage = lazy(() => import('../pages/admin/mc/MCDMKontrolPage'));
export const MCDMConductPage = lazy(() => import('../pages/admin/mc/MCDMConductPage'));
export const MCDMReviewPage = lazy(() => import('../pages/admin/mc/MCDMReviewPage'));
export const MCAutoPilotPage = lazy(() => import('../pages/admin/mc/MCAutoPilotPage'));
export const MCActivityPage = lazy(() => import('../pages/admin/mc/MCActivityPage'));
export const MCCronPage = lazy(() => import('../pages/admin/mc/MCCronPage'));
export const MCGatewaysPage = lazy(() => import('../pages/admin/mc/MCGatewaysPage'));

// Admin - System
export const SettingsPage = lazy(() => import('../pages/admin/SettingsPage'));
export const BackupPage = lazy(() => import('../pages/admin/BackupPage'));
export const SystemLogsPage = lazy(() => import('../pages/admin/SystemLogsPage'));
