import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { findNearbyPlaces, generateImageForPlace, generateAudioForText } from '../services/geminiService';
import { useTranslation } from '../contexts/LanguageContext';
import { audioPlayer } from '../utils/audio';
import { GlobeAltIcon, LoaderIcon, MapPinIcon, HeartIcon, SparklesIcon, ArrowPathIcon } from './Icons';
import { PlaceCard, SkeletonCard } from './PlaceCard';
import type { NearbyPlace } from '../types';

// --- Session Cache for Nearby Places ---
// Caches the fetched places with images for the duration of the user's session
// to avoid re-fetching and re-generating images when switching tabs.
let sessionCache: {
    places: NearbyPlace[];
    language: string;
    hasMore: boolean;
    coordinates: { lat: number; lon: number };
} | null = null;


// --- Location Caching Utilities ---
const LOCATION_STORAGE_KEY = 'scout-ai-location';
const LOCATION_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

interface StoredLocation {
    lat: number;
    lon: number;
    timestamp: number;
}

/**
 * Saves the user's location and a timestamp to local storage.
 */
const saveLocation = (lat: number, lon: number): void => {
    const locationData: StoredLocation = {
        lat,
        lon,
        timestamp: Date.now(),
    };
    try {
        window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationData));
    } catch (error) {
        console.error("Failed to save location to local storage", error);
    }
};

/**
 * Retrieves the user's location from local storage if it's not expired.
 * If it's expired, it's removed from storage.
 * @returns The stored location object or null if not found or expired.
 */
const getValidLocation = (): StoredLocation | null => {
    try {
        const storedData = window.localStorage.getItem(LOCATION_STORAGE_KEY);
        if (!storedData) {
            return null;
        }

        const locationData: StoredLocation = JSON.parse(storedData);
        const isExpired = (Date.now() - locationData.timestamp) > LOCATION_EXPIRATION_MS;

        if (isExpired) {
            window.localStorage.removeItem(LOCATION_STORAGE_KEY);
            return null;
        }

        return locationData;

    } catch (error) {
        console.error("Failed to retrieve location from local storage", error);
        return null;
    }
};
// --- End Location Caching Utilities ---

const FILTER_KEYS = ['All', 'Favorites', 'Museum', 'Park', 'Restaurant', 'HistoricSite', 'Cafe', 'Shopping', 'Landmark'];
const FAVORITES_KEY = 'scout-ai-favorites';


export const NearbyPlaces: React.FC = () => {
    const [loadingState, setLoadingState] = useState<'idle' | 'gettingLocation' | 'findingPlaces' | 'generatingImages'>('idle');
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
    const [activeFilterKey, setActiveFilterKey] = useState('All');
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [playingPlace, setPlayingPlace] = useState<string | null>(null);
    const [generatingAudioFor, setGeneratingAudioFor] = useState<string | null>(null);
    const { language, t } = useTranslation();

    useEffect(() => {
        try {
            const storedFavorites = window.localStorage.getItem(FAVORITES_KEY);
            if (storedFavorites) {
                setFavorites(new Set(JSON.parse(storedFavorites)));
            }
        } catch (error) {
            console.error("Failed to load favorites from local storage", error);
        }
    }, []);

    const handleToggleFavorite = (placeName: string) => {
        const newFavorites = new Set(favorites);
        if (newFavorites.has(placeName)) {
            newFavorites.delete(placeName);
        } else {
            newFavorites.add(placeName);
        }
        setFavorites(newFavorites);
        try {
            window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(newFavorites)));
        } catch (error) {
            console.error("Failed to save favorites to local storage", error);
        }
    };
    
    const handlePlayPause = async (placeToPlay: NearbyPlace) => {
        if (generatingAudioFor) return;

        if (playingPlace === placeToPlay.name) {
            audioPlayer.stop();
            setPlayingPlace(null);
            return;
        }

        audioPlayer.stop();

        if (placeToPlay.audioData) {
            await audioPlayer.play(placeToPlay.audioData, () => setPlayingPlace(null));
            setPlayingPlace(placeToPlay.name);
            return;
        }

        // Generate audio on demand
        try {
            setGeneratingAudioFor(placeToPlay.name);
            setPlayingPlace(null);

            const audioData = await generateAudioForText(placeToPlay.description, language);

            const updatePlacesAndCache = (updatedPlaces: NearbyPlace[]) => {
                setPlaces(updatedPlaces);
                if (sessionCache) {
                    sessionCache.places = updatedPlaces;
                }
            };

            setPlaces(currentPlaces => {
                if (!currentPlaces) return null;
                const updated = currentPlaces.map(p => 
                    p.name === placeToPlay.name ? { ...p, audioData } : p
                );
                updatePlacesAndCache(updated);
                return updated;
            });

            await audioPlayer.play(audioData, () => setPlayingPlace(null));
            setPlayingPlace(placeToPlay.name);

        } catch (e) {
            console.error(`Audio generation failed for ${placeToPlay.name}:`, e);
            setError(`Audio generation failed for ${placeToPlay.name}.`);
        } finally {
            setGeneratingAudioFor(null);
        }
    };

    const fetchAndDisplayPlaces = useCallback(async (latitude: number, longitude: number) => {
        try {
            setLoadingState('findingPlaces');
            const fetchedPlaces = await findNearbyPlaces(latitude, longitude, language);

            if (fetchedPlaces.length === 0) {
                setPlaces([]);
                setError(t('errorNearby'));
                setLoadingState('idle');
                setHasMore(false);
                return;
            }

            setPlaces(fetchedPlaces.map(p => ({ ...p, imageUrl: undefined, audioData: undefined })));
            setLoadingState('generatingImages');
            
            const imageGenerationPromises = fetchedPlaces.map(place =>
                generateImageForPlace(place.name, place.category).catch(e => {
                    console.error(`Image generation failed for ${place.name}:`, e);
                    return undefined;
                })
            );

            const imageGenerationResults = await Promise.all(imageGenerationPromises);

            const finalPlaces = fetchedPlaces.map((place, index) => ({
                ...place,
                imageUrl: imageGenerationResults[index] as string | undefined,
                audioData: undefined, // Audio is generated on demand
            }));
            
            setPlaces(finalPlaces);
            
            sessionCache = {
                places: finalPlaces,
                language,
                hasMore: true,
                coordinates: { lat: latitude, lon: longitude }
            };

            setLoadingState('idle');
        } catch (err) {
            const message = err instanceof Error ? err.message : t('errorUnknown');
            setError(`${t('errorNearby')} ${message}`);
            setLoadingState('idle');
        }
    }, [language, t]);
    
    useEffect(() => {
        if (sessionCache && sessionCache.language === language) {
            setPlaces(sessionCache.places);
            setHasMore(sessionCache.hasMore);
            setCoordinates(sessionCache.coordinates);
            setLoadingState('idle');
            setError(null);
            return;
        }

        const validLocation = getValidLocation();
        if (validLocation) {
            setPlaces(null);
            setError(null);
            setHasMore(true);
            setActiveFilterKey('All');
            setCoordinates({ lat: validLocation.lat, lon: validLocation.lon });
            fetchAndDisplayPlaces(validLocation.lat, validLocation.lon);
        }
    }, [language, t, fetchAndDisplayPlaces]);
    
    useEffect(() => {
        // Stop audio when component unmounts or language changes
        return () => {
            audioPlayer.stop();
        }
    }, [language]);


    const handleFindPlaces = () => {
        if (loadingState !== 'idle') return;
        
        sessionCache = null;

        setError(null);
        setPlaces(null);
        setHasMore(true);
        setActiveFilterKey('All');
        setPlayingPlace(null);
        setLoadingState('gettingLocation');

        if (!navigator.geolocation) {
            setError(t('errorLocation'));
            setLoadingState('idle');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                saveLocation(latitude, longitude);
                setCoordinates({ lat: latitude, lon: longitude });
                fetchAndDisplayPlaces(latitude, longitude);
            },
            () => {
                setError(t('errorLocation'));
                setLoadingState('idle');
            }
        );
    };

    const handleLoadMore = async () => {
        if (isLoadingMore || !coordinates || !places) return;

        setIsLoadingMore(true);
        setError(null);

        try {
            const existingPlaceNames = places.map(p => p.name);
            const newFetchedPlaces = await findNearbyPlaces(coordinates.lat, coordinates.lon, language, existingPlaceNames);

            if (newFetchedPlaces.length === 0) {
                setHasMore(false);
                if (sessionCache) sessionCache.hasMore = false;
                setIsLoadingMore(false);
                return;
            }

            const newPlacesWithPlaceholders = newFetchedPlaces.map(p => ({ ...p, imageUrl: undefined, audioData: undefined }));
            const newPlacesStartIndex = places.length;
            setPlaces(currentPlaces => [...(currentPlaces || []), ...newPlacesWithPlaceholders]);

            const imageGenerationPromises = newFetchedPlaces.map(place =>
                generateImageForPlace(place.name, place.category).catch(e => {
                    console.error(`Image generation failed for ${place.name}:`, e);
                    return undefined;
                })
            );
            
            const imageGenerationResults = await Promise.all(imageGenerationPromises);

            setPlaces(currentPlaces => {
                if (!currentPlaces) return null;
                const updatedPlaces = [...currentPlaces];
                newFetchedPlaces.forEach((_, index) => {
                    const targetIndex = newPlacesStartIndex + index;
                    if (updatedPlaces[targetIndex]) {
                        updatedPlaces[targetIndex].imageUrl = imageGenerationResults[index] as string | undefined;
                    }
                });
                
                if (sessionCache) {
                    sessionCache.places = updatedPlaces;
                }
                return updatedPlaces;
            });

        } catch (err) {
            const message = err instanceof Error ? err.message : t('errorUnknown');
            setError(message);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const filteredPlaces = useMemo(() => {
        if (!places) return [];
        
        if (activeFilterKey === 'Favorites') {
            return places.filter(place => favorites.has(place.name));
        }
        
        if (activeFilterKey === 'All') return places;

        const translatedCategory = t(`category${activeFilterKey}`);
        return places.filter(place => place.category === translatedCategory);
    }, [places, activeFilterKey, t, favorites]);


    const isLoading = loadingState !== 'idle';

    const renderContent = () => {
        if (isLoading || (places === null && loadingState !== 'idle')) {
             return (
                <div className="w-full max-w-4xl">
                    <div className="text-center mb-6">
                        <LoaderIcon className="w-12 h-12 text-brand-blue mx-auto animate-spin" />
                        <p className="mt-4 text-lg font-semibold text-brand-dark dark:text-white">
                            {t(loadingState)}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                </div>
            );
        }
        
        if (places) {
            return (
                <div className="w-full max-w-4xl text-left animate-fade-in">
                    <h1 className="text-3xl font-bold text-brand-dark dark:text-white mb-2 text-center">{t('nearbyPlacesTitle')}</h1>
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6 italic">{t('nearbyImageDisclaimer')}</p>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                        {FILTER_KEYS.map(key => {
                            const isActive = activeFilterKey === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setActiveFilterKey(key)}
                                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 flex items-center gap-2
                                        ${isActive 
                                            ? 'bg-brand-blue text-white shadow-md' 
                                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-brand-lightblue/50 dark:hover:bg-gray-600/50'
                                        }
                                    `}
                                >
                                    {key === 'Favorites' && <HeartIcon className="w-4 h-4" />}
                                    {t(key === 'All' ? 'allCategoriesFilter' : key === 'Favorites' ? 'favoritesFilter' : `category${key}`)}
                                </button>
                            )
                        })}
                    </div>


                     {filteredPlaces.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPlaces.map((place) => (
                                <PlaceCard 
                                    key={place.name} 
                                    place={place} 
                                    isFavorite={favorites.has(place.name)}
                                    onToggleFavorite={handleToggleFavorite}
                                    isPlaying={playingPlace === place.name}
                                    isGeneratingAudio={generatingAudioFor === place.name}
                                    onPlayPause={handlePlayPause}
                                />
                            ))}
                        </div>
                     ) : (
                        <div className="text-center py-10">
                            <p className="text-gray-600 dark:text-gray-400">
                                {activeFilterKey === 'Favorites' ? t('noFavorites') : t('noPlacesInCategory')}
                            </p>
                        </div>
                     )}

                    <div className="mt-8 text-center">
                        {error ? (
                            <div className="w-full flex flex-col items-center">
                                <p className="text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-lg mb-4 w-full max-w-md">{error}</p>
                                <button
                                    onClick={handleFindPlaces}
                                    disabled={isLoading}
                                    className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-brand-blue text-white font-bold text-base rounded-full shadow-lg hover:bg-brand-dark transform hover:scale-105 transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    <ArrowPathIcon className="w-5 h-5 mr-2" />
                                    {t('retryButton')}
                                </button>
                            </div>
                        ) : (
                            hasMore && activeFilterKey === 'All' ? (
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-brand-blue text-white font-bold text-base rounded-full shadow-lg hover:bg-brand-dark transform hover:scale-105 transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                                            {t('loadingMoreButton')}
                                        </>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-5 h-5 mr-2" />
                                            {t('loadMoreButton')}
                                        </>
                                    )}
                                </button>
                            ) : (
                                places.length > 0 && !hasMore && activeFilterKey === 'All' && <p className="text-gray-500 dark:text-gray-400">{t('noMorePlaces')}</p>
                            )
                        )}
                    </div>
                </div>
            )
        }

        return (
             <div className="text-center p-4 sm:p-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md animate-fade-in flex flex-col justify-center md:min-h-[450px]">
                <GlobeAltIcon className="w-16 h-16 mx-auto text-brand-blue mb-4" />
                <h1 className="text-3xl font-bold text-brand-dark dark:text-white mb-2">{t('nearbyPlacesTitle')}</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">{t('nearbyPlacesDescription')}</p>

                {error ? (
                    <div className="w-full">
                        <p className="text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-lg mb-4">{error}</p>
                        <button
                            onClick={handleFindPlaces}
                            disabled={isLoading}
                            className="w-full md:w-auto flex items-center justify-center px-8 py-3 bg-brand-blue text-white font-bold text-base rounded-full shadow-lg hover:bg-brand-dark transform hover:scale-105 transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            <ArrowPathIcon className="w-5 h-5 mr-2" />
                            {t('retryButton')}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleFindPlaces}
                        disabled={isLoading}
                        className="w-full md:w-auto flex items-center justify-center px-8 py-4 bg-brand-blue text-white font-bold text-lg rounded-full shadow-lg hover:bg-brand-dark transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-brand-lightblue disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        <MapPinIcon className="w-6 h-6 mr-3" />
                        {t('findPlacesButton')}
                    </button>
                )}
            </div>
        );
    }


    return (
        <div className="p-4 w-full flex flex-col items-center justify-center">
            {renderContent()}
        </div>
    );
};