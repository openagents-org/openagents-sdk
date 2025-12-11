import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {
    FALLBACK_LANGUAGE,
    NAMESPACES,
    DEFAULT_NAMESPACE,
    LANGUAGE_STORAGE_KEY,
} from './config';

// Import translation files
import commonEN from './locales/en/common.json';
import authEN from './locales/en/auth.json';
import messagingEN from './locales/en/messaging.json';
import documentsEN from './locales/en/documents.json';
import wikiEN from './locales/en/wiki.json';
import forumEN from './locales/en/forum.json';
import feedEN from './locales/en/feed.json';
import mcpEN from './locales/en/mcp.json';
import networkEN from './locales/en/network.json';
import layoutEN from './locales/en/layout.json';
import errorsEN from './locales/en/errors.json';
import validationEN from './locales/en/validation.json';

import commonZH from './locales/zh-CN/common.json';
import authZH from './locales/zh-CN/auth.json';
import messagingZH from './locales/zh-CN/messaging.json';
import documentsZH from './locales/zh-CN/documents.json';
import wikiZH from './locales/zh-CN/wiki.json';
import forumZH from './locales/zh-CN/forum.json';
import feedZH from './locales/zh-CN/feed.json';
import mcpZH from './locales/zh-CN/mcp.json';
import networkZH from './locales/zh-CN/network.json';
import layoutZH from './locales/zh-CN/layout.json';
import errorsZH from './locales/zh-CN/errors.json';
import validationZH from './locales/zh-CN/validation.json';

// Configure language detector
const languageDetectorOptions = {
    // Order of detection methods
    order: ['querystring', 'localStorage', 'navigator'],

    // Keys to lookup language from
    lookupQuerystring: 'lang',
    lookupLocalStorage: LANGUAGE_STORAGE_KEY,

    // Cache user language
    caches: ['localStorage'],

    // Optional: exclude certain languages from being detected
    excludeCacheFor: ['cimode'],
};

// Initialize i18next
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        // Resources
        resources: {
            en: {
                common: commonEN,
                auth: authEN,
                messaging: messagingEN,
                documents: documentsEN,
                wiki: wikiEN,
                forum: forumEN,
                feed: feedEN,
                mcp: mcpEN,
                network: networkEN,
                layout: layoutEN,
                errors: errorsEN,
                validation: validationEN,
            },
            'zh-CN': {
                common: commonZH,
                auth: authZH,
                messaging: messagingZH,
                documents: documentsZH,
                wiki: wikiZH,
                forum: forumZH,
                feed: feedZH,
                mcp: mcpZH,
                network: networkZH,
                layout: layoutZH,
                errors: errorsZH,
                validation: validationZH,
            },
        },

        // Language settings - DO NOT set lng here, let language detector handle it
        fallbackLng: FALLBACK_LANGUAGE,

        // Namespace settings
        ns: NAMESPACES,
        defaultNS: DEFAULT_NAMESPACE,

        // Language detector options
        detection: languageDetectorOptions,

        // Interpolation settings
        interpolation: {
            escapeValue: false, // React already escapes values
        },

        // React specific options
        react: {
            useSuspense: false, // Set to true if you want to use Suspense
        },

        // Debug mode (disable in production)
        debug: process.env.NODE_ENV === 'development',

        // Return empty string for missing keys instead of key name
        returnEmptyString: false,

        // Return null for missing keys
        returnNull: false,
    });

export default i18n;
