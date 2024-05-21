import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getEncodedUrl } from "@/utils/getEncodedUrl";
export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: { imageUrl: string } }
) {
  const encodedImageUrl = params.imageUrl;
  const imageUrl = decodeURIComponent(encodedImageUrl);
  console.log("create image");
  // base image 2000 x 2000
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

  return new ImageResponse(
    (
      <div style={containerStyle}>
        <img
          width="100%"
          height="100%"
          src={process.env.SITE_URL + "/joker.png"}
          style={{ objectFit: "contain" }}
        />
        <img src={imageUrl} style={overlayImageStyle} />
      </div>
    ),
    {
      width: 2000,
      height: 2000,
    }
  );
}
