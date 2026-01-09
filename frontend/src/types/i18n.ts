import 'react-i18next';
import kiosk from '../locales/tr/kiosk.json';
import admin from '../locales/tr/admin.json';
import common from '../locales/tr/common.json';
import validation from '../locales/tr/validation.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      kiosk: typeof kiosk;
      admin: typeof admin;
      common: typeof common;
      validation: typeof validation;
    };
  }
}
