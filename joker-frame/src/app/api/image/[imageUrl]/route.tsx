import { NextRequest } from "next/server";
import sharp from "sharp";

export async function GET(
  req: NextRequest,
  { params }: { params: { imageUrl: string } }
) {
  const encodedImageUrl = params.imageUrl;
  const imageUrl = decodeURIComponent(encodedImageUrl);
  const { searchParams } = new URL(req.url);
  const download = searchParams.get("download") === "true";

  const overlayMaxWidth = 700; // オーバーレイ画像の最大幅
  const overlayMaxHeight = 1500; // オーバーレイ画像の最大高さ

  // 背景画像の取得
  const backgroundUrl = `${process.env.SITE_URL}/joker.png`;
  const backgroundResponse = await fetch(backgroundUrl);
  if (!backgroundResponse.ok) {
    return new Response("Failed to fetch background image", { status: 500 });
  }
  const backgroundBuffer = Buffer.from(await backgroundResponse.arrayBuffer());

  // オーバーレイ画像の取得
  const overlayResponse = await fetch(imageUrl);
  if (!overlayResponse.ok) {
    return new Response("Failed to fetch overlay image", { status: 500 });
  }
  const overlayBuffer = Buffer.from(await overlayResponse.arrayBuffer());

  // 背景画像のメタデータを取得
  const backgroundMetadata = await sharp(backgroundBuffer).metadata();

  // オーバーレイ画像のリサイズと透明背景の維持
  const overlayImageBuffer = await sharp(overlayBuffer)
    .rotate(5, { background: { r: 0, g: 0, b: 0, alpha: 0 } }) // 透明背景を維持して回転
    .resize({
      width: overlayMaxWidth,
      height: overlayMaxHeight,
      fit: sharp.fit.inside,
      withoutEnlargement: true,
    })
    .png() // PNG形式に変換して透明背景を維持
    .toBuffer();

  // オーバーレイ画像のメタデータを取得
  const overlayImageMetadata = await sharp(overlayImageBuffer).metadata();

  if (!overlayImageMetadata.width || !overlayImageMetadata.height) {
    return new Response("Failed to retrieve overlay image metadata", {
      status: 500,
    });
  }

  // 上、左に寄せる量をピクセル単位で指定（例：10ピクセル左に寄せる）
  const topOffset = 12;
  const leftOffset = 8;

  // 透明背景を追加して中央に配置するためにオーバーレイ画像の位置を調整
  const extendedOverlayImageBuffer = await sharp({
    create: {
      width: backgroundMetadata.width!,
      height: backgroundMetadata.height!,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: overlayImageBuffer,
        left:
          Math.floor(
            (backgroundMetadata.width! - overlayImageMetadata.width) / 2
          ) - leftOffset,
        top:
          Math.floor(
            (backgroundMetadata.height! - overlayImageMetadata.height) / 2
          ) - topOffset,
      },
    ])
    .png()
    .toBuffer();

  // 背景画像とオーバーレイ画像の合成
  const compositeImage = await sharp(backgroundBuffer)
    .composite([{ input: extendedOverlayImageBuffer }])
    .toFormat("png")
    .toBuffer();

  if (download) {
    // ダウンロード用の処理
    const headers = new Headers();
    headers.set(
      "Content-Disposition",
      `attachment; filename="generated_image.png"`
    );
    headers.set("Content-Type", "image/png");
    headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=43200"
    );

    return new Response(compositeImage, { headers });
  }

  // 画像を直接表示するためのレスポンス
  return new Response(compositeImage, {
    headers: {
      "Content-Type": "image/png",
    },
  });
}
