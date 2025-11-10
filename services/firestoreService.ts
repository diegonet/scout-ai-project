// Fix: Use Firebase v9 compat imports to work with the v12 SDK specified in the import map.
// This allows using the existing Firebase v8 syntax throughout the file.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { NearbyPlace } from '../types';

// --- CONFIGURACIÓN ---
const firebaseConfig = {
    apiKey: "INSERT_API_KEY",
    authDomain: "INSERT_AUTH_DOMAIN",
    projectId: "INSERT_PROJECT_ID",
    storageBucket: "INSERT_STORAGE_BUCKET",
    messagingSenderId: "INSERT_MESSAGING",
    appId: "INSERT_APP_ID"
};


// --- INICIALIZACIÓN DE FIREBASE ---

// Use Firebase v8 initialization. Check if app is already initialized.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 2. Obtén y exporta la instancia de Firestore
// Use v8 syntax to get Firestore instance.
export const db: firebase.firestore.Firestore = firebase.firestore();


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
        // Use v8 syntax for collection reference and getting documents.
        const collectionRef = db.collection(PLACES_COLLECTION);
        const snapshot = await collectionRef.get();
        
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
    // Use v8 syntax for nested collection reference.
    const collectionRef = db.collection(PLACES_COLLECTION).doc(country).collection(CITIES_SUBCOLLECTION);
    
    // 2. Obtiene los documentos
    // Use v8 syntax for getting documents.
    const snapshot = await collectionRef.get();
    
    return snapshot.docs.map((documentSnapshot) => documentSnapshot.id);
};

/**
 * Fetches the top places for a given city in a specific country.
 */
export const getTopPlaces = async (country: string, city: string): Promise<NearbyPlace[]> => {
    // 1. Crea una referencia al documento anidado usando 'doc()'
    // Use v8 syntax for nested document reference.
    const docRef = db.collection(PLACES_COLLECTION).doc(country).collection(CITIES_SUBCOLLECTION).doc(city);
    
    // 2. Obtiene el documento usando 'getDoc()'
    // Use v8 syntax for getting a document.
    const documentSnapshot = await docRef.get();

    // Use `.exists` property (v8) instead of `.exists()` method (v9).
    if (!documentSnapshot.exists) {
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