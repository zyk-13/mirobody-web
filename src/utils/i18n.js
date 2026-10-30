import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../i18n/en.json";
import zhCn from "../i18n/zh-cn.json";
import { LANGUAGE_CODE } from "../enum/lang.js";
import { getLanguage } from "./index.js";

/* initialize i18n */
const initializeI18n = () => {
  i18n.use(initReactI18next).init({
    resources: {
      [LANGUAGE_CODE.EN]: {
        translation: {
          ...en,
        },
      },
      [LANGUAGE_CODE.ZH_CN]: {
        translation: {
          ...zhCn,
        },
      },
    },
    // One source of truth for "what language is this user".
    //
    // This used to be its own expression — localStorage, then VITE_ENV, then
    // English — which ignored both `?lang=` and `navigator.language`. Meanwhile
    // `getLanguage()` honoured all of them and was wired only into the
    // `X-Language` request header. So the two disagreed: the backend could be
    // told `ja` while the UI rendered English.
    //
    // Invisible while zh-CN was the only non-English bundle, because English
    // was the right answer for everyone else anyway. With 繁體中文 and 日本語
    // shipping it means a Japanese visitor gets an English UI, which is the
    // whole point of shipping them.
    // 不用 supportedLngs：实测它配合 nonExplicitSupportedLngs 会把 "zh-CN"
    // 按 "zh" 判成不支持，整站回落英文（2026-10-30 撞过）。改在
    // getLanguage()/normalizeLanguage 里把不支持的语言统一收口。
    lng: getLanguage(),
    fallbackLng: LANGUAGE_CODE.EN,
    interpolation: {
      escapeValue: false,
    },
  });

  // `index.html` ships `<html lang="en">` and nothing ever changed it, so all
  // four languages rendered inside a document declaring itself English. That is
  // not cosmetic: assistive tech picks its voice and pronunciation from this
  // attribute, so Japanese copy was read out with an English voice, and the
  // browser's "translate this page" offered to translate 日本語 *from* English.
  //
  // Kept here rather than in a component because this module is already the one
  // source of truth for "what language is this user", and the login page can now
  // change it without a reload.
  const syncDocumentLang = (lng) => {
    if (typeof document !== "undefined" && lng) {
      document.documentElement.lang = lng;
    }
  };
  syncDocumentLang(i18n.resolvedLanguage || i18n.language);
  i18n.on("languageChanged", syncDocumentLang);
};

export { initializeI18n };
