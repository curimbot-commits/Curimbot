export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED';

export interface ConnectionState {
  status: ConnectionStatus;
  retryCount: number;
  lastError: string | null;
}

export const INITIAL_CONNECTION_STATE: ConnectionState = {
  status: 'DISCONNECTED',
  retryCount: 0,
  lastError: null,
};