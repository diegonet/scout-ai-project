import React, { useState, useEffect } from 'react';
import type { LandmarkData } from '../types';
import { audioPlayer } from '../utils/audio';
import { fetchFunFact } from '../services/geminiService';
import { Chatbot } from './Chatbot';
// Fix: Replaced InstagramIcon with a more appropriate ClipboardIcon for the copy-to-clipboard functionality.
import { PlayIcon, PauseIcon, ArrowLeftIcon, GlobeAltIcon, LightBulbIcon, LoaderIcon, CheckIcon, WhatsAppIcon, XIcon, ClipboardIcon, ChatBubbleLeftRightIcon } from './Icons';
import { useTranslation } from '../contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../utils/translations';

/**
 * Props for the ResultDisplay component.
 */
interface ResultDisplayProps {
  data: LandmarkData;
  onReset: () => void;
  isTranslating: boolean;
}

/**
 * A component that displays the detailed results after a landmark has been identified.
 * It features the landmark's image, history (audio guide), controls for audio playback,
 * fun fact fetching, sharing options, and an integrated chatbot.
 * @param {ResultDisplayProps} props - The component props.
 */
export const ResultDisplay: React.FC<ResultDisplayProps> = ({ 
    data,
    onReset,
    isTranslating 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [funFact, setFunFact] = useState<string | null>(null);
  const [isFetchingFunFact, setIsFetchingFunFact] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { language, t } = useTranslation();

  const handlePlayPause = async () => {
    if (audioPlayer.isPlaying) {
      audioPlayer.stop();
      setIsPlaying(false);
    } else {
      try {
        setIsPlaying(true);
        await audioPlayer.play(data.audioData, () => {
          setIsPlaying(false);
        });
      } catch (error) {
        console.error("Failed to play audio:", error);
        setIsPlaying(false);
      }
    }
  };
  
  const handleFunFact = async () => {
    if (isFetchingFunFact) return;
    setIsFetchingFunFact(true);
    setFunFact(null); 
    const langName = SUPPORTED_LANGUAGES.find(l => l.code === language)?.name || 'English';
    try {
      const fact = await fetchFunFact(data.name, langName);
      setFunFact(fact);
    } catch (error) {
      console.error("Failed to fetch fun fact:", error);
      setFunFact(t('errorFunFact'));
    } finally {
      setIsFetchingFunFact(false);
    }
  };

  /**
   * Copies the landmark's name and history to the user's clipboard for sharing.
   * Provides visual feedback on success.
   */

  const handleCopyToClipboard = async () => {
    const shareText = t('shareText', { landmarkName: data.name, history: data.history });
    try {
      await navigator.clipboard.writeText(shareText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy to clipboard', error);
      alert(t('errorCopy'));
    }
  };

  const shareTextContent = t('shareText', { landmarkName: data.name, history: data.history });
  const encodedShareText = encodeURIComponent(shareTextContent);

  const whatsappShareUrl = `https://wa.me/?text=${encodedShareText}`;
  const xShareUrl = `https://twitter.com/intent/tweet?text=${encodedShareText}`;
  
  /**
   * Stops audio playback when the component unmounts.
   */
  useEffect(() => {
    return () => {
      audioPlayer.stop();
    };
  }, []);

  useEffect(() => {
    if (isTranslating && audioPlayer.isPlaying) {
        audioPlayer.stop();
        setIsPlaying(false);
    }
  }, [isTranslating]);
  
  useEffect(() => {
    setFunFact(null);
  }, [language]);


  return (
    <div className="bg-white dark:bg-gray-800 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
      {/* Image Container */}
      <div className="relative w-full h-[350px]">
         <button 
          onClick={onReset}
          className="absolute top-4 left-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-colors">
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        <img src={data.userImageUrl} alt={t('altUserImage', { landmarkName: data.name })} className="w-full h-full object-cover" />
        <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-black/80 to-transparent p-6 flex items-end">
           <h2 className="text-3xl md:text-4xl font-bold text-white shadow-lg">{data.name}</h2>
        </div>
      </div>

      {/* Content Container */}
      <div className="w-full p-4 sm:p-6 md:p-8 flex flex-col">
        <div className="flex-grow relative">
            {isTranslating && (
                <div className="absolute inset-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
                    <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-brand-dark dark:text-white font-semibold">{t('translating')}</p>
                </div>
            )}
            <div className="flex items-center mb-6">
                <h3 className="text-2xl font-bold text-brand-dark dark:text-white">{t('audioGuideTitle')}</h3>
                <button
                    onClick={handlePlayPause}
                    disabled={isTranslating}
                    className="ml-4 p-3 bg-brand-blue text-white rounded-full hover:bg-brand-dark transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                    aria-label={isPlaying ? t('pauseAriaLabel') : t('playAriaLabel')}
                >
                    {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                </button>
            </div>
            <div className="prose max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
              {data.history.split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-brand-dark dark:text-white mb-4 text-center">{t('shareTitle')}</h4>
              <div className="flex flex-wrap justify-center gap-4">
                  <a
                      href={whatsappShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label={t('shareOnWhatsAppAriaLabel')}
                      title={t('shareOnWhatsAppAriaLabel')}
                  >
                      <WhatsAppIcon className="w-6 h-6" />
                  </a>
                  <a
                      href={xShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label={t('shareOnXAriaLabel')}
                      title={t('shareOnXAriaLabel')}
                  >
                      <XIcon className="w-6 h-6" />
                  </a>
                  <button
                      onClick={handleCopyToClipboard}
                      className={`inline-flex items-center justify-center p-3 border rounded-full transition-colors ${isCopied ? 'border-green-300 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      aria-label={t('copyInfoAriaLabel')}
                      title={t('copyInfoAriaLabel')}
                  >
                      {/* Fix: Replaced InstagramIcon with ClipboardIcon for better semantics. */}
                      {isCopied ? <CheckIcon className="w-6 h-6" /> : <ClipboardIcon className="w-6 h-6" />}
                  </button>
              </div>
            </div>
            
            <div className="mt-6 text-center">
                <button
                    onClick={handleFunFact}
                    disabled={isFetchingFunFact || isTranslating}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-amber-500 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {isFetchingFunFact ? (
                        <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <LightBulbIcon className="w-5 h-5 mr-2" />
                    )}
                    {isFetchingFunFact ? t('funFactLoadingButton') : t('funFactButton')}
                </button>
            </div>

            {funFact && (
                <div className="mt-4 p-4 bg-brand-lightblue/50 dark:bg-brand-blue/20 border-l-4 border-brand-blue rounded-r-lg animate-fade-in">
                    <p className="text-brand-dark dark:text-sky-200 italic">{funFact}</p>
                </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold text-brand-dark dark:text-white mb-4 flex items-center">
                    <ChatBubbleLeftRightIcon className="w-6 h-6 mr-2"/>
                    {t('chatbotTitle')}
                </h4>
                <Chatbot landmarkName={data.name} />
            </div>

            

        </div>
      </div>
    </div>
  );
};