/**
 * sinon-chrome の型定義
 */
declare module "sinon-chrome" {
  interface SinonChromeStub {
    (...args: unknown[]): unknown;
    yields: (...args: unknown[]) => void;
    flush: () => void;
    calledOnce: boolean;
    calledWith: (...args: unknown[]) => boolean;
  }

  interface StorageArea {
    get: SinonChromeStub;
    set: SinonChromeStub;
    remove: SinonChromeStub;
    clear: SinonChromeStub;
  }

  interface Storage {
    sync: StorageArea;
    local: StorageArea;
    managed: StorageArea;
    session: StorageArea;
  }

  interface SinonChrome {
    storage: Storage;
    reset: () => void;
    flush: () => void;
  }

  const chrome: SinonChrome;
  export = chrome;
}
