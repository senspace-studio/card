import { Button, Frog } from 'frog';
import sharp from 'sharp';
import { BACKEND_URL, BASE_URL, IS_MAINTENANCE } from '../constant/config.js';
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
  pfpURL: string;
};

const title = 'Stack | House of Cardians';

const superFluidURLBase = `https://app.superfluid.finance/token/degen/0xda58fa9bfc3d3960df33ddd8d4d762cf8fa6f7ad?view=`;

const resultS3URLBase =
  'https://maincardbatchstack-maincard28027c69-lwnswwt35wuk.s3.ap-northeast-1.amazonaws.com';

export const stackApp = new Frog<{ State: State }>({
  assetsPath: '/',
  basePath: '/',
  initialState: {
    verifiedAddress: '',
    username: '',
  },
});

stackApp.frame('/', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const { fid } = c.frameData!;
  let { verifiedAddress } = c.previousState;

  if (!verifiedAddress) {
    const { verifiedAddresses, userName, pfp_url } = await getFarcasterUserInfo(
      fid,
    );

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
      prev.pfpURL = pfp_url;
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

  const date =
    dayjs().utc().get('hours') < 5 ? dayjs().subtract(1, 'day') : dayjs();

  const { totalStack, userStack } = await getStack(
    date.subtract(1, 'day').valueOf(),
    verifiedAddress,
  );
  const rewardShare = (userStack / totalStack) * 100;
  const { userRewards, totalRewards } = await getRewards(
    date.valueOf(),
    totalStack,
    rewardShare,
  );
  const rewardAmount = userRewards?.toFixed(0) || '0';
  const totalRewardAmount = totalRewards?.toFixed(0) || '0';

  const params = encodeURI(
    JSON.stringify({
      date: date.valueOf(),
      rewardAmount,
      totalRewardAmount,
      rewardShare: rewardShare.toFixed(2),
    }),
  );

  return c.res({
    title,
    image: `/stack/image/rewards/${params}`,
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/stats">Stats</Button>,
      <Button.Link href={superFluidURL}>Stream</Button.Link>,
      <Button action={`${BASE_URL}/top`}>Back</Button>,
    ],
  });
});

stackApp.frame('/stats', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const { fid } = c.frameData!;
  let { verifiedAddress } = c.previousState;

  if (!verifiedAddress) {
    const { verifiedAddresses, userName, pfp_url } = await getFarcasterUserInfo(
      fid,
    );

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
      prev.pfpURL = pfp_url;
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

  const date =
    dayjs().utc().get('hours') < 5 ? dayjs().subtract(1, 'day') : dayjs();
  const yesterday = date.subtract(1, 'day');

  const { totalStack, userStack, rank } = await getStack(
    date.subtract(1, 'day').valueOf(),
    verifiedAddress,
  );
  const rewardsShare = (userStack / totalStack) * 100;
  const { totalStack: yesterdayTotalStack, userStack: yesterdayUserStack } =
    await getStack(yesterday.subtract(1, 'day').valueOf(), verifiedAddress);
  const yesterdayRewardsShare =
    (yesterdayUserStack / yesterdayTotalStack) * 100;

  const { userRewards } = await getRewards(
    date.valueOf(),
    totalStack,
    rewardsShare,
  );
  const { userRewards: yesterdayUserRewards } = await getRewards(
    yesterday.valueOf(),
    yesterdayTotalStack,
    (yesterdayUserStack / yesterdayTotalStack) * 100,
  );

  const { result: fourDaysBattleResult } = await getLast4DaysResult(
    date.valueOf(),
  );
  const user4DaysBattleResult = fourDaysBattleResult.find(
    (data: any) => data.address.toLowerCase() === verifiedAddress.toLowerCase(),
  );

  const { result: yesterdayFourDaysBattleResult } = await getLast4DaysResult(
    date.subtract(1, 'day').valueOf(),
  );
  const yesterdayUser4DaysBattleResult = yesterdayFourDaysBattleResult.find(
    (data: any) => data.address.toLowerCase() === verifiedAddress.toLowerCase(),
  );

  const { battles: invitationBattles } = await getInvitationBattles(
    date.valueOf(),
  );
  const userInvitationBattles = invitationBattles.find(
    (data: any) => data.address.toLowerCase() === verifiedAddress.toLowerCase(),
  );

  const { battles: yesterdayInvitationBattles } = await getInvitationBattles(
    date.subtract(1, 'day').valueOf(),
  );
  const yesterdayUserInvitationBattles = yesterdayInvitationBattles.find(
    (data: any) => data.address.toLowerCase() === verifiedAddress.toLowerCase(),
  );

  const name = c.previousState.username;
  const pfpURL = encodeURIComponent(c.previousState.pfpURL);
  const stats = {
    rewardsAmount: userRewards ? userRewards.toFixed(2) : '0',
    battleRecord: `${user4DaysBattleResult.win}/${user4DaysBattleResult.lose}/${user4DaysBattleResult.draw}`,
    friendsPlays: userInvitationBattles?.battles?.toString() || '0',
    rewardsShare: rewardsShare.toFixed(2),
  };
  const statsChange = {
    rewardsAmountChange:
      userRewards && yesterdayUserRewards
        ? ((userRewards / yesterdayUserRewards) * 100 - 100).toFixed(1)
        : '0',
    battleRecordChange: `${
      user4DaysBattleResult?.win - yesterdayUser4DaysBattleResult?.win || 0
    }/${
      user4DaysBattleResult?.lose - yesterdayUser4DaysBattleResult?.lose || 0
    }/${user4DaysBattleResult.draw - yesterdayUser4DaysBattleResult.draw || 0}`,
    friendsPlaysChange: (
      (userInvitationBattles.battles / yesterdayUserInvitationBattles.battles) *
        100 -
        100 || 0
    ).toFixed(1),
    rewardsShareChange: (
      (rewardsShare / yesterdayRewardsShare) * 100 -
      100
    ).toFixed(1),
  };

  const params = {
    rank: rank.toString(),
    name,
    pfpURL,
    date: date.valueOf(),
    stats,
    statsChange,
  } as StatsImageParams;

  const superFluidURL = `${superFluidURLBase}${verifiedAddress}`;

  return c.res({
    title,
    image: `/stack/image/stats/${encodeURIComponent(JSON.stringify(params))}`,
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/">Back</Button>,
      <Button.Link href="https://paragraph.xyz/@houseofcardians/house-of-cardians-simplified">
        More Rewards
      </Button.Link>,
    ],
  });
});

stackApp.frame('/leaderboard', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

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
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

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
      <Button.Link href={superFluidURL}>Stream</Button.Link>,
    ],
  });
});

stackApp.frame('/leaderboard-invitation', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

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

stackApp.hono.get('/image/rewards/:params', async (c) => {
  const { params } = c.req.param();
  const { date, rewardAmount, totalRewardAmount, rewardShare } = JSON.parse(
    decodeURIComponent(params),
  );

  const canvas = sharp('./public/images/stack/rewards.png').resize(1000, 1000);

  const [
    dateImage,
    scoreImage,
    scoreUnitImage,
    ticketSymbolImage,
    totalRewardImage,
    rewardShareImage,
    updatedAtImage,
  ] = await Promise.all([
    sharp({
      text: {
        text: `<span foreground="#fff" letter_spacing="1000">${dayjs(
          Number(date),
        ).format('M/D/YYYY')}</span>`,
        rgba: true,
        width: 550,
        height: 20,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${Number(
          rewardAmount,
        ).toLocaleString()}</span>`,
        rgba: true,
        width: 550,
        height: 55,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">DEGEN</span>`,
        rgba: true,
        width: 550,
        height: 35,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp('./public/images/stack/degen-degen.png').png().toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${Number(
          totalRewardAmount,
        ).toLocaleString()}</span>`,
        rgba: true,
        width: 550,
        height: 40,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${rewardShare}%</span>`,
        rgba: true,
        width: 550,
        height: 30,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" letter_spacing="1000">${dayjs(
          date,
        ).format('M/D')} 3:00 (UTC)</span>`,
        rgba: true,
        width: 550,
        height: 20,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
  ]);

  canvas.composite([
    {
      input: dateImage,
      left: 230,
      top: 450,
    },
    {
      input: scoreImage,
      left: 470 - rewardAmount.length * 15,
      top: 437,
    },
    {
      input: scoreUnitImage,
      left: 620,
      top: 447,
    },
    {
      input: ticketSymbolImage,
      left: 440 - totalRewardAmount.length * 10,
      top: 635,
    },
    {
      input: totalRewardImage,
      left: 500 - totalRewardAmount.length * 10,
      top: 635,
    },
    {
      input: rewardShareImage,
      left: 450,
      top: 760,
    },
    {
      input: updatedAtImage,
      left: 500,
      top: 953,
    },
  ]);

  const png = await canvas.png().toBuffer();

  return c.newResponse(png, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'max-age=3600',
  });
});

stackApp.hono.get('/image/stats/:params', async (c) => {
  const { params } = c.req.param();

  const {
    rank,
    name,
    pfpURL,
    date,
    stats: { rewardsAmount, battleRecord, friendsPlays, rewardsShare },
    statsChange: {
      rewardsAmountChange,
      battleRecordChange,
      friendsPlaysChange,
      rewardsShareChange,
    },
  } = JSON.parse(decodeURIComponent(params)) as StatsImageParams;

  const canvas = sharp('./public/images/stack/stats.png').resize(1000, 1000);

  const genPfP = async () => {
    const topPfpSize = 60;
    const response = await fetch(pfpURL);
    const pfpBuffer = await response.arrayBuffer();
    const topCircleMask = Buffer.from(
      `<svg><circle cx="${topPfpSize / 2}" cy="${topPfpSize / 2}" r="${
        topPfpSize / 2
      }" /></svg>`,
    );
    const topPfpImage = await sharp(pfpBuffer)
      .resize(topPfpSize, topPfpSize)
      .composite([{ input: topCircleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    return topPfpImage;
  };

  const [
    rankImage,
    nameImage,
    pfpImage,
    dateImage,
    rewardsAmountImage,
    battleRecordImage,
    friendsPlaysImage,
    rewardsShareImage,
    rewardsAmountChangeImage,
    battleRecordChangeImage,
    friendsPlaysChangeImage,
    rewardsShareChangeImage,
    updatedAtImage,
    upImage,
    downImage,
  ] = await Promise.all([
    sharp({
      text: {
        text: `<span font_weight="bold" foreground="#fff" letter_spacing="1000">${rank}</span>`,
        rgba: true,
        width: 550,
        height: rank.length > 2 ? 30 : 40,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span font_weight="bold" foreground="#fff" letter_spacing="1000">@${name}</span>`,
        rgba: true,
        width: 550,
        height: 24,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    genPfP(),
    sharp({
      text: {
        text: `<span foreground="#dcb92f" font_weight="bold" letter_spacing="1000">${dayjs(
          date,
        ).format('M/D/YYYY')}</span>`,
        font: 'Bigelow Rules',
        fontfile: './public/fonts/BigelowRules-Regular.ttf',
        rgba: true,
        width: 550,
        height: 35,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${Number(
          rewardsAmount,
        ).toLocaleString()}</span>`,
        rgba: true,
        width: 550,
        height: Number(rewardsAmount) > 1000 ? 42 : 35,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${battleRecord}</span>`,
        rgba: true,
        width: 550,
        height: 33,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${friendsPlays}</span>`,
        rgba: true,
        width: 550,
        height: 33,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${rewardsShare}%</span>`,
        rgba: true,
        width: 550,
        height: 33,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${rewardsAmountChange}%</span>`,
        rgba: true,
        width: 550,
        height: 33,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${battleRecordChange}</span>`,
        rgba: true,
        width: 550,
        height: 33,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${friendsPlaysChange}%</span>`,
        rgba: true,
        width: 550,
        height: 33,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${rewardsShareChange}%</span>`,
        rgba: true,
        width: 550,
        height: 33,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp({
      text: {
        text: `<span foreground="#fff" letter_spacing="1000">${dayjs(
          date,
        ).format('M/D')} 3:00 (UTC)</span>`,
        rgba: true,
        width: 550,
        height: 20,
        align: 'left',
      },
    })
      .png()
      .toBuffer(),
    sharp('./public/images/stack/up.png').resize(20, 20).png().toBuffer(),
    sharp('./public/images/stack/down.png').resize(20, 20).png().toBuffer(),
  ]);

  const blankImage = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();

  canvas.composite([
    {
      input: rankImage,
      left: 225 - (rank.length > 1 ? rank.length * 10 : 0),
      top: 410,
    },
    { input: pfpImage, left: 385 - name.length * 4, top: 350 },
    { input: nameImage, left: 470 - name.length * 4, top: 370 },
    { input: dateImage, left: 435, top: 454 },
    {
      input: rewardsAmountImage,
      left: 485 - rewardsAmount.length * 13,
      top: 525,
    },
    {
      input: battleRecordImage,
      left: 470 - battleRecord.length * 8,
      top: 620,
    },
    {
      input: friendsPlaysImage,
      left: 485 - friendsPlays.length * 10,
      top: 710,
    },
    { input: rewardsShareImage, left: 457 - rewardsShare.length * 5, top: 795 },
    {
      input: rewardsAmountChangeImage,
      left: 760 - rewardsAmountChange.length * 7,
      top: 525,
    },
    {
      input: rewardsAmountChange.includes('-')
        ? downImage
        : rewardsAmountChange === '0.0'
        ? blankImage
        : upImage,
      left: 730 - rewardsAmountChange.length * 7,
      top: 531,
    },
    {
      input: battleRecordChangeImage,
      left: 760 - battleRecordChange.length * 8,
      top: 620,
    },
    {
      input: battleRecordChange.split('/')[0].includes('-')
        ? downImage
        : battleRecordChange.split('/')[0] === '0'
        ? blankImage
        : upImage,
      left: 725 - battleRecordChange.length * 8,
      top: 627,
    },
    {
      input: friendsPlaysChangeImage,
      left: 755 - friendsPlaysChange.length * 7,
      top: 710,
    },
    {
      input: friendsPlaysChange.includes('-')
        ? downImage
        : friendsPlaysChange === '0.0'
        ? blankImage
        : upImage,
      left: 725 - friendsPlaysChange.length * 7,
      top: 717,
    },
    {
      input: rewardsShareChangeImage,
      left: 755 - rewardsShareChange.length * 5,
      top: 795,
    },
    {
      input: rewardsShareChange.includes('-')
        ? downImage
        : rewardsShareChange === '0.0'
        ? blankImage
        : upImage,
      left: 725 - rewardsShareChange.length * 5,
      top: 802,
    },
    { input: updatedAtImage, left: 500, top: 953 },
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

  const now =
    dayjs().utc().get('hours') < 5 ? dayjs().subtract(1, 'day') : dayjs();
  const { result, updatedAt } = await getLast4DaysResult(now.valueOf());

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

  const now =
    dayjs().utc().get('hours') < 5 ? dayjs().subtract(1, 'day') : dayjs();
  const { battles, updatedAt } = await getInvitationBattles(now.valueOf());

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

export type StatsImageParams = {
  rank: string;
  name: string;
  pfpURL: string;
  date: number;
  stats: {
    rewardsAmount: string;
    battleRecord: string;
    friendsPlays: string;
    rewardsShare: string;
  };
  statsChange: {
    rewardsAmountChange: string;
    battleRecordChange: string;
    friendsPlaysChange: string;
    rewardsShareChange: string;
  };
};

// 共通関数
const getLast4DaysResult = async (date: number) => {
  const res = await fetch(
    `${resultS3URLBase}/calcLast4DaysResult/${dayjs(date).format(
      'YYYY-MM-DD',
    )}.json`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  return await res.json();
};

const getInvitationBattles = async (date: number) => {
  const res = await fetch(
    `${resultS3URLBase}/calcInvitationBattles/${dayjs(date).format(
      'YYYY-MM-DD',
    )}.json`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  return await res.json();
};

const getStack = async (date: number, userAddress?: string) => {
  const dateFileKey = dayjs(date).format('YYYY-MM-DD') + '.json';

  const resStack = await fetch(
    `${resultS3URLBase}/individualStack/${dateFileKey}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  const dataStack = await resStack.json();
  const totalStack: number = dataStack.data.data.reduce(
    (acc: number, { score }: { score: number }) => acc + score,
    0,
  );
  const userStack: number =
    dataStack.data.data.find(
      ({ address }: { address: string }) =>
        address.toLowerCase() === userAddress?.toLowerCase(),
    )?.score || 0;

  const rank: number =
    userAddress &&
    dataStack.data.data
      .sort((a: any, b: any) => b.score - a.score)
      .findIndex(
        (data: any) =>
          data.address.toLowerCase() === userAddress?.toLowerCase(),
      ) + 1;

  return { totalStack, userStack, rank };
};

const getRewards = async (
  date: number,
  totalStack: number,
  userShare?: number,
) => {
  const battleRes = await fetch(
    `${resultS3URLBase}/battle/${dayjs(date)
      .subtract(2, 'day')
      .format('YYYY-MM-DD')}.json`,
  );
  const battleData = await battleRes.json();

  const rewardRes = await fetch(`${resultS3URLBase}/reward/history.json`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const rewardData = (await rewardRes.json()).find(
    (r: any) => r.date === dayjs(date).format('YYYY-MM-DD'),
  );

  const h = battleData.data.length * 190 * rewardData.bonusMultiplier;
  const totalRewards =
    h * (1 - Math.exp(-1 * rewardData.difficulty * totalStack));
  const userRewards = userShare && (totalRewards * userShare) / 100;

  return { totalRewards, userRewards };
};
