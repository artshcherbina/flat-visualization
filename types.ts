export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING_PROMPTS = 'GENERATING_PROMPTS',
  GENERATING_IMAGES = 'GENERATING_IMAGES',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  base64: string | null;
  label: string; // e.g., "Living Room", "Exterior"
  status: 'pending' | 'loading' | 'success' | 'error';
}

export interface AppState {
  status: GenerationStatus;
  description: string;
  images: GeneratedImage[];
  error?: string;
}

export interface BatchItem {
  id: string;
  externalId?: string; // ID extracted from CSV
  originalDescription: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  images: GeneratedImage[];
  error?: string;
}