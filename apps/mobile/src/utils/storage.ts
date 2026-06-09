import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Cross-platform storage wrapper
 * Uses expo-secure-store on native platforms
 * Uses localStorage on web
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key) || null;
      } catch {
        return null;
      }
    } else {
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Ignore errors in web
      }
    } else {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch {
        // Ignore errors in native
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore errors in web
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Ignore errors in native
      }
    }
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.clear();
      } catch {
        // Ignore errors in web
      }
    }
    // Note: SecureStore doesn't have a clear method
  },
};
