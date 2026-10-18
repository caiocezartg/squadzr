import type en from '@/locales/en.json'
import type { Locale } from './locales'

// The English file is the source of truth: `useTranslations` accepts only the keys it defines.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: typeof en
  }
}
