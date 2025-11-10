import { GoogleGenAI, Chat, Type, Modality, GenerateContentResponse } from "@google/genai";
import type { TourPlan, NearbyPlace } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    // In a real app, you might want to show a more user-friendly message
    // or disable features that require the API key.
    console.error("API_KEY is not configured in environment variables. App features will be limited.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callGeminiWithRetry = async <T>(
    apiCall: () => Promise<T>,
    maxRetries = 3
): Promise<T> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await apiCall();
        } catch (error) {
            attempt++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Check for transient error conditions
            const isTransientError = 
                errorMessage.includes('429') || // Too Many Requests
                errorMessage.includes('503') || // Service Unavailable
                errorMessage.includes('UNAVAILABLE') || // gRPC code for unavailable
                errorMessage.toLowerCase().includes('model is overloaded') ||
                errorMessage.includes('RESOURCE_EXHAUSTED');

            if (isTransientError && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
                console.warn(`Transient API error detected. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt}/${maxRetries})`);
                await sleep(delay);
            } else {
                console.error(`API call failed after ${attempt} attempts.`, error);
                throw error; // Re-throw the error if it's not transient or retries are exhausted
            }
        }
    }
    // This line should not be reachable if maxRetries > 0, but is a fallback.
    throw new Error('API call failed after exhausting all retries.');
};


const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                resolve('');
            }
        };
        reader.readAsDataURL(file);
    });

    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

export const identifyLandmark = async (
    imageFile: File,
    language: string,
    onProgress: (message: string) => void
) => {
    onProgress('Preparing analysis...');
    const imagePart = await fileToGenerativePart(imageFile);

    onProgress('Identifying landmark...');
    const identificationModel = 'gemini-2.5-flash';
    const identificationPrompt = `Identify the landmark in this image. Respond with only the name of the landmark and its location (e.g., "Eiffel Tower, Paris, France"). If it's not a famous landmark, respond with the single phrase "Unknown Landmark".`;
    
    const identificationResponse = await callGeminiWithRetry(() => ai.models.generateContent({
        model: identificationModel,
        contents: { parts: [imagePart, { text: identificationPrompt }] },
    }));

    const landmarkName = identificationResponse.text.trim();

    if (landmarkName.toLowerCase().includes('unknown landmark')) {
        throw new Error("I couldn't identify a landmark in this photo. Please try another one.");
    }

    onProgress('Researching history...');
    const textModel = 'gemini-2.5-pro';
    const historyPrompt = `Provide a concise and engaging history of ${landmarkName} in ${language}. The history should be about 150-200 words long, suitable for a tourist audio guide. Format it into 2-3 short paragraphs.`;

    const historyResponse = await callGeminiWithRetry(() => ai.models.generateContent({
        model: textModel,
        contents: historyPrompt
    }));
    const historyText = historyResponse.text.trim();

    onProgress('Creating audio guide...');
    const audioModel = 'gemini-2.5-flash-preview-tts';
    // The TTS model works best with just the text to be spoken.
    // Instructions about voice style are better handled by config or are implicit.
    const ttsPrompt = historyText;

    const audioResponse = await callGeminiWithRetry(() => ai.models.generateContent({
        model: audioModel,
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    }));

    const audioData = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
        throw new Error('Failed to generate audio data.');
    }

    return {
        name: landmarkName,
        history: historyText,
        audioData: audioData,
    };
};

export const fetchFunFact = async (landmarkName: string, language: string): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const prompt = `Tell me one surprising or little-known fun fact about ${landmarkName}. The fact should be in ${language}.`;
    
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model,
        contents: prompt
    }));

    return response.text.trim();
};

export const createChatSession = (systemInstruction: string): Chat => {
    const model = 'gemini-2.5-flash';
    const chat = ai.chats.create({
        model,
        config: {
            systemInstruction,
        },
    });
    return chat;
};

export const sendChatMessage = async (chat: Chat, message: string): Promise<GenerateContentResponse> => {
    return callGeminiWithRetry(() => chat.sendMessage({ message }));
};

export const generateTourPlan = async (location: string, language: string): Promise<TourPlan> => {
    const model = 'gemini-2.5-pro';
    const prompt = `Create a one-day tour plan for a tourist visiting ${location}. The plan should be exciting and cover a good mix of activities. Provide a title for the plan. For morning, afternoon, and evening, provide an activity and a short, enticing description. For lunch and dinner, suggest a type of cuisine or a specific restaurant and a short description. The entire plan should be in ${language}.`;

    const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    location: { type: Type.STRING },
                    morning: {
                        type: Type.OBJECT,
                        properties: {
                            activity: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                        required: ["activity", "description"]
                    },
                    lunch: {
                        type: Type.OBJECT,
                        properties: {
                            suggestion: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                         required: ["suggestion", "description"]
                    },
                    afternoon: {
                        type: Type.OBJECT,
                        properties: {
                            activity: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                         required: ["activity", "description"]
                    },
                    evening: {
                        type: Type.OBJECT,
                        properties: {
                            activity: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                         required: ["activity", "description"]
                    },
                    dinner: {
                        type: Type.OBJECT,
                        properties: {
                            suggestion: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                         required: ["suggestion", "description"]
                    }
                },
                required: ["title", "location", "morning", "lunch", "afternoon", "evening", "dinner"]
            }
        }
    }));

    const jsonText = response.text.trim();
    try {
        return JSON.parse(jsonText) as TourPlan;
    } catch (e) {
        console.error("Failed to parse JSON response for tour plan:", jsonText);
        throw new Error("The model returned an invalid tour plan format.");
    }
};


export const findNearbyPlaces = async (
    latitude: number, 
    longitude: number, 
    language: string,
    existingPlaceNames: string[] = []
): Promise<Omit<NearbyPlace, 'imageUrl' | 'audioData'>[]> => {
    const model = 'gemini-2.5-pro';
    
    let exclusionPrompt = '';
    if (existingPlaceNames.length > 0) {
        exclusionPrompt = ` Exclude these places from the results: ${existingPlaceNames.join(', ')}.`;
    }

    const prompt = `Find the 6 most interesting and diverse tourist points of interest near the given location.${exclusionPrompt} For each place, provide its name, a concise one-sentence description, and a category from this list: "Museum", "Park", "Restaurant", "Historic Site", "Cafe", "Landmark", "Shopping". The response must be in ${language}. Respond ONLY with a valid JSON array of objects with "name", "description", and "category" keys. If no relevant places are found, return an empty JSON array []. Do not add any conversational text or markdown formatting.`;

    const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                    latLng: {
                        latitude,
                        longitude,
                    },
                },
            },
        },
    }));

    const rawText = response.text.trim();
    const cleanedText = rawText.replace(/^```(json)?\s*/, '').replace(/```$/, '').trim();

    if (!cleanedText) {
        return [];
    }
    
    // Fix: Add a check to ensure the response is likely JSON before parsing.
    // If the model responds with a sentence, it means it failed to find places.
    if (!cleanedText.startsWith('[')) {
        console.warn("Model returned a non-JSON response for nearby places, treating as no results. Response:", cleanedText);
        return [];
    }

    let places: Omit<NearbyPlace, 'imageUrl' | 'mapUri' | 'audioData'>[];
    try {
        places = JSON.parse(cleanedText);
    } catch (err) {
        console.error("Failed to parse JSON for nearby places despite initial checks:", { rawText, cleanedText }, err);
        // Gracefully fail by returning an empty array if parsing still fails.
        return [];
    }
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Match places with their map URIs from grounding chunks
    return places.map(place => {
        const matchingChunk = groundingChunks.find(chunk => chunk.maps && chunk.maps.title.toLowerCase().includes(place.name.toLowerCase()));
        return {
            ...place,
            mapUri: matchingChunk ? matchingChunk.maps.uri : '#'
        };
    });
};

export const generateAudioForText = async (text: string, language: string): Promise<string> => {
    const audioModel = 'gemini-2.5-flash-preview-tts';
    // The TTS model works best with just the text to be spoken.
    // The `language` parameter is not used in the config, and the model infers it from the text.
    // Adding instructions to the text can sometimes lead to failures.
    const ttsPrompt = text;

    const audioResponse = await callGeminiWithRetry(() => ai.models.generateContent({
        model: audioModel,
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    }));

    const audioData = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
        // Log the full response to help debug issues with safety settings or other API-side problems.
        console.error("Audio generation failed. Full API response:", JSON.stringify(audioResponse, null, 2));
        throw new Error('Failed to generate audio data.');
    }
    return audioData;
};

export const generateDescriptionForPlace = async (placeName: string, location: string, language: string): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const prompt = `Provide a concise and engaging one-sentence description for "${placeName}" in ${location}, suitable for a tourist app. Respond in ${language} with only the description sentence.`;
    
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model,
        contents: prompt
    }));

    return response.text.trim();
};

export const translatePlaceDetails = async (
    places: { name: string, description: string }[], 
    languageName: string
): Promise<{ name: string, description: string }[]> => {
    // If the target language is English, no translation is needed as the source is English.
    if (languageName.toLowerCase() === 'english') {
        return places;
    }
    
    const model = 'gemini-2.5-flash';
    const prompt = `Translate the 'name' and 'description' for each of the following places into ${languageName}. Provide the response as a valid JSON array of objects, maintaining the original order.

    Input:
    ${JSON.stringify(places)}
    `;

    const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING }
                    },
                    required: ["name", "description"]
                }
            }
        }
    }));

    const jsonText = response.text.trim();
    try {
        const translated = JSON.parse(jsonText);
        if (Array.isArray(translated) && translated.length === places.length) {
            return translated;
        }
        console.error("Translated data length mismatch. Falling back to original.", {
            expected: places.length,
            received: translated.length
        });
        return places; // Fallback
    } catch (e) {
        console.error("Failed to parse JSON response for place translation. Falling back to original.", { jsonText }, e);
        return places; // Fallback
    }
};

export const generateImageForPlace = async (placeName: string, location: string): Promise<string> => {
    const model = 'gemini-2.5-flash-image';
    const prompt = `A beautiful, photorealistic, high-quality photograph of "${placeName}", a tourist-friendly view of this ${location}. Sunny day.`;

    const response = await callGeminiWithRetry(() => ai.models.generateContent({
        model,
        contents: {
            parts: [{ text: prompt }],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error(`No image data in response for ${placeName}`);
};
