import React, { useState, useEffect, useMemo } from 'react';
import { getCountries, getCities, getTopPlaces } from '../services/firestoreService';
import { generateAudioForText, translatePlaceDetails } from '../services/geminiService';
import { useTranslation } from '../contexts/LanguageContext';
import { audioPlayer } from '../utils/audio';
import { StarIcon, HeartIcon, SearchIcon, LoaderIcon } from './Icons';
import { PlaceCard, SkeletonCard } from './PlaceCard';
import { SearchableDropdown } from './SearchableDropdown';
import type { NearbyPlace } from '../types';
import { SUPPORTED_LANGUAGES } from '../utils/translations';

const FAVORITES_KEY = 'scout-ai-favorites';
const FILTER_KEYS = ['All', 'Favorites', 'Museum', 'Park', 'Restaurant', 'HistoricSite', 'Cafe', 'Shopping', 'Landmark'];

/**
 * Maps a raw place type from Firestore (e.g., 'museum', 'point_of_interest')
 * to one of the app's standard, language-independent filter keys (e.g., 'Museum', 'Landmark').
 * @param rawType The raw category string from the data source.
 * @returns A standardized category key string.
 */
const getCategoryKeyFromRawType = (rawType: string): string => {
    if (!rawType) return 'Landmark';
    const type = rawType.toLowerCase();
    
    // Ordered by specificity
    if (type.includes('museum')) return 'Museum';
    if (type.includes('park')) return 'Park';
    if (type.includes('restaurant')) return 'Restaurant';
    if (type.includes('cafe')) return 'Cafe';
    if (type.includes('shopping') || type.includes('store') || type.includes('market')) return 'Shopping';
    if (type.includes('historic') || type.includes('church') || type.includes('mosque') || type.includes('synagogue') || type.includes('castle') || type.includes('place_of_worship')) return 'HistoricSite';
    if (type.includes('landmark') || type.includes('tourist_attraction') || type.includes('point_of_interest')) return 'Landmark';
    
    return 'Landmark'; // Broad fallback
};


export const TopPlaces: React.FC = () => {
    const [loadingState, setLoadingState] = useState<'loadingCountries' | 'loadingCities' | 'loadingPlaces' | 'idle'>('loadingCountries');
    const [countries, setCountries] = useState<string[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [selectedCountry, setSelectedCountry] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [playingPlace, setPlayingPlace] = useState<string | null>(null);
    const [loadingAudioFor, setLoadingAudioFor] = useState<string | null>(null);
    const [activeFilterKey, setActiveFilterKey] = useState('All');
    const { t, language } = useTranslation();

    // Load favorites from local storage on mount
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

    // Fetch countries on mount
    useEffect(() => {
        const fetchCountries = async () => {
            setLoadingState('loadingCountries');
            setError(null);
            try {
                const countryList = await getCountries();
                console.log(countryList)
                setCountries(countryList.sort());
            } catch (err) {
                setError(t('errorTopPlaces'));
                console.error("Firestore error fetching countries:", err);
            } finally {
                setLoadingState('idle');
            }
        };
        fetchCountries();
    }, [t]);

    // Fetch cities when a country is selected
    useEffect(() => {
        if (!selectedCountry) {
            setCities([]);
            setSelectedCity('');
            setPlaces(null);
            return;
        }
        const fetchCities = async () => {
            setLoadingState('loadingCities');
            setError(null);
            setPlaces(null);
            setSelectedCity('');
            try {
                const cityList = await getCities(selectedCountry);
                setCities(cityList.sort());
            } catch (err) {
                setError(t('errorTopPlaces'));
                 console.error("Firestore error fetching cities:", err);
            } finally {
                setLoadingState('idle');
            }
        };
        fetchCities();
    }, [selectedCountry, t]);
    
    // Stop audio when changing selections
    useEffect(() => {
        return () => {
            audioPlayer.stop();
        }
    }, [selectedCity, selectedCountry, language]);

    const handleSearch = async () => {
        if (!selectedCountry || !selectedCity) {
            setPlaces(null);
            return;
        }
        
        setLoadingState('loadingPlaces');
        setError(null);
        setPlaces(null);
        try {
            // Step 1: Get place data from Firestore (which is in English)
            const originalPlaceList = await getTopPlaces(selectedCountry, selectedCity);
            
            if (originalPlaceList.length === 0) {
                setPlaces([]);
                setLoadingState('idle');
                return;
            }

            // Step 2: Translate place names and descriptions if the language is not English
            const langName = SUPPORTED_LANGUAGES.find(l => l.code === language)?.name || 'English';
            const translatedDetails = await translatePlaceDetails(
                originalPlaceList.map(p => ({ name: p.name, description: p.description })),
                langName
            );

            // Step 3: Set the places in state. Audio will be generated on demand.
            const translatedPlaceList = originalPlaceList.map((place, index) => ({
                ...place,
                name: translatedDetails[index]?.name || place.name,
                description: translatedDetails[index]?.description || place.description,
                audioData: undefined,
            }));

            setPlaces(translatedPlaceList);
        } catch (err) {
            setError(t('errorTopPlaces'));
            console.error("Firestore error fetching places:", err);
            setPlaces([]);
        } finally {
            setLoadingState('idle');
        }
    };

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
        if (loadingAudioFor) return;

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
            setLoadingAudioFor(placeToPlay.name);
            setPlayingPlace(null);

            const audioData = await generateAudioForText(placeToPlay.description, language);

            setPlaces(currentPlaces => {
                if (!currentPlaces) return null;
                return currentPlaces.map(p => 
                    p.name === placeToPlay.name ? { ...p, audioData } : p
                );
            });

            await audioPlayer.play(audioData, () => setPlayingPlace(null));
            setPlayingPlace(placeToPlay.name);

        } catch (e) {
            console.error(`Audio generation failed for ${placeToPlay.name}:`, e);
            setError(`Audio generation failed for ${placeToPlay.name}.`);
        } finally {
            setLoadingAudioFor(null);
        }
    };


    const countryOptions = useMemo(() => {
        return countries.map(c => ({
            value: c,
            label: c.charAt(0).toUpperCase() + c.slice(1) // Capitalize for display
        }));
    }, [countries]);

    const filteredPlaces = useMemo(() => {
        if (!places) return [];
        if (activeFilterKey === 'Favorites') {
            return places.filter(place => favorites.has(place.name));
        }
        if (activeFilterKey === 'All') return places;
        
        return places.filter(place => {
            const placeCategoryKey = getCategoryKeyFromRawType(place.category);
            return placeCategoryKey === activeFilterKey;
        });
    }, [places, activeFilterKey, favorites]);
    
    const renderContent = () => {
        if (loadingState === 'loadingPlaces') {
            return (
                <div className="w-full max-w-4xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                </div>
            );
        }

        if (places) {
             return (
                <div className="w-full max-w-4xl text-left animate-fade-in">
                    <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                        {FILTER_KEYS.map(key => (
                            <button key={key} onClick={() => setActiveFilterKey(key)}
                                className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 flex items-center gap-2 ${activeFilterKey === key ? 'bg-brand-blue text-white shadow-md' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-brand-lightblue/50 dark:hover:bg-gray-600/50'}`}>
                                {key === 'Favorites' && <HeartIcon className="w-4 h-4" />}
                                {t(key === 'All' ? 'allCategoriesFilter' : key === 'Favorites' ? 'favoritesFilter' : `category${key}`)}
                            </button>
                        ))}
                    </div>
                    {filteredPlaces.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPlaces.map((place) => {
                                const categoryKey = getCategoryKeyFromRawType(place.category);
                                const displayPlace = {
                                    ...place,
                                    category: t(`category${categoryKey}`),

                                };

                                return (
                                    <PlaceCard 
                                        key={place.name} 
                                        place={displayPlace} 
                                        isFavorite={favorites.has(place.name)}
                                        onToggleFavorite={handleToggleFavorite}
                                        isPlaying={playingPlace === place.name}
                                        isGeneratingAudio={loadingAudioFor === place.name}
                                        onPlayPause={() => handlePlayPause(place)}
                                    />
                                );
                            })}
                        </div>
                     ) : (
                        <div className="text-center py-10">
                            <p className="text-gray-600 dark:text-gray-400">
                                {activeFilterKey === 'Favorites' ? t('noFavorites') : t('noPlacesInCategory')}
                            </p>
                        </div>
                     )}
                </div>
             );
        }
        return null;
    }

    return (
        <div className="p-4 w-full flex flex-col items-center justify-center">
            <div className="text-center p-4 sm:p-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-4xl animate-fade-in flex flex-col justify-center mb-8">
                <StarIcon className="w-16 h-16 mx-auto text-brand-blue mb-4" />
                <h1 className="text-3xl font-bold text-brand-dark dark:text-white mb-2">{t('topPlacesTitle')}</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">{t('topPlacesDescription')}</p>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg mx-auto">
                    <div className="flex-1">
                       <SearchableDropdown
                            options={countryOptions}
                            value={selectedCountry}
                            onChange={setSelectedCountry}
                            placeholder={t('selectCountryPlaceholder')}
                            disabled={loadingState !== 'idle' || countries.length === 0}
                        />
                    </div>
                     <div className="flex-1 relative">
                        <select
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                            disabled={!selectedCountry || loadingState !== 'idle'}
                            className="w-full appearance-none p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        >
                            <option value="">{t('selectCityPlaceholder')}</option>
                            {cities.map(c => (
                                <option key={c} value={c}>
                                    {c.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700 dark:text-gray-300">
                           <svg className="fill-current h-4 w-4" xmlns="http://www.w.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>
                 <div className="mt-6 flex justify-center">
                    <button
                        onClick={handleSearch}
                        disabled={!selectedCity || loadingState !== 'idle'}
                        className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-brand-blue text-white font-bold text-base rounded-full shadow-lg hover:bg-brand-dark transform hover:scale-105 transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        <SearchIcon className="w-5 h-5 mr-2" />
                        {t('findTopPlacesButton')}
                    </button>
                </div>
                 {error && <p className="text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-lg mt-4">{error}</p>}
            </div>
            {renderContent()}
        </div>
    );
};