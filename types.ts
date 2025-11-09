export interface LandmarkData {
  name: string;
  history: string;
  userImageUrl: string;
  audioData: string; // base64 encoded
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface TourPlan {
  title: string;
  location: string;
  morning: {
    activity: string;
    description: string;
  };
  lunch: {
    suggestion: string;
    description: string;
  };
  afternoon: {
    activity: string;
    description: string;
  };
  evening: {
    activity: string;
    description: string;
  };
  dinner: {
    suggestion: string;
    description: string;
  };
}

export interface NearbyPlace {
    name: string;
    description: string;
    category: string;
    mapUri: string;
    imageUrl?: string;
    audioData?: string;
    formatted_address?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
}