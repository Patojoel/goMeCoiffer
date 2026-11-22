import type { TokenStorage } from '@gomecoiffer/client-core';

type InitialTokens = {
  sessionToken?: string | null;
  deviceToken?: string | null;
};

export class InMemoryTokenStorage implements TokenStorage {
  private sessionToken: string | null;
  private deviceToken: string | null;

  constructor(initial: InitialTokens = {}) {
    this.sessionToken = initial.sessionToken ?? null;
    this.deviceToken = initial.deviceToken ?? null;
  }

  async getSessionToken(): Promise<string | null> {
    return this.sessionToken;
  }

  async setSessionToken(token: string): Promise<void> {
    this.sessionToken = token;
  }

  async clearSessionToken(): Promise<void> {
    this.sessionToken = null;
  }

  async getDeviceToken(): Promise<string | null> {
    return this.deviceToken;
  }

  async setDeviceToken(token: string): Promise<void> {
    this.deviceToken = token;
  }
}
