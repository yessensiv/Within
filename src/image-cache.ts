type ImageSource = {
  url(bucket: "covers" | "avatars", path: string): Promise<string>;
};
type Entry = { url?: string; expiresAt: number; pending?: Promise<string> };
const caches = new WeakMap<ImageSource, Map<string, Entry>>();
function cacheFor(source: ImageSource) {
  let cache = caches.get(source);
  if (!cache) caches.set(source, cache = new Map());
  return cache;
}
const keyFor = (bucket: string, path: string) => `${bucket}:${path}`;

export function cachedImageUrl(source: ImageSource, bucket: "covers" | "avatars", path: string | null) {
  if (!path) return "";
  const entry = cacheFor(source).get(keyFor(bucket, path));
  return entry && entry.expiresAt > Date.now() ? entry.url || "" : "";
}

export function loadImageUrl(source: ImageSource, bucket: "covers" | "avatars", path: string) {
  const cache = cacheFor(source);
  const key = keyFor(bucket, path);
  const cached = cachedImageUrl(source, bucket, path);
  if (cached) return Promise.resolve(cached);
  const existing = cache.get(key);
  if (existing?.pending) return existing.pending;
  const entry: Entry = { expiresAt: 0 };
  entry.pending = source.url(bucket, path).then(url => {
    entry.url = url;
    // Signed URL живёт 300 секунд; обновляем заранее.
    entry.expiresAt = Date.now() + 240_000;
    entry.pending = undefined;
    return url;
  }).catch(error => {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  });
  cache.set(key, entry);
  return entry.pending;
}

export function forgetImageUrl(source: ImageSource, bucket: "covers" | "avatars", path: string) {
  cacheFor(source).delete(keyFor(bucket, path));
}
