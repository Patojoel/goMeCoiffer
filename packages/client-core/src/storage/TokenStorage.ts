export interface TokenStorage {
  getSessionToken(): Promise<string | null>;
  setSessionToken(token: string): Promise<void>;
  /** Efface le jeton de session tout en conservant la reconnaissance d'appareil (RG-013-06, -12). */
  clearSessionToken(): Promise<void>;
  getDeviceToken(): Promise<string | null>;
  setDeviceToken(token: string): Promise<void>;
}
