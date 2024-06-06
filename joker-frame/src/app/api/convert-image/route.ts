import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("imageUrl");

  if (!imageUrl) {
    return NextResponse.json(
      { error: "Image URL is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: 500 }
      );
    }

    const contentType = response.headers.get("Content-Type");
    const arrayBuffer = await response.arrayBuffer();
    let convertedBuffer: Buffer;
    let convertedContentType: string;

    if (contentType === "image/webp") {
      convertedBuffer = await sharp(Buffer.from(arrayBuffer)).png().toBuffer();
      convertedContentType = "image/png";
    } else {
      convertedBuffer = Buffer.from(arrayBuffer);
      convertedContentType = contentType || "application/octet-stream";
    }

    return new NextResponse(convertedBuffer, {
      headers: { "Content-Type": convertedContentType },
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching or converting image:", error);
    return NextResponse.json(
      { error: "Error processing image" },
      { status: 500 }
    );
  }
}
