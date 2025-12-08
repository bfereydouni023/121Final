export type SupportedLanguage = "en" | "fa" | "zh";

export type TranslationKey =
    | "pauseTitle"
    | "pauseDescription"
    | "restartButton"
    | "restartAria"
    | "moveLeft"
    | "moveRight"
    | "victoryMessage"
    | "languageLabel"
    | "languageEnglish"
    | "languagePersian"
    | "languageMandarin"
    | "modeToggleTitle"
    | "fpsLabel"
    | "levelSelectButton"
    | "levelSelectAria"
    | "levelLabel";

type TranslationMap = Record<SupportedLanguage, Record<TranslationKey, string>>;

//creating translations for the text in our game
const translations: TranslationMap = {
    //english
    en: {
        pauseTitle: "Pause Menu",
        pauseDescription: "Press Escape again to resume.",
        restartButton: "Restart Level",
        restartAria: "Restart current level",
        moveLeft: "Move Left",
        moveRight: "Move Right",
        victoryMessage: "You win!",
        languageLabel: "Language",
        languageEnglish: "English",
        languagePersian: "Persian",
        languageMandarin: "Mandarin",
        modeToggleTitle: "Toggle light / dark mode",
        fpsLabel: "FPS: {value}",
        levelSelectButton: "Level Select",
        levelSelectAria: "Open level select",
        levelLabel: "Level {value}",
    },
    //farsi
    fa: {
        pauseTitle: "منوی توقف",
        // pauseDescription: "برای ادامه دوباره Escape را فشار دهید.",
        pauseDescription: "برای بستن منو اسکیپ را فشار دهید",
        restartButton: "بازشروع مرحله",
        restartAria: "مرحله را دوباره شروع کنید",
        moveLeft: "حرکت به چپ",
        moveRight: "حرکت به راست",
        victoryMessage: "تو برنده‌ای!",
        languageLabel: "زبان",
        languageEnglish: "انگلیسی",
        languagePersian: "فارسی",
        languageMandarin: "چینی ماندارین",
        modeToggleTitle: "تغییر حالت روشن/تاریک",
        fpsLabel: "فریم بر ثانیه: {value}",
        levelSelectButton: "انتخاب مرحله",
        levelSelectAria: "باز کردن انتخاب مرحله",
        levelLabel: "مرحله {value}",
    },
    //mandarin
    zh: {
        pauseTitle: "暂停菜单",
        pauseDescription: "再次按下 Escape 键继续。",
        restartButton: "重新开始关卡",
        restartAria: "重新开始当前关卡",
        moveLeft: "向左移动",
        moveRight: "向右移动",
        victoryMessage: "你赢了！",
        languageLabel: "语言",
        languageEnglish: "英语",
        languagePersian: "波斯语",
        languageMandarin: "中文（普通话）",
        modeToggleTitle: "切换明暗模式",
        fpsLabel: "帧率：{value}",
        levelSelectButton: "选择关卡",
        levelSelectAria: "打开关卡选择",
        levelLabel: "关卡 {value}",
    },
};

//start with english language
let currentLanguage: SupportedLanguage = "en";
const languageListeners: Array<(lang: SupportedLanguage) => void> = [];

//translate function that will be called in main.ts when we are writing text
export function translate(
    key: TranslationKey,
    params?: Record<string, string | number>,
): string {
    const value = translations[currentLanguage][key] ?? key;
    if (!params) return value;

    return Object.entries(params).reduce((acc, [paramKey, paramVal]) => {
        return acc.replace(`{${paramKey}}`, String(paramVal));
    }, value);
}

export function setLanguage(lang: SupportedLanguage) {
    if (lang === currentLanguage) return;
    currentLanguage = lang;
    languageListeners.forEach((listener) => listener(currentLanguage));
}

export function getLanguage(): SupportedLanguage {
    return currentLanguage;
}

export function onLanguageChange(listener: (lang: SupportedLanguage) => void) {
    languageListeners.push(listener);
}

export function getLanguageLabel(lang: SupportedLanguage): string {
    switch (lang) {
        case "fa":
            return translations[currentLanguage].languagePersian;
        case "zh":
            return translations[currentLanguage].languageMandarin;
        case "en":
        default:
            return translations[currentLanguage].languageEnglish;
    }
}
