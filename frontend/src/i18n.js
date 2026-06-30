import { createI18n } from 'vue-i18n'
import en from './locales/en.js'
import zhTW from './locales/zh-TW.js'

function detectLocale() {
  const saved = localStorage.getItem('skills-vis-lang')
  if (saved) return saved
  const lang = navigator.language || navigator.userLanguage || 'en'
  return lang.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en'
}

const saved = detectLocale()

export default createI18n({
  legacy: false,
  locale: saved,
  fallbackLocale: 'en',
  messages: { en, 'zh-TW': zhTW },
})
