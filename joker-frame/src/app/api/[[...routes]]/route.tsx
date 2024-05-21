/** @jsxImportSource frog/jsx */
import { Button, Frog, TextInput } from "frog";
import { handle } from "frog/next";
import { getEncodedUrl } from "@/utils/getEncodedUrl";
// TODO - replace url after cast
const ROOT_CAST_URL = "https://warpcast.com/senspace/0xf9b9a4e5";

const SHARE_INTENT = "https://warpcast.com/~/compose?text=";
const SHARE_TEXT = encodeURI("Check out my Joker Frame on Senspace!\n");
const SHARE_EMBEDS = "&embeds[]=";

const app = new Frog({
  basePath: "/api",
  imageAspectRatio: "1:1",
});

const name = "Joker Frame";
const actionPath = "/joker-frame-action";
const framePath = "/joker-frame";

export const runtime = "edge";

app.frame("/", (c) => {
  return c.res({
    image: (
      <div style={{ color: "white", display: "flex", fontSize: 60 }}>
        CastAction Description
      </div>
    ),
    intents: [
      <Button.AddCastAction key="1" action={actionPath}>
        Add
      </Button.AddCastAction>,
    ],
  });
});

app.frame(framePath + "/:imageUrl", async (c) => {
  const { req } = c;
  const imageUrl = req.param("imageUrl");
  const encodedImageUrl = getEncodedUrl(imageUrl);

  console.log(`Frame Path accessed with imageUrl: ${imageUrl}`);
  console.log(`Encoded Image URL: ${encodedImageUrl}`);

  return c.res({
    image: `/image/${encodedImageUrl}`,
    browserLocation: `/image/${encodedImageUrl}`,
    // intents: [
    //   <Button.Link
    //     key="share"
    //     href={
    //       SHARE_INTENT +
    //       SHARE_TEXT +
    //       SHARE_EMBEDS +
    //       encodeURIComponent(
    //         `${process.env.SITE_URL}/api/share/${encodedImageUrl}`
    //       )
    //     }
    //   >
    //     Share
    //   </Button.Link>,
    // ],
  });
});

app.frame("/share/:imageUrl", async (c) => {
  const { req } = c;
  const imageUrl = req.query.imageUrl;
  const encodedImageUrl = getEncodedUrl(imageUrl);

  console.log("AAA");
  console.log(`Share frame called with imageUrl: ${imageUrl}`);
  console.log(`Encoded Image URL: ${encodedImageUrl}`);

  return c.res({
    image: `/image/${encodedImageUrl}`,
    browserLocation: `/image/${encodedImageUrl}`,
    // intents: [
    //   <Button.Link key="create" href={ROOT_CAST_URL}>
    //     Create
    //   </Button.Link>,
    // ],
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
    const imageUrl = media[0].url;
    const encodedImageUrl = getEncodedUrl(imageUrl);

    console.log(`CastAction: imageUrl: ${imageUrl}`);
    console.log(`CastAction: Encoded Image URL: ${encodedImageUrl}`);

    return c.res({
      type: "frame",
      path: framePath + "/" + encodedImageUrl,
    });
  },
  { name, icon: "paintbrush", description: "Create a Your Joker Card" }
);

export const GET = handle(app);
export const POST = handle(app);
