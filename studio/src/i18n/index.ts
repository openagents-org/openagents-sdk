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
import profileEN from './locales/en/profile.json';
import networkEN from './locales/en/network.json';
import layoutEN from './locales/en/layout.json';
import errorsEN from './locales/en/errors.json';
import validationEN from './locales/en/validation.json';
import projectEN from './locales/en/project.json';
import artifactEN from './locales/en/artifact.json';
import llmlogsEN from './locales/en/llmlogs.json';
import serviceAgentEN from './locales/en/serviceAgent.json';
import eventsEN from './locales/en/events.json';
import agentWorldEN from './locales/en/agentWorld.json';

import commonZH from './locales/zh-CN/common.json';
import authZH from './locales/zh-CN/auth.json';
import messagingZH from './locales/zh-CN/messaging.json';
import documentsZH from './locales/zh-CN/documents.json';
import wikiZH from './locales/zh-CN/wiki.json';
import forumZH from './locales/zh-CN/forum.json';
import feedZH from './locales/zh-CN/feed.json';
import mcpZH from './locales/zh-CN/mcp.json';
import profileZH from './locales/zh-CN/profile.json';
import networkZH from './locales/zh-CN/network.json';
import layoutZH from './locales/zh-CN/layout.json';
import errorsZH from './locales/zh-CN/errors.json';
import validationZH from './locales/zh-CN/validation.json';
import projectZH from './locales/zh-CN/project.json';
import artifactZH from './locales/zh-CN/artifact.json';
import llmlogsZH from './locales/zh-CN/llmlogs.json';
import serviceAgentZH from './locales/zh-CN/serviceAgent.json';
import eventsZH from './locales/zh-CN/events.json';
import agentWorldZH from './locales/zh-CN/agentWorld.json';

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
                profile: profileEN,
                network: networkEN,
                layout: layoutEN,
                errors: errorsEN,
                validation: validationEN,
                project: projectEN,
                artifact: artifactEN,
                llmlogs: llmlogsEN,
                serviceAgent: serviceAgentEN,
                events: eventsEN,
                agentWorld: agentWorldEN,
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
                profile: profileZH,
                network: networkZH,
                layout: layoutZH,
                errors: errorsZH,
                validation: validationZH,
                project: projectZH,
                artifact: artifactZH,
                llmlogs: llmlogsZH,
                serviceAgent: serviceAgentZH,
                events: eventsZH,
                agentWorld: agentWorldZH,
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
