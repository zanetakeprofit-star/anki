
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
