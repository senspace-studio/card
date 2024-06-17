import { Button, Frog } from 'frog';
import sharp from 'sharp';
import { BACKEND_URL, BASE_URL } from '../constant/config.js';
import {
  getFarcasterUserInfo,
  getFarcasterUserInfoByAddress,
} from '../lib/neynar.js';

type State = {
  verifiedAddress: string;
  username: string;
};

export const stackApp = new Frog<{ State: State }>({
  assetsPath: '/',
  basePath: '/',
  initialState: {
    verifiedAddress: '',
    username: '',
  },
});

stackApp.frame('/', async (c) => {
  const { fid } = c.frameData!;
  let { verifiedAddress } = c.previousState;

  if (!verifiedAddress) {
    const { verifiedAddresses, userName } = await getFarcasterUserInfo(fid);
    c.deriveState((prev) => {
      prev.verifiedAddress = verifiedAddresses[0];
      prev.username = userName;
    });
    verifiedAddress = verifiedAddresses[0];
  }

  const superFluidURL = `https://app.superfluid.finance/token/degen/0xda58fa9bfc3d3960df33ddd8d4d762cf8fa6f7ad?view=${verifiedAddress}`;

  const res = await fetch(`${BACKEND_URL}/points/total`);

  const { totalScore } = await res.json();

  return c.res({
    image: `/stack/image/${Number(totalScore || 0).toFixed(0)}`,
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/leaderboard">Leader Board</Button>,
      <Button.Link href={superFluidURL}>Stream</Button.Link>,
      <Button action={`${BASE_URL}`}>Back</Button>,
    ],
  });
});

stackApp.frame('/leaderboard', async (c) => {
  const { username, verifiedAddress } = c.previousState;

  return c.res({
    image: `/stack/image/leaderboard/${verifiedAddress}/${username}`,
    imageAspectRatio: '1:1',
    intents: [<Button action="/">Back</Button>],
  });
});

stackApp.hono.get('/image/:score', async (c) => {
  const params = c.req.param();
  const score = Number(params.score);

  let bgPath = './public/images/stack/stack_1.png';
  if (score > 1000) {
    bgPath = './public/images/stack/stack_2.png';
  } else if (score > 50000) {
    bgPath = './public/images/stack/stack_3.png';
  }

  const canvas = sharp(bgPath).resize(1000, 1000);

  const scoreImage = await sharp({
    text: {
      text: `<span foreground="#dbb930" letter_spacing="1000">${Number(
        score,
      ).toLocaleString()}</span>`,
      font: 'Bigelow Rules',
      fontfile: './public/fonts/BigelowRules-Regular.ttf',
      rgba: true,
      width: 550,
      height: 90,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  canvas.composite([
    {
      input: scoreImage,
      left: 80,
      top: 160,
    },
  ]);

  const png = await canvas.png().toBuffer();

  return c.newResponse(png, 200, {
    'Content-Type': 'image/png',
  });
});

stackApp.hono.get('/image/leaderboard/:address/:name', async (c) => {
  const params = c.req.param();
  const address = params.address;
  const name = params.name;

  const canvas = sharp('./public/images/stack/leaderboard.png').resize(
    1000,
    1000,
  );

  const getTop3Scores = async () => {
    const res = await fetch(`${BACKEND_URL}/points`);
    const scores = (await res.json()).slice(0, 3);

    const userinfos = await Promise.all(
      scores.map(async (score: any) => {
        const account = (await getFarcasterUserInfoByAddress(score.address))
          .userName;
        return {
          ...score,
          name: account,
        };
      }),
    );

    return userinfos;
  };

  const [myScoreRes, topScores] = await Promise.all([
    fetch(`${BACKEND_URL}/points/${address}`),
    getTop3Scores(),
  ]);
  const myScore = await myScoreRes.json();

  const scores = [
    { name, address, score: Number(myScore[0]?.score || 0) },
    ...topScores.map((score: any) => ({
      name: score.name,
      address: score.address,
      score: Number(score.score),
    })),
  ];

  const usersName = await Promise.all(
    scores.map(async (score, index) => {
      const userName = await sharp({
        text: {
          text: `<span foreground="white" letter_spacing="1000">${score.name}</span>`,
          font: 'Bigelow Rules',
          fontfile: './public/fonts/BigelowRules-Regular.ttf',
          rgba: true,
          width: 550,
          height: 60,
          align: 'left',
        },
      })
        .png()
        .toBuffer();
      return {
        input: userName,
        top: 345 + index * 151,
        left: 220,
      };
    }),
  );

  const usersScore = await Promise.all(
    scores.map(async (score, index) => {
      const userScore = await sharp({
        text: {
          text: `<span foreground="white" letter_spacing="2">${Number(
            score.score,
          )
            .toFixed(0)
            .toLocaleString()}</span>`,
          rgba: true,
          width: 750,
          height: 40,
          align: 'left',
        },
      })
        .png()
        .toBuffer();
      return {
        input: userScore,
        top: 350 + index * 152,
        left: 760 - score.score.toFixed(0).toString().length * 27,
      };
    }),
  );

  canvas.composite([...usersName, ...usersScore]);

  const png = await canvas.png().toBuffer();

  return c.newResponse(png, 200, {
    'Content-Type': 'image/png',
  });
});
