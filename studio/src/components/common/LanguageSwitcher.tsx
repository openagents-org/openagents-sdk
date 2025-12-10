import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/i18n/config';
import { getLanguageName, getLanguageFlag } from '@/i18n/utils';

interface LanguageSwitcherProps {
    className?: string;
    showFlag?: boolean;
    showFullName?: boolean;
}

/**
 * Language switcher component with dropdown
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
    className = '',
    showFlag = true,
    showFullName = false,
}) => {
    const { currentLanguage, switchLanguage } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleLanguageChange = async (language: SupportedLanguage) => {
        await switchLanguage(language);
        setIsOpen(false);
    };

    const getCurrentLanguageDisplay = () => {
        return showFlag ? getLanguageFlag(currentLanguage) + ' ' : '';
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Language selector button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors duration-200 text-xs font-medium text-gray-700 dark:text-gray-300"
                aria-label="Select language"
                title="Switch language"
            >
                <span className="text-sm">{getCurrentLanguageDisplay()}</span>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                    {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => {
                        const langCode = code as SupportedLanguage;
                        const isActive = langCode === currentLanguage;

                        return (
                            <button
                                key={code}
                                onClick={() => handleLanguageChange(langCode)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors duration-150 
                                    ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                                        'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                <span className="text-xl">{lang.flag}</span>
                                <div className="flex-1">
                                    <div className="font-medium">{lang.nativeName}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {lang.name}
                                    </div>
                                </div>
                                {isActive && (
                                    <svg
                                        className="w-5 h-5 text-blue-600 dark:text-blue-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
