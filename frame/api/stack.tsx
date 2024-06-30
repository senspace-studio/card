import { Button, Frog } from 'frog';
import sharp from 'sharp';
import { BACKEND_URL, BASE_URL } from '../constant/config.js';
import {
  getFarcasterUserInfo,
  getFarcasterUserInfoByAddress,
} from '../lib/neynar.js';
import { checkInvitation } from '../lib/contract.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

type State = {
  verifiedAddresses: `0x${string}`[];
  verifiedAddress: string;
  username: string;
};

const title = 'Stack | House of Cardians';

const superFluidURLBase = `https://app.superfluid.finance/token/base/0x46fd5cfb4c12d87acd3a13e92baa53240c661d93?view=`;

const resultS3URLBase =
  'https://maincardbatchstack-maincard28027c69-zfmx3izxftm1.s3.ap-northeast-1.amazonaws.com';

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

    if (!verifiedAddresses || verifiedAddresses.length === 0) {
      return c.res({
        title,
        image: '/images/verify.png',
        imageAspectRatio: '1:1',
        intents: [<Button action={BASE_URL}>Back</Button>],
      });
    }

    c.deriveState((prev) => {
      prev.verifiedAddress = verifiedAddresses[0];
      prev.username = userName;
    });
    verifiedAddress = verifiedAddresses[0];

    const hasInvitation = await checkInvitation(verifiedAddresses[0]);

    if (!hasInvitation) {
      return c.res({
        title,
        image: '/images/war/no_invi.png',
        imageAspectRatio: '1:1',
        intents: [<Button action="/">Back</Button>],
      });
    }
  }

  const superFluidURL = `${superFluidURLBase}${verifiedAddress}`;

  const res = await fetch(`${BACKEND_URL}/points/total`);

  const { totalScore } = await res.json();

  return c.res({
    title,
    image: `/stack/image/${(Number(totalScore || 0) * 100).toFixed(0)}`,
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/leaderboard">Leader Board</Button>,
      <Button.Link href={superFluidURL}>Rewards</Button.Link>,
      <Button action={`${BASE_URL}/top`}>Back</Button>,
    ],
  });
});

stackApp.frame('/leaderboard', async (c) => {
  const { username, verifiedAddress } = c.previousState;

  const superFluidURL = `${superFluidURLBase}${verifiedAddress}`;

  return c.res({
    title,
    image: `/stack/image/leaderboard/${verifiedAddress}/${username}`,
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/leaderboard-battle">Battle</Button>,
      <Button action="/leaderboard-invitation">Invitation</Button>,
      <Button action="/">Back</Button>,
      <Button.Link href={superFluidURL}>Rewards</Button.Link>,
    ],
  });
});

stackApp.frame('/leaderboard-battle', async (c) => {
  const { username, verifiedAddress } = c.previousState;

  const superFluidURL = `${superFluidURLBase}${verifiedAddress}`;

  return c.res({
    title,
    image: `/stack/image/leaderboard-battle/${verifiedAddress}/${username}`,
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/leaderboard">Stack</Button>,
      <Button action="/leaderboard-invitation">Invitation</Button>,
      <Button action="/">Back</Button>,
      <Button.Link href={superFluidURL}>Rewards</Button.Link>,
    ],
  });
});

stackApp.frame('/leaderboard-invitation', async (c) => {
  const { username, verifiedAddress } = c.previousState;

  const superFluidURL = `${superFluidURLBase}${verifiedAddress}`;

  return c.res({
    title,
    image: `/stack/image/leaderboard-invitation/${verifiedAddress}/${username}`,
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/leaderboard">Stack</Button>,
      <Button action="/leaderboard-battle">Battle</Button>,
      <Button action="/">Back</Button>,
      <Button.Link href={superFluidURL}>Rewards</Button.Link>,
    ],
  });
});

stackApp.hono.get('/image/:score', async (c) => {
  const params = c.req.param();
  const score = Number(params.score);

  let bgPath = './public/images/stack/stack_1.png';
  if (score > 100000) {
    bgPath = './public/images/stack/stack_2.png';
  } else if (score > 300000) {
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
    'Cache-Control': 'max-age=3600',
  });
});

stackApp.hono.get('/image/leaderboard/:address/:name', async (c) => {
  const params = c.req.param();
  const address = params.address;
  const name = params.name;

  const canvas = sharp('./public/images/stack/stack_leaders.png').resize(
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
    { name, address, score: Number(myScore[0]?.score || 0) * 100 },
    ...topScores.map((score: any) => ({
      name: score.name,
      address: score.address,
      score: Number(score.score) * 100,
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
        top: 335 + index * 144,
        left: 240,
      };
    }),
  );

  const usersScore = await Promise.all(
    scores.map(async (score, index) => {
      const userScore = await sharp({
        text: {
          text: `<span foreground="white" letter_spacing="2">${score.score
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
        top: 340 + index * 146,
        left: 760 - score.score.toFixed(0).toString().length * 27,
      };
    }),
  );

  const updatedAt = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="2">${dayjs(
        myScore[0].createdAt,
      ).format('M/DD HH:mm')} (UTC)
      </span>`,
      rgba: true,
      width: 750,
      height: 39,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  canvas.composite([
    ...usersName,
    ...usersScore,
    { input: updatedAt, top: 950, left: 525 },
  ]);

  const png = await canvas.png().toBuffer();

  return c.newResponse(png, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'max-age=3600',
  });
});

stackApp.hono.get('/image/leaderboard-battle/:address/:name', async (c) => {
  const params = c.req.param();
  const address = params.address;
  const name = params.name;

  const canvas = sharp('./public/images/stack/battle_leaders.png').resize(
    1000,
    1000,
  );

  const res = await fetch(
    `${resultS3URLBase}/calcLast7DaysResult/result.json`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  const { result, updatedAt } = await res.json();

  const getTop3Scores = async () => {
    // order result by win, and get top 3
    const top3 = result.sort((a: any, b: any) => b.win - a.win).slice(0, 3);
    const userinfos = await Promise.all(
      top3.map(async (score: any) => {
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

  const topScores = await getTop3Scores();

  const myScore = result.find(
    (score: any) => score.address.toLowerCase() === address.toLowerCase(),
  );

  const scores = [
    { name, address, ...myScore },
    ...topScores.map((score: any) => ({
      name: score.name,
      address: score.address,
      ...score,
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
          height: 55,
          align: 'left',
        },
      })
        .png()
        .toBuffer();
      return {
        input: userName,
        top: 335 + index * 147,
        left: 240,
      };
    }),
  );

  const usersScore = await Promise.all(
    scores.map(async (score, index) => {
      const text = `${score.win} / ${score.lose} / ${score.draw}`;
      const userScore = await sharp({
        text: {
          text: `<span foreground="white" letter_spacing="2">${text}</span>`,
          rgba: true,
          width: 750,
          height: 30,
          align: 'left',
        },
      })
        .png()
        .toBuffer();
      return {
        input: userScore,
        top: 344 + index * 146,
        left: 850 - text.length * 23,
      };
    }),
  );
  const updatedAtLabel = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="2">${dayjs(
        Number(updatedAt + '000'),
      )
        .utc()
        .format('M/DD HH:mm')} (UTC)
      </span>`,
      rgba: true,
      width: 750,
      height: 39,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  canvas.composite([
    ...usersName,
    ...usersScore,
    { input: updatedAtLabel, top: 950, left: 625 },
  ]);

  const png = await canvas.png().toBuffer();

  return c.newResponse(png, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'max-age=3600',
  });
});

stackApp.hono.get('/image/leaderboard-invitation/:address/:name', async (c) => {
  const params = c.req.param();
  const address = params.address;
  const name = params.name;

  const canvas = sharp('./public/images/stack/invitation_leaders.png').resize(
    1000,
    1000,
  );

  const res = await fetch(
    `${resultS3URLBase}/calcInvitationBattles/result.json`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  const { battles, updatedAt } = await res.json();

  const getTop3Scores = async () => {
    // order result by win, and get top 3
    const top3 = battles
      .sort((a: any, b: any) => b.battles - a.battles)
      .slice(0, 3);
    const userinfos = await Promise.all(
      top3.map(async (score: any) => {
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

  const topScores = await getTop3Scores();

  const myScore = battles.find(
    (score: any) => score.address.toLowerCase() === address.toLowerCase(),
  );

  const scores = [
    { name, address, ...myScore },
    ...topScores.map((score: any) => ({
      name: score.name,
      address: score.address,
      ...score,
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
          height: 55,
          align: 'left',
        },
      })
        .png()
        .toBuffer();
      return {
        input: userName,
        top: 335 + index * 147,
        left: 240,
      };
    }),
  );

  const usersScore = await Promise.all(
    scores.map(async (score, index) => {
      const text = `${score.battles || 0}`;
      const userScore = await sharp({
        text: {
          text: `<span foreground="white" letter_spacing="2">${text}</span>`,
          rgba: true,
          width: 750,
          height: 30,
          align: 'left',
        },
      })
        .png()
        .toBuffer();
      return {
        input: userScore,
        top: 344 + index * 146,
        left: 770 - text.length * 23,
      };
    }),
  );
  const updatedAtLabel = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="2">${dayjs(
        Number(updatedAt + '000'),
      )
        .utc()
        .format('M/DD HH:mm')} (UTC)
      </span>`,
      rgba: true,
      width: 750,
      height: 39,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  canvas.composite([
    ...usersName,
    ...usersScore,
    { input: updatedAtLabel, top: 950, left: 615 },
  ]);

  const png = await canvas.png().toBuffer();

  return c.newResponse(png, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'max-age=3600',
  });
});
