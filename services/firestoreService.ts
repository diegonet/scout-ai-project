import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import type { NearbyPlace } from '../types';

// --- CONFIGURACIÓN ---
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// --- INICIALIZACIÓN DE FIREBASE ---

// 1. Inicializa la aplicación y tipa la variable 'app'
const app: FirebaseApp = initializeApp(firebaseConfig);

// 2. Obtén y exporta la instancia de Firestore
export const db: Firestore = getFirestore(app);

// Constantes de colecciones
const PLACES_COLLECTION = 'popular_places_by_country_v1';
const CITIES_SUBCOLLECTION = 'cities';

// --- FUNCIONES DE ACCESO A DATOS (Refactorizadas a v9) ---

/**
 * Fetches the list of available countries.
 * Se usa 'getDocs' en lugar de '.get()' en la referencia de la colección.
 */
export const getCountries = async (): Promise<string[]> => {
    try {
        const collectionRef = collection(db, PLACES_COLLECTION);
        const snapshot = await getDocs(collectionRef);
        
        // ✨ ¡IMPORTANTE! Imprime el ARRAY de documentos, no el objeto snapshot completo.
        console.log('Documentos encontrados (Snapshot size):', snapshot.size);
        console.log('Documentos (Docs Array):', snapshot.docs); 
        
        // Si snapshot.docs no es un array de verdad, esto fallaría.
        const retorno = snapshot.docs.map((documentSnapshot) => documentSnapshot.id);
        
        console.log('IDs de países devueltos:', retorno);
        return retorno;
        
    } catch (error) {
        console.error("Firestore error al obtener países:", error);
        return [];
    }
};

/**
 * Fetches the list of available cities for a given country.
 */
export const getCities = async (country: string): Promise<string[]> => {
    // 1. Crea una referencia a la subcolección anidada usando 'collection()'
    const collectionRef = collection(db, PLACES_COLLECTION, country, CITIES_SUBCOLLECTION);
    
    // 2. Obtiene los documentos
    const snapshot = await getDocs(collectionRef);
    
    return snapshot.docs.map((documentSnapshot) => documentSnapshot.id);
};

/**
 * Fetches the top places for a given city in a specific country.
 */
export const getTopPlaces = async (country: string, city: string): Promise<NearbyPlace[]> => {
    // 1. Crea una referencia al documento anidado usando 'doc()'
    const docRef = doc(db, PLACES_COLLECTION, country, CITIES_SUBCOLLECTION, city);
    
    // 2. Obtiene el documento usando 'getDoc()'
    const documentSnapshot = await getDoc(docRef);

    if (!documentSnapshot.exists()) {
        console.warn(`No document found for ${city}, ${country}`);
        return [];
    }

    const data = documentSnapshot.data();
    // The 'places' field from Firestore might be an object instead of an array.
    const placesData = data?.places;

    if (!placesData) {
        return [];
    }
    
    // Handle both array and object structures by ensuring placesArray is always an array.
    const placesArray = Array.isArray(placesData) ? placesData : Object.values(placesData);

    // Map the Firestore data to our app's NearbyPlace type.
    return placesArray.map((place: any) => ({
        name: place.name || 'Unknown Place',
        description: place.description || '',
        formatted_address: place.formatted_address || '',
        category: place.types[0] || 'Landmark',
        mapUri: `https://www.google.com/maps?q=${encodeURIComponent(place.name || '')}` || '#',
        imageUrl: place.image_url || undefined,
        audioData: undefined, // Audio data is not stored in Firestore for top places
    }));
};
