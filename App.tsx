import React, { useState, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { LoadingState } from './components/LoadingState';
import { ResultDisplay } from './components/ResultDisplay';
import { TourPlanner } from './components/ImageGenerator';
import { NearbyPlaces } from './components/NearbyPlaces';
import { TopPlaces } from './components/TopPlaces';
import { identifyLandmark } from './services/geminiService';
import type { LandmarkData } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { useTheme } from './contexts/ThemeContext';
import { CameraIcon, CalendarDaysIcon, MapPinIcon, SunIcon, MoonIcon, StarIcon, QuestionMarkCircleIcon, XIcon } from './components/Icons';
import { SUPPORTED_LANGUAGES } from './utils/translations';


type AppState = 'idle' | 'loading' | 'result';
type ActiveView = 'landmark' | 'planner' | 'nearby' | 'topPlaces';

const LanguageSelector: React.FC<{ disabled: boolean }> = ({ disabled }) => {
    const { language, changeLanguage } = useTranslation();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        changeLanguage(e.target.value);
    };
    
    return (
        <div className="relative">
            <select
                value={language}
                onChange={handleChange}
                disabled={disabled}
                className="appearance-none bg-white/30 border-none rounded-full py-3 pl-5 pr-12 text-base font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code} className="text-black">
                        {lang.name}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white">
                <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
    );
};

const ThemeToggle: React.FC<{ disabled: boolean }> = ({ disabled }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            disabled={disabled}
            className="p-3 rounded-full bg-white/30 text-white hover:bg-white/50 transition-colors disabled:opacity-50"
            aria-label="Toggle dark mode"
        >
            {theme === 'light' ? (
                <MoonIcon className="w-7 h-7" />
            ) : (
                <SunIcon className="w-7 h-7" />
            )}
        </button>
    );
};

const HelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 relative"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
                    aria-label={t('helpModalCloseButtonAriaLabel')}
                >
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-3xl font-bold text-brand-dark dark:text-white mb-6">{t('helpModalTitle')}</h2>
                
                <div className="space-y-6 text-gray-700 dark:text-gray-300">
                    <div>
                        <h3 className="font-semibold text-lg text-brand-blue dark:text-brand-lightblue mb-2">{t('helpModalGuideTitle')}</h3>
                        <p>{t('helpModalGuideContent')}</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-brand-blue dark:text-brand-lightblue mb-2">{t('helpModalPlannerTitle')}</h3>
                        <p>{t('helpModalPlannerContent')}</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-brand-blue dark:text-brand-lightblue mb-2">{t('helpModalNearbyTitle')}</h3>
                        <p>{t('helpModalNearbyContent')}</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-brand-blue dark:text-brand-lightblue mb-2">{t('helpModalTopPlacesTitle')}</h3>
                        <p>{t('helpModalTopPlacesContent')}</p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                    <h3 className="font-semibold text-base text-brand-dark dark:text-white mb-3">{t('helpModalContactTitle')}</h3>
                    <p>{t('helpModalContactContent')}</p>
                    <a href="https://docs.google.com/document/d/1D_qu9yI1veDv8TusSGIVFtdtDYjMNT_s49WCG6rkj64/edit" target="_blank" rel="noopener noreferrer" className="text-brand-blue dark:text-brand-lightblue hover:underline mt-2 inline-block">
                        {t('helpModalMoreInfoLink')}
                    </a>
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [activeView, setActiveView] = useState<ActiveView>('landmark');
  const [landmarkData, setLandmarkData] = useState<LandmarkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const { t, language } = useTranslation();
  const [isInitialMount, setIsInitialMount] = useState(true);
  const mainRef = useRef<HTMLElement>(null);

  const handleImageSelect = async (file: File) => {
    setAppState('loading');
    setError(null);
    setLandmarkData(null);
    try {
      const result = await identifyLandmark(file, language, setLoadingMessage);
      const userImageUrl = URL.createObjectURL(file);
      setLandmarkData({ ...result, userImageUrl });
      setAppState('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errorProcessing');
      setError(message);
      setAppState('idle');
    } finally {
        setLoadingMessage('');
    }
  };
  
  const handleReset = () => {
    setAppState('idle');
    setLandmarkData(null);
    setError(null);
    if (landmarkData?.userImageUrl) {
        URL.revokeObjectURL(landmarkData.userImageUrl);
    }
  };

  useEffect(() => {
    if (isInitialMount) {
        setIsInitialMount(false);
        return;
    }

    const handleLanguageChange = async () => {
        if (!landmarkData || appState !== 'result') return;
        
        setIsTranslating(true);
        setError(null);
        try {
            const response = await fetch(landmarkData.userImageUrl);
            const blob = await response.blob();
            const file = new File([blob], "landmark_image.jpg", { type: blob.type });

            const result = await identifyLandmark(file, language, () => {});
            setLandmarkData({ ...result, userImageUrl: landmarkData.userImageUrl });
        } catch (err) {
            const message = err instanceof Error ? err.message : t('errorProcessing');
            setError(message);
        } finally {
            setIsTranslating(false);
        }
    };

    handleLanguageChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // New useEffect to handle scrolling to the result view
  useEffect(() => {
    if (appState === 'result') {
        // Use a slight delay to ensure the component has rendered and the browser has had time to paint.
        setTimeout(() => {
            mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
  }, [appState]);


  const renderActiveView = () => {
    switch (activeView) {
        case 'landmark':
            return renderLandmarkFinder();
        case 'planner':
            return <TourPlanner />;
        case 'nearby':
            return <NearbyPlaces />;
        case 'topPlaces':
            return <TopPlaces />;
        default:
            return renderLandmarkFinder();
    }
  };

  const renderLandmarkFinder = () => {
    switch (appState) {
      case 'loading':
        return <LoadingState message={loadingMessage || t('loadingPreparing')} />;
      case 'result':
        return landmarkData && <ResultDisplay data={landmarkData} onReset={handleReset} isTranslating={isTranslating} />;
      case 'idle':
      default:
        return (
          <div className="text-center p-4 sm:p-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md animate-fade-in flex flex-col justify-center md:min-h-[450px]">
            <h1 className="text-4xl md:text-5xl font-extrabold text-brand-dark dark:text-white mb-4">{t('uploadTitle')}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">{t('uploadSubtitle')}</p>
            <ImageUploader onImageSelect={handleImageSelect} />
            {error && <p className="mt-4 text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-lg">{error}</p>}
          </div>
        );
    }
  };

  const TabButton: React.FC<{ view: ActiveView, icon: React.ReactNode, label: string }> = ({ view, icon, label }) => (
    <button
        onClick={() => {
            if (appState === 'loading') return;
            handleReset(); 
            setActiveView(view);
        }}
        disabled={appState === 'loading'}
        className={`flex-1 flex flex-col items-center justify-center p-3 text-sm font-semibold border-b-4 transition-colors duration-200 disabled:cursor-not-allowed ${activeView === view ? 'border-brand-blue text-brand-dark dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-brand-lightblue/50 dark:hover:bg-gray-700/50'}`}
    >
        {icon}
        <span className="mt-1">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-28 sm:pt-32 pb-24 font-sans relative">
        <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
        <div className="absolute inset-0 bg-[url('https://p.turbosquid.com/ts-thumb/4N/tGvRoh/6p/01/jpg/1656306220/1920x1080/fit_q87/6395b1b534d26bae00bd5b3311ac1b047abcb412/01.jpg')] bg-cover bg-center opacity-40"></div>
        <header className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20 bg-brand-navy shadow-lg">
            <div className="flex items-center gap-4">
                <img src="https://storage.googleapis.com/bucket-scout/scoutai.jpg" alt="Scout AI Logo" className="h-20 w-auto" />
                <p className="hidden md:block text-xl font-light text-white/90 tracking-widest">
                    <b>EXPLORE, PLAN AND DISCOVER!!</b>
                </p>
            </div>
            <div className="flex items-center gap-4">
                <LanguageSelector disabled={appState === 'loading' || isTranslating} />
                <ThemeToggle disabled={appState === 'loading' || isTranslating} />
                <button
                    onClick={() => setIsHelpModalOpen(true)}
                    disabled={appState === 'loading' || isTranslating}
                    className="p-3 rounded-full bg-white/30 text-white hover:bg-white/50 transition-colors disabled:opacity-50"
                    aria-label={t('helpButtonAriaLabel')}
                >
                    <QuestionMarkCircleIcon className="w-7 h-7" />
                </button>
            </div>
        </header>

        <main ref={mainRef} className="relative z-10 flex-grow flex flex-col items-center justify-center w-full">
            {renderActiveView()}
        </main>
        
        <footer className="fixed bottom-0 left-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-top z-20">
             <div className="max-w-lg mx-auto flex">
                <TabButton view="landmark" icon={<CameraIcon className="w-6 h-6" />} label={t('landmarkTabTitle')} />
                <TabButton view="planner" icon={<CalendarDaysIcon className="w-6 h-6" />} label={t('tourPlannerTabTitle')} />
                <TabButton view="nearby" icon={<MapPinIcon className="w-6 h-6" />} label={t('nearbyPlacesTabTitle')} />
                <TabButton view="topPlaces" icon={<StarIcon className="w-6 h-6" />} label={t('topPlacesTabTitle')} />
             </div>
        </footer>
    </div>
  );
};

export default App;