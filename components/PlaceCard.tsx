import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { LoaderIcon, MuseumIcon, ParkIcon, CafeIcon, HistoricSiteIcon, ShoppingBagIcon, SparklesIcon, HeartIcon, PlayIcon, PauseIcon } from './Icons';
import type { NearbyPlace } from '../types';

export const CategoryIcon: React.FC<{ category: string, className?: string }> = ({ category, className = "w-5 h-5" }) => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('museum')) return <MuseumIcon className={className} />;
    if (lowerCategory.includes('park') || lowerCategory.includes('garden')) return <ParkIcon className={className} />;
    if (lowerCategory.includes('cafe') || lowerCategory.includes('coffee') || lowerCategory.includes('restaurant')) return <CafeIcon className={className} />;
    if (lowerCategory.includes('historic') || lowerCategory.includes('monument') || lowerCategory.includes('landmark')) return <HistoricSiteIcon className={className} />;
    if (lowerCategory.includes('shop') || lowerCategory.includes('market')) return <ShoppingBagIcon className={className} />;
    return <SparklesIcon className={className} />;
};

export const PlaceCard: React.FC<{ 
    place: NearbyPlace;
    isFavorite: boolean;
    onToggleFavorite: (name: string) => void;
    isPlaying: boolean;
    isGeneratingAudio: boolean;
    onPlayPause: (place: NearbyPlace) => void;
}> = ({ place, isFavorite, onToggleFavorite, isPlaying, isGeneratingAudio, onPlayPause }) => {
    const { t } = useTranslation();

    const capitalizedCategory = place.category ? place.category.charAt(0).toUpperCase() + place.category.slice(1) : '';

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col transition-transform duration-300 hover:scale-105 relative">
            <button 
                onClick={() => onToggleFavorite(place.name)}
                className="absolute top-2 right-2 z-20 p-1.5 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors"
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
                <HeartIcon className={`w-5 h-5 ${isFavorite ? 'text-red-500 fill-current' : 'fill-none'}`} />
            </button>
            <div className="relative w-full h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {isGeneratingAudio && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-2 z-10">
                        <LoaderIcon className="w-8 h-8 animate-spin mb-2" />
                        <p className="text-sm text-center font-semibold">{t('generatingAudioMessage')}</p>
                    </div>
                )}
                {place.imageUrl ? (
                    // Check if it's a URL or base64 data
                    place.imageUrl.startsWith('http') ?
                    <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover" /> :
                    <img src={`data:image/png;base64,${place.imageUrl}`} alt={place.name} className="w-full h-full object-cover" />
                ) : (
                    <LoaderIcon className="w-8 h-8 text-gray-400 animate-spin" />
                )}
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <div className="flex items-center gap-2 mb-2">
                    <CategoryIcon category={place.category} />
                    <span className="text-xs font-semibold bg-brand-lightblue text-brand-dark px-2 py-1 rounded-full">{capitalizedCategory}</span>
                </div>
                <h3 className="font-bold text-lg text-brand-dark dark:text-white mb-2">{place.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 flex-grow">{place.description}</p>
                <div className="mt-4 flex items-center justify-between">
                    <a 
                        href={place.mapUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-brand-blue dark:text-brand-lightblue hover:underline"
                    >
                        {t('viewOnMap')}
                    </a>
                    <button
                        onClick={() => onPlayPause(place)}
                        className="p-2 bg-brand-lightblue text-brand-dark rounded-full hover:bg-brand-blue hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
                        aria-label={isPlaying ? t('pauseNearbyAudioAriaLabel', { placeName: place.name }) : t('playNearbyAudioAriaLabel', { placeName: place.name })}
                        disabled={isGeneratingAudio}
                    >
                        {isPlaying ? (
                            <PauseIcon className="w-5 h-5" />
                        ) : (
                            <PlayIcon className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const SkeletonCard: React.FC = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        <div className="p-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2 animate-pulse"></div>
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-3 animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mt-1 animate-pulse"></div>
            <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mt-4 animate-pulse"></div>
        </div>
    </div>
);