import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: { imageUrl: string } }
) {
  const encodedImageUrl = params.imageUrl;
  const imageUrl = decodeURIComponent(encodedImageUrl);
  const { searchParams } = new URL(req.url);
  const download = searchParams.get("download") === "true";

  console.log("create image");
  // base image 2000 x 2000
  const baseSize = 2000;
  const maxWitdh = 600;
  const maxHeight = 1500;

  const containerStyle = {
    position: "relative" as "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden" as "hidden",
  };

  const overlayImageStyle = {
    maxWidth: `${maxWitdh}px`,
    maxHeight: `${maxHeight}px`,
    transform: "rotate(5deg)",
    position: "absolute" as "absolute",
    objectFit: "contain" as "contain",
  };

  // 画像を取得
  // const response = await fetch(imageUrl);
  // if (!response.ok) {
  //   return new Response("Failed to fetch image", { status: 500 });
  // }
  // const arrayBuffer = await response.arrayBuffer();
  // const base64Image = Buffer.from(arrayBuffer).toString("base64");
  // const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

  const imageResponse = new ImageResponse(
    (
      <div style={containerStyle}>
        <img
          width="100%"
          height="100%"
          src={process.env.SITE_URL + "/joker.png"}
          style={{ objectFit: "contain" }}
        />
        <img
          src={
            imageUrl
            // imageDataUrl
          }
          style={overlayImageStyle}
        />
      </div>
    ),
    {
      width: baseSize,
      height: baseSize,
    }
  );

  if (download) {
    // ダウンロード用の処理
    const arrayBuffer = await imageResponse.arrayBuffer();
    const headers = new Headers();
    headers.set(
      "Content-Disposition",
      'attachment; filename="generated_image.jpg"'
    );
    headers.set("Content-Type", "image/jpeg");
    headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=43200"
    );

    return new Response(arrayBuffer, { headers });
  }

  return imageResponse;
}
