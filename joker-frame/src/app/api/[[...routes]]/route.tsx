/** @jsxImportSource frog/jsx */
import { Button, Frog, TextInput } from "frog";
import { handle } from "frog/next";
import {
  getEncodedImageUrlFromHash,
  setHashAndImageUrl,
} from "@/utils/database";

import { JSDOM } from "jsdom";
// TODO - replace url after cast
const ROOT_CAST_URL = "https://warpcast.com/senspace/0xf9b9a4e5";

const SHARE_INTENT = "https://warpcast.com/~/compose?text=";
const SHARE_TEXT = encodeURI(
  "Check out my Joker Frame on Senspace!（仮メッセージ）"
);
const SHARE_EMBEDS = "&embeds[]=";

const app = new Frog({
  basePath: "/api",
  imageAspectRatio: "1:1",
});

const name = "Joker Frame";
const actionPath = "/joker-frame-action";
const framePath = "/joker-frame";

// Add Cast Action Frame
app.frame("/", (c) => {
  return c.res({
    image: (
      <div
        style={{
          color: "black",
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          fontSize: 40,
        }}
      >
        説明画像(後で差し替え)
      </div>
    ),
    intents: [
      <Button.AddCastAction key="1" action={actionPath}>
        Add
      </Button.AddCastAction>,
    ],
  });
});

app.frame(framePath + "/:hash", async (c) => {
  const { req } = c;
  const hash = req.param("hash");

  if (!hash) {
    return c.res({
      image: (
        <div
          style={{
            color: "black",
            display: "flex",
            textAlign: "center",
            fontSize: 60,
          }}
        >
          Invalid Cast Hash
        </div>
      ),
    });
  }

  const encodedImageUrl = await getEncodedImageUrlFromHash(hash);

  return c.res({
    image: `/image/${encodedImageUrl}`,
    browserLocation: `/api/image/${encodedImageUrl}`,
    intents: [
      <Button.Link
        key="download"
        href={`${process.env.SITE_URL}/api/image/${encodedImageUrl}?download=true`}
      >
        Download
      </Button.Link>,
      <Button.Link
        key="share"
        href={
          SHARE_INTENT +
          SHARE_TEXT +
          SHARE_EMBEDS +
          `${process.env.SITE_URL}/api${framePath}/share/${hash}`
        }
      >
        Share
      </Button.Link>,
    ],
  });
});

app.frame(framePath + "/share/:hash", async (c) => {
  const { req } = c;
  const hash = req.param("hash");
  if (!hash) {
    return c.res({
      image: (
        <div
          style={{
            color: "black",
            display: "flex",
            textAlign: "center",
            fontSize: 60,
          }}
        >
          Invalid Cast Hash
        </div>
      ),
    });
  }
  const encodedImageUrl = await getEncodedImageUrlFromHash(hash);

  return c.res({
    image: `/image/${encodedImageUrl}`,
    browserLocation: `/api/image/${encodedImageUrl}`,
    intents: [
      <Button.Link key="create" href={ROOT_CAST_URL}>
        {/* TODO */}
        Create (TODO change link url)
      </Button.Link>,
    ],
  });
});

app.castAction(
  actionPath,
  async (c) => {
    const { actionData } = c;

    //  get cast hash
    const castHash = actionData?.castId.hash;

    //  fetch cast data
    const url =
      "https://api.neynar.com/v2/farcaster/cast?type=hash&identifier=" +
      castHash;
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        api_key: process.env.NEYNAR_API_KEY!,
      },
    };
    const res = await fetch(url, options);
    const data = await res.json();

    // get image url
    const media = data.cast.embeds;
    const mediaUrl = media[0]?.url;

    if (!mediaUrl) {
      return c.res({
        type: "message",
        message: "Media URL Not Found",
      });
    }

    let imageUrl;
    // check format
    const headResponse = await fetch(mediaUrl, { method: "HEAD" });
    const contentType = headResponse.headers.get("content-type");
    if (contentType && contentType.startsWith("image")) {
      imageUrl = mediaUrl;
    } else {
      // if not image, get fc:frame:image or og:image
      imageUrl = await getImageUrl(mediaUrl);
    }

    if (!imageUrl) {
      return c.res({
        type: "message",
        message: "Invalid Cast Data",
      });
    }

    // save image to db
    await setHashAndImageUrl(castHash, imageUrl);
    return c.res({
      type: "frame",
      path: framePath + "/" + castHash,
    });
  },
  { name, icon: "paintbrush", description: "Create a Your Joker Card" }
);
const getImageUrl = async (mediaUrl: string): Promise<string | null> => {
  let imageUrl: string | null = null;

  // // Playwrightでページをロードしてメタタグを取得

  const html = await fetch(mediaUrl).then((res) => res.text());
  const dom = new JSDOM(html);
  const meta = dom.window.document.querySelectorAll("meta");

  let frameImage = "";
  let ogImage = "";
  let twitterImage = "";

  meta.forEach((tag) => {
    const property = tag.getAttribute("property");
    const name = tag.getAttribute("name");
    const content = tag.getAttribute("content");

    // property、name、itempropのいずれかが目的の属性である場合にcontentを取得
    if (
      property === "fc:frame:image" ||
      name === "fc:frame:image" ||
      name === "twitter:image"
    ) {
      frameImage = content || "";
    }
    if (property === "og:image" || name === "og:image") {
      ogImage = content || "";
    }
    if (name === "twitter:image") {
      twitterImage = content || "";
    }
  });

  imageUrl = frameImage || ogImage || twitterImage || null;

  return imageUrl;
};

export const GET = handle(app);
export const POST = handle(app);
