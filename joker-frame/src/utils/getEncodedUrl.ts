export function getEncodedUrl(url: string): string {
  if (!needsEncoding(url)) {
    return url;
  }
  return encodeURIComponent(url);
}

function needsEncoding(url: string): boolean {
  // 部分的にエンコードされているかどうかをチェック
  // 完全にエンコードされていない場合も考慮する
  const decodedUrl = decodeURIComponent(url);

  // 再エンコードして同じかどうかをチェック
  const reencodedUrl = encodeURIComponent(decodedUrl);

  // 元のURLと再エンコードされたURLが異なる場合、エンコードが必要
  return url !== reencodedUrl;
}
