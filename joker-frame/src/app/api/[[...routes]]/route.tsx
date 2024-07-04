/** @jsxImportSource frog/jsx */
import { Button, Frog } from 'frog';
import { handle } from 'frog/next';
import {
  getEncodedImageUrlFromHash,
  setHashAndImageUrl,
} from '@/utils/database';

import { JSDOM } from 'jsdom';

// TODO - replace url after cast
const ROOT_CAST_URL = 'https://warpcast.com/cardgamemaster/0xfb9874ec';

// TODO シェア文言を変える
const SHARE_INTENT = 'https://warpcast.com/~/compose?text=';
const SHARE_TEXT = encodeURI('I want YOU for /card');
const SHARE_EMBEDS = '&embeds[]=';

const app = new Frog({
  title: 'Cardians Wanted!',
  basePath: '/api',
  assetsPath: '/',
  imageAspectRatio: '1:1',
});

const name = 'Cardians Wanted!';
const actionPath = '/joker-maker-action';
const framePath = '/joker-maker';

// Add Cast Action Frame
app.frame('/', (c) => {
  return c.res({
    // image: '/title.png',
    image: '/frame_makeposter_cover.png',
    intents: [
      <Button.AddCastAction key="1" action={actionPath}>
        Add
      </Button.AddCastAction>,
    ],
  });
});

app.frame(framePath + '/:hash', async (c) => {
  const { req } = c;
  const hash = req.param('hash');

  if (!hash) {
    return c.res({
      image: (
        <div
          style={{
            color: 'black',
            display: 'flex',
            textAlign: 'center',
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
    image: `/api/image/${encodedImageUrl}`,
    browserLocation: `/api/image/${encodedImageUrl}`,
    intents: [
      // <Button.Link
      //   key="download"
      //   href={`${process.env.SITE_URL}/api/image/${encodedImageUrl}?download=true`}
      // >
      //   Download
      // </Button.Link>,
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

app.frame(framePath + '/share/:hash', async (c) => {
  const { req } = c;
  const hash = req.param('hash');
  if (!hash) {
    return c.res({
      image: (
        <div
          style={{
            color: 'black',
            display: 'flex',
            textAlign: 'center',
            fontSize: 60,
          }}
        >
          Invalid Cast Hash
        </div>
      ),
    });
  }
  const encodedImageUrl = await getEncodedImageUrlFromHash(hash);

  // TODO browserLocationとボタンの文言を変える
  return c.res({
    image: `/api/image/${encodedImageUrl}`,
    browserLocation: `https://warpcast.com/cardgamemaster/0xfb9874ec`,
    intents: [
      <Button.Link key="create" href={ROOT_CAST_URL}>
        Create My Joker
      </Button.Link>,
    ],
  });
});

app.castAction(
  actionPath,
  async (c) => {
    console.time('cast action total time');

    console.time('Fetch cast data');

    const { actionData } = c;

    //  get cast hash
    const castHash = actionData?.castId.hash;

    //  fetch cast data

    const url =
      'https://api.neynar.com/v2/farcaster/cast?type=hash&identifier=' +
      castHash;
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        api_key: process.env.NEYNAR_API_KEY!,
      },
    };
    const res = await fetch(url, options);
    const data = await res.json();

    // get image url
    // const media = data.cast.embeds;
    // const mediaUrl = media[0]?.url;

    // if (!mediaUrl) {
    //   return c.res({
    //     type: 'message',
    //     message: 'Media URL Not Found',
    //   });
    // }

    // Joker Frame → I Want Youへのアップデート対応　start

    const pfp_url = data.cast.author.pfp_url;
    if (!pfp_url) {
      return c.res({
        type: 'message',
        message: 'PFP URL Not Found',
      });
    }
    const mediaUrl = pfp_url;
    // Joker Frame → I Want Youへのアップデート対応　end

    console.timeEnd('Fetch cast data');

    console.time('Check format and get ogp image');
    let imageUrl;
    // check format
    const headResponse = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = headResponse.headers.get('content-type');
    if (contentType && contentType.startsWith('image')) {
      imageUrl = mediaUrl;
    } else {
      // if not image, get fc:frame:image or og:image
      imageUrl = await getImageUrl(mediaUrl);
    }

    if (!imageUrl) {
      return c.res({
        type: 'message',
        message: 'Invalid Cast Data',
      });
    }
    console.timeEnd('Check format and get ogp image');

    console.time('Write Database');

    // save image to db
    await setHashAndImageUrl(castHash, imageUrl);

    console.timeEnd('Write Database');

    console.timeEnd('cast action total time');

    return c.res({
      type: 'frame',
      path: framePath + '/' + castHash,
    });
  },
  // TODO Descriptionを変える
  {
    name,
    icon: 'image',
    description:
      "In celebration of July 4th at /card, we've made a Cardian recruitment poster, featuring Degen Sam!",
  },
);

const getImageUrl = async (mediaUrl: string): Promise<string | null> => {
  let imageUrl: string | null = null;

  // // Playwrightでページをロードしてメタタグを取得

  const html = await fetch(mediaUrl).then((res) => res.text());
  const dom = new JSDOM(html);
  const meta = dom.window.document.querySelectorAll('meta');

  let frameImage = '';
  let ogImage = '';
  let twitterImage = '';

  meta.forEach((tag) => {
    const property = tag.getAttribute('property');
    const name = tag.getAttribute('name');
    const content = tag.getAttribute('content');

    // property、name、itempropのいずれかが目的の属性である場合にcontentを取得
    if (
      property === 'fc:frame:image' ||
      name === 'fc:frame:image' ||
      name === 'twitter:image'
    ) {
      frameImage = content || '';
    }
    if (property === 'og:image' || name === 'og:image') {
      ogImage = content || '';
    }
    if (name === 'twitter:image') {
      twitterImage = content || '';
    }
  });

  imageUrl = frameImage || ogImage || twitterImage || null;

  return imageUrl;
};

export const GET = handle(app);
export const POST = handle(app);
