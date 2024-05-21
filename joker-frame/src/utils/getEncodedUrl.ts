export function getEncodedUrl(url: string): string {
  if (!isEncoded(url)) {
    return encodeURIComponent(url);
  }
  return url;
}
function isEncoded(url: string): boolean {
  try {
    return url !== decodeURIComponent(url);
  } catch (e) {
    return false;
  }
}
