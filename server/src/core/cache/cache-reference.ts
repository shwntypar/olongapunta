export class ReferenceCache {
  private static instance: ReferenceCache;

  private constructor() {}

  static getInstance(): ReferenceCache {
    if (!ReferenceCache.instance) {
      ReferenceCache.instance = new ReferenceCache();
    }
    return ReferenceCache.instance;
  }
}
export const referenceCache = ReferenceCache.getInstance();
