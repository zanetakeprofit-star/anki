
export interface AnkiCard {
  front: string;
  back: string;
}

export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'error';

export interface ImageItem {
  id: string;
  data: string;
  status: ProcessingStatus;
  card?: AnkiCard;
  errorMessage?: string;
}

export type ProcessingStep = 
  | 'idle'
  | 'processing'
  | 'completed'
  | 'error';

export interface ProcessingState {
  step: ProcessingStep;
  message: string;
}

export type ZhipuModel = 'glm-4-plus' | 'glm-4-flash' | 'glm-4v-plus' | 'glm-4v';
