import * as SecureStore from 'expo-secure-store';
import { createTokenStorage } from '../createTokenStorage';

class FakeSecureStore {
  readonly items = new Map<string, string>();
  readonly calls: string[] = [];
  readonly optionsSeen: (SecureStore.SecureStoreOptions | undefined)[] = [];
  failOnSet = false;
  failOnDelete = false;
  failOnGet = false;
  pendingSetGate: Promise<void> | null = null;

  async getItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<string | null> {
    this.calls.push(`get:${key}`);
    this.optionsSeen.push(options);
    if (this.failOnGet) {
      throw new Error('Keystore read corrupted');
    }
    return this.items.get(key) ?? null;
  }

  async setItemAsync(
    key: string,
    value: string,
    options?: SecureStore.SecureStoreOptions,
  ): Promise<void> {
    this.calls.push(`set:${key}:start`);
    this.optionsSeen.push(options);
    if (this.pendingSetGate) {
      await this.pendingSetGate;
    }
    if (this.failOnSet) {
      this.calls.push(`set:${key}:fail`);
      throw new Error('Keystore locked');
    }
    this.items.set(key, value);
    this.calls.push(`set:${key}:end`);
  }

  async deleteItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<void> {
    this.calls.push(`delete:${key}`);
    this.optionsSeen.push(options);
    if (this.failOnDelete) {
      throw new Error('Keystore delete failed');
    }
    this.items.delete(key);
  }
}

describe('Encrypted mobile token storage (Durcissement 2, RG-013-01)', () => {
  it('does not update cachedSessionToken when SecureStore setItemAsync or deleteItemAsync fails', async () => {
    const fakeStore = new FakeSecureStore();
    fakeStore.items.set('gomecoiffer.session_token', 'tok-persisted');
    const storage = createTokenStorage(fakeStore);

    expect(await storage.getSessionToken()).toBe('tok-persisted');

    fakeStore.failOnSet = true;
    await expect(storage.setSessionToken('tok-unwritten')).rejects.toThrow('Keystore locked');
    expect(await storage.getSessionToken()).toBe('tok-persisted');

    fakeStore.failOnSet = false;
    fakeStore.failOnDelete = true;
    await expect(storage.clearSessionToken()).rejects.toThrow('Keystore delete failed');
    expect(await storage.getSessionToken()).toBe('tok-persisted');
  });

  it('serializes session and device token operations and enforces WHEN_UNLOCKED_THIS_DEVICE_ONLY', async () => {
    const fakeStore = new FakeSecureStore();
    let releaseSet!: () => void;
    fakeStore.pendingSetGate = new Promise<void>((resolve) => {
      releaseSet = resolve;
    });
    const storage = createTokenStorage(fakeStore);

    const setSession = storage.setSessionToken('tok-1');
    const setDevice = storage.setDeviceToken('dev-1');
    const getDevice = storage.getDeviceToken();

    await Promise.resolve();
    expect(fakeStore.calls).toEqual(['set:gomecoiffer.session_token:start']);

    releaseSet();
    fakeStore.pendingSetGate = null;
    await setSession;
    await setDevice;
    await expect(getDevice).resolves.toBe('dev-1');

    expect(fakeStore.calls).toEqual([
      'set:gomecoiffer.session_token:start',
      'set:gomecoiffer.session_token:end',
      'set:gomecoiffer.device_token:start',
      'set:gomecoiffer.device_token:end',
      'get:gomecoiffer.device_token',
    ]);
    for (const options of fakeStore.optionsSeen) {
      expect(options).toEqual({
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  });

  it('purges corrupted unreadable entries on getItemAsync and returns null', async () => {
    const fakeStore = new FakeSecureStore();
    fakeStore.failOnGet = true;
    const storage = createTokenStorage(fakeStore);

    await expect(storage.getSessionToken()).resolves.toBeNull();
    expect(fakeStore.calls).toContain('delete:gomecoiffer.session_token');
  });
});
