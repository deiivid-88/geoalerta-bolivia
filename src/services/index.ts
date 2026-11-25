import { createDemoProvider } from './demoProvider';
import { createHttpProvider } from './httpProvider';
import type { DataMode, DataProvider } from './types';

export * from './types';

export const DATA_MODE: DataMode = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'demo';
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api/v1';

let instance: DataProvider | null = null;
let unauthorizedHandler: (() => void) | undefined;

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export function getProvider(): DataProvider {
  if (!instance) {
    instance = DATA_MODE === 'api' ? createHttpProvider(API_BASE_URL, () => unauthorizedHandler?.()) : createDemoProvider();
  }
  return instance;
}
