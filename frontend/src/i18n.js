import { createI18n } from 'vue-i18n'
import en from './locales/en.js'
import zhTW from './locales/zh-TW.js'

const saved = localStorage.getItem('skills-vis-lang') || 'en'

export default createI18n({
  legacy: false,
  locale: saved,
  fallbackLocale: 'en',
  messages: { en, 'zh-TW': zhTW },
})
