import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

i18next
  .use(Backend)
  .init({
    lng: 'tr',
    fallbackLng: 'tr',
    ns: ['errors', 'validation', 'success', 'logs', 'coupons'],
    defaultNS: 'errors',
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
