/**
 * Token storage utilities for managing JWT access tokens in localStorage.
 *
 * Provides helpers for reading, writing, and validating tokens.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

const TOKEN_STORAGE_KEY = 'einkpdf_access_token';

interface DecodedTokenPayload {
  sub?: string;
  exp?: number;
  [key: string]: unknown;
}

const decodeToken = (token: string): DecodedTokenPayload | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const json = JSON.parse(decoded) as DecodedTokenPayload;
    return json;
  } catch (_error) {
    return null;
  }
};

export class TokenStorage {
  static getToken(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (_error) {
      return null;
    }
  }

  static setToken(token: string): void {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  static removeToken(): void {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  static isTokenExpired(token: string | null): boolean {
    if (!token) {
      return true;
    }
    const payload = decodeToken(token);
    if (!payload?.exp) {
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  }

  static getSubject(token: string | null): string | null {
    if (!token) {
      return null;
    }
    const payload = decodeToken(token);
    if (!payload?.sub || typeof payload.sub !== 'string') {
      return null;
    }
    return payload.sub;
  }
}
