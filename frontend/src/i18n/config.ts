import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import kioskTr from '../locales/tr/kiosk.json';
import adminTr from '../locales/tr/admin.json';
import commonTr from '../locales/tr/common.json';
import validationTr from '../locales/tr/validation.json';

// Performance monitoring
const startTime = performance.now();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: {
        kiosk: kioskTr,
        admin: adminTr,
        common: commonTr,
        validation: validationTr,
      },
    },
    lng: 'tr', // Default language
    fallbackLng: 'tr',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Disable suspense for better control
    },
    // Performance optimizations
    load: 'currentOnly', // Only load current language
    preload: ['tr'], // Preload Turkish
    ns: ['common'], // Load common namespace first
    // Caching configuration
    cache: {
      enabled: true,
      expirationTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    // Optimize translation lookup
    keySeparator: '.',
    nsSeparator: ':',
    // Reduce bundle size
    returnEmptyString: false,
    returnNull: false,
    // Performance settings
    updateMissing: false,
    saveMissing: false,
    missingKeyHandler: false,
  })
  .then(() => {
    const loadTime = performance.now() - startTime;
    console.log(`[i18n] Translations loaded in ${loadTime.toFixed(2)}ms`);
    
    // Warn if loading takes too long (> 500ms as per requirement)
    if (loadTime > 500) {
      console.warn(`[i18n] Translation loading exceeded 500ms threshold: ${loadTime.toFixed(2)}ms`);
    }
  });

export default i18n;
