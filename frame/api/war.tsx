import { Button, Frog, TextInput } from 'frog';
import { NEYNAR_API_KEY, WAR_CONTRACT_ADDRESS } from '../constant/config.js';
import tweClient from '../lib/thirdweb-engine/index.js';
import { convertCardValue } from '../lib/convertCardValue.js';
import {
  cardContract,
  warContract,
  inivtationNFTContracrt,
  warPoolContract,
} from '../lib/contract.js';

import sharp from 'sharp';
import JSON from 'json-bigint';
import { CARD_ABI, WAR_ABI } from '../constant/abi.js';
import {
  zeroAddress,
  encodePacked,
  keccak256,
  parseEther,
  decodeEventLog,
  Address,
} from 'viem';
import { NeynarAPIClient, FeedType, FilterType } from '@neynar/nodejs-sdk';
import {
  setGameInfo,
  updateChallenger,
  updateResult,
  getGameInfoByGameId,
} from '../lib/database.js';
import {
  getFarcasterUserInfo,
  getFarcasterUserInfoByAddress,
} from '../lib/neynar';

const shareUrlBase = 'https://warpcast.com/~/compose?text=';
const embedParam = '&embeds[]=';
const shareText = encodeURIComponent('To challenge?');

type State = {
  quantities: number[];
  address: `0x${string}`;
  pfp_url: string;
  userName: string;
  card: number;
  wager: number;
  gameId: `0x${string}`;
  c_address?: `0x${string}`;
  c_pfp_url?: string;
  c_userName?: string;
  c_card?: number;
  signature?: Address;
};

export const warApp = new Frog<{ State: State }>({
  initialState: {
    quantities: [],
    address: '',
    pfp_url: '',
    userName: '',
    card: 0,
    wager: 0,
    gameId: '',
  },
  headers: {
    'cache-control': 'max-age=0',
  },
});

warApp.frame('/', (c) => {
  return c.res({
    image: '/images/war/title.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/make-duel">make duel</Button>,
      <Button.Link href="https://google.com">find match</Button.Link>,
      <Button.Link href="https://google.com">follow</Button.Link>,
    ],
  });
});

warApp.frame('/rule', (c) => {
  // TODO 画像が出来たら差し替える
  return c.res({
    image: '/images/war/bet.png',
    imageAspectRatio: '1:1',
    intents: [<Button action={`/`}>Back</Button>],
  });
});

warApp.frame('/make-duel', async (c) => {
  const { frameData } = c;
  const fid = frameData?.fid;
  const { pfp_url, userName, verifiedAddresses } = await getFarcasterUserInfo(
    fid,
  );

  const verifyedAddress = verifiedAddresses[0];

  // Check Verifyed Address
  if (!verifiedAddresses || verifiedAddresses.length === 0) {
    return c.res({
      image: '/images/verify.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const address = verifyedAddress as `0x${string}`;

  // Check Invitation NFT
  const hasNFT = await checkInvitation(address);
  if (!hasNFT) {
    return c.res({
      image: '/images/war/no_invi.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const quantities = await getQuantities(address, c);

  c.deriveState((prevState) => {
    prevState.quantities = quantities;
    prevState.address = address;
    prevState.userName = userName;
    prevState.pfp_url = pfp_url;
  });

  return c.res({
    image:
      '/war/image/score/' +
      encodeURIComponent(JSON.stringify({ quantities, address })),
    imageAspectRatio: '1:1',
    intents: [
      <TextInput placeholder="11 or J or ..." />,
      // <Button action="/bet">Set</Button>,
      <Button action="/preview">Set</Button>,
    ],
  });
});

// warApp.frame('/bet', async (c) => {
//   const { inputText } = c;

//   const { quantities, card } = c.previousState;

//   const inputCardNumber = inputText || card;

//   const cardNumber = convertCardValue(inputCardNumber as string);

//   const errorMessage = checkCardNumber(cardNumber, quantities);

//   if (errorMessage) {
//     const params = encodeURIComponent(
//       JSON.stringify({
//         message: errorMessage,
//         quantities: quantities,
//       }),
//     );

//     return c.res({
//       image: `/war/image/error/${params}`,
//       imageAspectRatio: '1:1',
//       intents: [
//         <Button action="/make-duel">Back</Button>,
//         <Button.Link href="https://google.com">go to</Button.Link>,
//       ],
//     });
//   }

//   // make signature
//   const signature = await getSignature(c);

//   if (!signature) {
//     const params = encodeURIComponent(
//       JSON.stringify({
//         message: 'Faild get signature',
//       }),
//     );

//     return c.res({
//       image: `/war/image/error/${params}`,
//       imageAspectRatio: '1:1',
//       intents: [<Button action="/make-duel">Back</Button>],
//     });
//   }

//   c.deriveState((prevState) => {
//     prevState.card = cardNumber;
//     prevState.signature = signature as Address;
//   });

//   return c.res({
//     image: '/images/war/bet.png',
//     imageAspectRatio: '1:1',
//     intents: [
//       <TextInput placeholder="999" />,
//       <Button action="/preview">Bet</Button>,
//     ],
//   });
// });

warApp.frame('/preview', async (c) => {
  const { inputText } = c;
  const { userName, pfp_url, card, quantities, address } = c.previousState;

  // bet機能をリリースする時は/bet frameで行うためこの辺はスキップ
  const inputCardNumber = inputText || card;

  const cardNumber = convertCardValue(inputCardNumber as string);

  const errorMessage = checkCardNumber(cardNumber, quantities);

  if (errorMessage) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: errorMessage,
        quantities: quantities,
        address,
      }),
    );

    return c.res({
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [
        <Button action="/make-duel">Back</Button>,
        <Button.Link href="https://google.com">go to</Button.Link>,
      ],
    });
  }

  // make signature
  const signature = await getSignature(c);

  if (!signature) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: 'Failed get signature',
        quantities: quantities,
        address,
      }),
    );

    return c.res({
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [<Button action="/make-duel">Back</Button>],
    });
  }

  c.deriveState((prevState) => {
    prevState.card = cardNumber;
    prevState.signature = signature as Address;
  });

  // bet機能が出来たらコメントを外す
  // if (safeIsNaN(inputText)) {
  //   const params = encodeURIComponent(
  //     JSON.stringify({
  //       message: 'Invalid Number',
  //       quantities: quantities,
  //     }),
  //   );

  //   return c.res({
  //     image: `/war/image/error/${params}`,
  //     imageAspectRatio: '1:1',
  //     intents: [<Button action="/bet">Back</Button>],
  //   });
  // }
  // const wager = Number(inputText) || 0;

  const wager = 0;
  c.deriveState((prevState) => {
    prevState.wager = wager;
  });

  return c.res({
    image:
      '/war/image/preview/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          card: cardNumber,
          wager,
        }),
      ),
    imageAspectRatio: '1:1',
    action: '/find',
    intents: [
      <Button.Transaction target="/duel-letter">
        duel letter
      </Button.Transaction>,
      <Button action="/">quit</Button>,
    ],
  });
});

warApp.transaction('/duel-letter', async (c) => {
  const { address, signature, wager } = c.previousState;

  const args: readonly [`0x${string}`, bigint, boolean, `0x${string}`] = [
    zeroAddress,
    0n,
    true,
    signature!,
  ];

  const estimatedGas = await warContract.estimateGas.makeGame(args, {
    account: address,
  });

  return c.contract({
    chainId: 'eip155:666666666',
    to: WAR_CONTRACT_ADDRESS,
    abi: WAR_ABI,
    functionName: 'makeGame',
    args: args,
    gas: BigInt(Math.ceil(Number(estimatedGas) * 1.3)),
    value: parseEther(wager.toString()),
  });
});

warApp.frame('/find', async (c) => {
  const transactionId = c.transactionId;
  const { userName, pfp_url, card, wager, address } = c.previousState;

  const { data: receipt } = await tweClient.GET(
    '/transaction/{chain}/tx-hash/{txHash}',
    {
      params: {
        path: {
          chain: 'degen-chain',
          txHash: transactionId as `0x${string}`,
        },
      },
    },
  );

  const gameMadeEvent = await receipt?.result?.logs
    ?.map((log: any) => {
      try {
        return decodeEventLog({
          abi: WAR_ABI,
          data: log.data,
          topics: log.topics,
        });
      } catch (error) {
        return undefined;
      }
    })
    .find((l) => l?.eventName === 'GameMade');

  const gameId =
    gameMadeEvent?.args && 'gameId' in gameMadeEvent.args
      ? gameMadeEvent.args.gameId
      : null;

  if (!gameId) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: 'GameId retribe error',
        address,
      }),
    );
    return c.res({
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [],
    });
  }

  const game = await warContract.read.games([gameId]);
  const createdAt = game[6];
  await setGameInfo(gameId, address, userName, pfp_url, wager, createdAt);

  const params = encodeURIComponent(
    JSON.stringify({
      userName,
      pfp_url,
      wager,
      gameId,
    }),
  );

  const shareLink = `${shareUrlBase}${shareText}${embedParam}${process.env.SITE_URL}/war/challenge/${gameId}`;

  return c.res({
    image: '/war/image/find/' + params,
    browserLocation: '/war/image/find/' + params,

    imageAspectRatio: '1:1',
    intents: [<Button.Link href={shareLink}>Find a duel partner</Button.Link>],
  });
});

const generateErrorImage = async (
  message: string,
  quantities: any,
  address: string,
) => {
  const backgroundImage = await generateOwnCard(quantities, address);

  // const svgOverlay = Buffer.from(`
  //   <svg width="1000" height="1000" >
  //     <rect width="1000" height="1000" fill="rgba(0, 0, 0, 0.5)" />
  //     <text x="500" y="200" font-family="Bigelow Rules" font-size="40" fill="white" text-anchor="middle">
  //       ${message
  //         .split('\n')
  //         .map(
  //           (line: string, index: number) =>
  //             `<tspan x="500" dy="${index * 50}">${line}</tspan>`,
  //         )
  //         .join('')}
  //     </text>
  //   </svg>
  // `);

  const svgOverlay = await sharp('./public/images/war/error.png')
    .resize(1000, 1000)
    .png()
    .toBuffer();
  const canvas = await sharp(backgroundImage);

  const finalImage = await canvas
    .composite([
      {
        input: backgroundImage,
        top: 0,
        left: 0,
      },
      {
        input: svgOverlay,
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return finalImage;
};

warApp.frame('/error/address', (c) => {
  return c.res({
    image: '/images/war/address_error.png',
    imageAspectRatio: '1:1',
    intents: [<Button action={`/`}>Back</Button>],
  });
});

// Challenge
warApp.frame('/challenge/:gameId', async (c) => {
  const gameId = c.req.param('gameId') as `0x${string}`;
  // const { userName, pfp_url, wager, gameId } = params;

  // status check
  let gameInfo = await getGameInfoByGameId(gameId);

  if (!gameInfo) {
    // get gameInfo from onchain and neynar

    try {
      const game = await warContract.read.games([gameId]);

      const makerAddress = game[0];
      if (!makerAddress || makerAddress === zeroAddress) {
        throw Error();
      }

      const createdAt = game[6];
      const gameDeposits = await warPoolContract.read.gameDeposits([gameId]);
      const wager = Number(gameDeposits[4]);

      const { pfp_url, userName, verifiedAddresses } =
        await getFarcasterUserInfoByAddress(makerAddress);

      await setGameInfo(
        gameId,
        makerAddress,
        userName,
        pfp_url,
        wager,
        createdAt,
      );

      let challengerAddress = game[1];

      if (challengerAddress !== zeroAddress) {
        const { pfp_url, userName } = await getFarcasterUserInfoByAddress(
          challengerAddress,
        );

        await updateChallenger(gameId, challengerAddress, userName, pfp_url);
      }

      let makerCard = Number(game[3]);
      if (makerCard !== 0) {
        let winner = game[2];
        let challengerCard = Number(game[4]);
        await updateResult(gameId, makerCard, challengerCard, winner);
      }
    } catch (e) {
      const params = encodeURIComponent(
        JSON.stringify({
          message: 'Invalid Game Id',
          quantities: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          address: '0x00000000000000000000000000000000000000000000',
        }),
      );
      return c.res({
        image: `/war/image/error/${params}`,
        imageAspectRatio: '1:1',
        intents: [],
      });
    }

    gameInfo = await getGameInfoByGameId(gameId);
  }

  if (!gameInfo) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: 'Invalid Game Id',
        quantities: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        address: '0x00000000000000000000000000000000000000000000',
      }),
    );
    return c.res({
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [],
    });
  }

  const status = await warContract.read.gameStatus([gameId]);
  if (status > 1) {
    const { userName, pfp_url, card, wager, c_userName, c_pfp_url, c_card } =
      gameInfo;

    const params = encodeURIComponent(
      JSON.stringify({
        userName,
        pfp_url,
        wager,
        card: card || '',
        c_userName: c_userName || '',
        c_pfp_url: c_pfp_url || '',
        c_card: c_card || '',
        status,
      }),
    );

    return c.res({
      image: `/war/image/expired/${params}`,
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const { userName, pfp_url, wager } = gameInfo;

  const params = encodeURIComponent(
    JSON.stringify({
      userName,
      pfp_url,
      wager,
      gameId,
    }),
  );

  c.deriveState((prevState) => {
    prevState.userName = userName;
    prevState.pfp_url = pfp_url;
    prevState.wager = wager;
    prevState.gameId = gameId;
  });

  return c.res({
    image:
      '/war/image/challenge/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          wager,
        }),
      ),
    imageAspectRatio: '1:1',
    intents: [<Button action={`/choose/${params}`}>Start</Button>],
  });
});

warApp.frame('/choose', async (c) => {
  const { quantities, c_address } = c.previousState;

  return c.res({
    image:
      '/war/image/score/' +
      encodeURIComponent(JSON.stringify({ quantities, address: c_address })),
    imageAspectRatio: '1:1',
    action: '/choose',
    intents: [
      <TextInput placeholder="11 or J or ..." />,
      <Button action="/duel">Set</Button>,
    ],
  });
});

warApp.frame('/choose/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager, gameId } = params;

  const { frameData } = c;
  const fid = frameData?.fid;

  const {
    pfp_url: c_pfp_url,
    userName: c_userName,
    verifiedAddresses,
  } = await getFarcasterUserInfo(fid);

  const verifyedAddress = verifiedAddresses[0];
  if (!verifiedAddresses || verifiedAddresses.length === 0) {
    return c.res({
      image: '/images/verify.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const address = verifyedAddress as `0x${string}`;

  const hasNFT = await checkInvitation(address);
  if (!hasNFT) {
    return c.res({
      image: '/images/war/no_invi.png',
      imageAspectRatio: '1:1',
      intents: [<Button action={`/challenge/${gameId}`}>Back</Button>],
    });
  }

  const quantities = await getQuantities(address, c);

  c.deriveState((prevState) => {
    prevState.quantities = quantities;
    prevState.userName = userName;
    prevState.pfp_url = pfp_url;
    prevState.wager = wager;
    prevState.gameId = gameId;
    prevState.c_userName = c_userName;
    prevState.c_pfp_url = c_pfp_url;
    prevState.c_address = address;
  });

  return c.res({
    image:
      '/war/image/score/' +
      encodeURIComponent(JSON.stringify({ quantities, address })),
    imageAspectRatio: '1:1',
    action: '/choose',
    intents: [
      <TextInput placeholder="11 or J or ..." />,
      <Button action="/duel">Set</Button>,
    ],
  });
});

warApp.frame('/duel', async (c) => {
  const { inputText } = c;
  const {
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
    quantities,
    gameId,
    c_address,
  } = c.previousState;

  const inputCardNumber = inputText;

  const c_card = convertCardValue(inputCardNumber as string);
  const errorMessage = checkCardNumber(c_card, quantities);

  if (errorMessage) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: errorMessage,
        quantities: quantities,
        address: c_address,
      }),
    );

    return c.res({
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [
        <Button action="/choose">Back</Button>,
        <Button.Link href="https://google.com">go to</Button.Link>,
      ],
    });
  }

  c.deriveState((prevState) => {
    prevState.c_card = c_card;
  });

  return c.res({
    image:
      '/war/image/duel/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          wager,
          c_userName,
          c_pfp_url,
          c_card,
        }),
      ),

    imageAspectRatio: '1:1',
    action: '/loading',
    intents: [
      <Button.Transaction target="/challengeGame">duel</Button.Transaction>,
      <Button action={`/challenge/${gameId}`}>quit</Button>,
    ],
  });
});

warApp.transaction('/challengeGame', async (c) => {
  const { gameId, c_address, c_card } = c.previousState;

  try {
    if (gameId === undefined || c_card === undefined) {
      throw new Error('gameId or c_card is undefined');
    }

    const args: readonly [`0x${string}`, bigint] = [gameId, BigInt(c_card)];

    const estimatedGas = await warContract.estimateGas.challengeGame(args, {
      account: c_address,
    });

    return c.contract({
      chainId: 'eip155:666666666',
      to: WAR_CONTRACT_ADDRESS,
      abi: WAR_ABI,
      functionName: 'challengeGame',
      args: args,
      gas: BigInt(Math.ceil(Number(estimatedGas) * 1.3)),
    });
  } catch (e: any) {
    return c.error({ message: e.shortMessage });
  }
});

warApp.frame('/loading', async (c) => {
  const { userName, pfp_url, wager, c_address, c_userName, c_pfp_url, gameId } =
    c.previousState;

  await updateChallenger(gameId, String(c_address), c_userName!, c_pfp_url!);

  return c.res({
    image:
      '/war/image/loading/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          wager,
          c_userName,
          c_pfp_url,
        }),
      ),
    imageAspectRatio: '1:1',
    action: '/loading',
    intents: [<Button action={`/result/${gameId}`}>Check Result</Button>],
  });
});

warApp.frame('/result/:gameId', async (c) => {
  const gameId = c.req.param('gameId') as `0x${string}`;

  const gameInfo = await getGameInfoByGameId(gameId);
  if (!gameInfo) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: 'Invalid Game Id',
      }),
    );
    return c.res({
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [],
    });
  }

  let {
    userName,
    pfp_url,
    wager,
    c_address,
    c_userName,
    c_pfp_url,
    card,
    c_card,
    winner,
  } = gameInfo;

  if (!winner || winner === zeroAddress) {
    const result = await warContract.read.games([gameId]);
    // const result = [0, 0, '0xa989173a1545eedF7a0eBE49AC51Dd1383F7EbC8', 2, 6];

    winner = result[2];
    if (winner === zeroAddress) {
      return c.error({ message: 'Please wait …' });
    }

    card = result[3];
    c_card = result[4];

    await updateResult(gameId, card, c_card, winner);
  }

  const shareLink = `${shareUrlBase}${shareText}${embedParam}${process.env.SITE_URL}/war/result/${gameId}`;
  const isWin = winner.toLowerCase() === c_address;

  return c.res({
    image:
      '/war/image/result/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          card,
          wager,
          c_userName,
          c_pfp_url,
          c_card,
          isWin: isWin,
        }),
      ),
    imageAspectRatio: '1:1',
    browserLocation:
      '/war/image/result/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          card,
          wager,
          c_userName,
          c_pfp_url,
          c_card,
          isWin: isWin,
        }),
      ),
    intents: [
      <Button.Link href={shareLink}>share</Button.Link>,
      <Button action={`/`}>make duel</Button>,
    ],
  });
});

const generateLoadingImage = async (
  userName: string,
  pfp_url: string,
  wager: number,
  c_userName: string,
  c_pfp_url: string,
) => {
  const backgroundImageBuffer = await generateDuelImage(
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
  );

  const backgroundImage = sharp(backgroundImageBuffer);

  const overlayImage = await sharp('./public/images/war/loading_overlay.png')
    .resize(1000, 1000)
    .toBuffer();

  const finalImage = await backgroundImage
    .composite([
      { input: overlayImage, gravity: 'center' }, // 画像を中央に重ねる
    ])
    .toBuffer();

  return finalImage;
};

warApp.hono.get('/image/error/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));

  const { message, quantities, address } = params;

  const image = await generateErrorImage(message, quantities, address);

  return c.newResponse(image, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/challenge/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager } = params;
  const png = await generateChallengeImage(true, userName, pfp_url, wager);
  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/duel/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager, c_userName, c_pfp_url } = params;

  const png = await generateDuelImage(
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
  );
  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/loading/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager, c_userName, c_pfp_url } = params;

  const png = await generateLoadingImage(
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
  );
  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

// ///////////////////
// Common Function
// ///////////////////
// Common
// const getUserData = async (fid: string) => {
//   const userInfo = await fetch(
//     `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}&viewer_fid=3`,
//     {
//       method: 'GET',
//       headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
//     },
//   );
//   const userData = await userInfo.json();
//   const pfp_url = userData.users[0].pfp_url;
//   const userName = userData.users[0].username;
//   const verifyedAddresses = userData.users[0].verified_addresses.eth_addresses;
//   const verifyedAddress = verifyedAddresses[0];

//   return { pfp_url, userName, verifyedAddress };
// };

const getQuantities = async (address: string, c: any) => {
  const addressList: `0x${string}`[] = Array(14).fill(address);
  const allCardIds: bigint[] = [
    1n,
    2n,
    3n,
    4n,
    5n,
    6n,
    7n,
    8n,
    9n,
    10n,
    11n,
    12n,
    13n,
    14n,
  ];

  const data = await cardContract.read.balanceOfBatch([
    addressList,
    allCardIds,
  ]);

  // get used cards
  // const body = await c.req.json();
  // const { trustedData } = body;

  // const response = await fetch(
  //   `${process.env.BACKEND_URL!}/war/getReservedCards`,
  //   {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       messageBytes: trustedData.messageBytes,
  //     }),
  //   },
  // );

  // if (!response.ok) {
  //   console.error('Failed to fetch the signature:', response.statusText);
  //   return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  // }

  // const usedQuantities = await response.json();

  // console.log(data);
  // console.log(usedQuantities);
  const usedQuantities = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  const quantities = data.map((quantity, index) => {
    const remainingQuantity =
      Number(quantity) - (Number(usedQuantities[index]) || 0);
    return remainingQuantity < 0 ? 0 : remainingQuantity;
  });
  return quantities;
};

const checkInvitation = async (address: `0x${string}`) => {
  const balance = await inivtationNFTContracrt.read.balanceOf([address]);
  return Number(balance) > 0;
};

const checkCardNumber = (card: number, quantities: number[]) => {
  if (card < 1 || 14 < card) {
    return 'Invalid Card Number.';
  }

  if (quantities[card - 1] === 0) {
    const message = "You Don't have\n this card."
      .replace(/'/g, '&apos;')
      .replace('\n', '%0A');
    return message;
  }

  return '';
};

const getSignature = async (c: any): Promise<string> => {
  try {
    const body = await c.req.json();
    const { trustedData } = body;

    const response = await fetch(`${process.env.BACKEND_URL!}/war/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageBytes: trustedData.messageBytes,
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch the signature:', response.statusText);
      return '';
    }

    const responseText = await response.text();

    try {
      const signature = responseText;

      if (!signature) {
        console.error('Invalid response structure:', signature);
        return '';
      }

      return signature;
    } catch (jsonError) {
      console.error('Failed to parse response as JSON:', responseText);
      return '';
    }
  } catch (error) {
    console.error('Error occurred while fetching the signature:', error);
    return '';
  }
};

const safeIsNaN = async (inputText: string | undefined): Promise<boolean> => {
  if (inputText === undefined || inputText === '') {
    return false;
  }

  const number = Number(inputText); // 文字列を数値に変換
  return isNaN(number); // 変換された数値が NaN であるかどうかをチェック
};

warApp.hono.get('/image/score/:quantities', async (c) => {
  const { quantities, address } = JSON.parse(
    decodeURIComponent(c.req.param('quantities')),
  );

  const finalImage = await generateOwnCard(quantities, address);

  return c.newResponse(finalImage, 200, {
    'Content-Type': 'image/png',
  });
});

warApp.hono.get('/image/preview/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, card, wager } = params;
  const png = await generatePreviewImage(userName, pfp_url, card, wager);

  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/find/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager } = params;

  const png = await generateChallengeImage(false, userName, pfp_url, wager);
  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/expired/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const {
    userName,
    pfp_url,
    card,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
    status,
  } = params;

  const png = await generateExpiredImage({
    userName,
    pfp_url,
    card,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
    status,
  });

  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/result/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));

  const {
    userName,
    pfp_url,
    card,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
    isWin,
  } = params;

  const png = await generateResultImage(
    userName,
    pfp_url,
    card,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
    isWin,
  );

  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

////////////////////////////////////////
// Image Generate Functions
// /////////////////////////////////////
const generateOwnCard = async (quantities: number[], address: string) => {
  const baseImage = sharp('./public/images/war/pick_card.png').resize(
    1000,
    1000,
  );

  const cardWidth = 144;
  const cardHeight = 211;
  const px = 19;
  const py = 21;
  const rows = 3;
  const cols = 5;

  const composites = quantities
    .map((quantity: number, index: number) => {
      const components = [];

      // SVGテキストを生成
      const svgText = Buffer.from(`
    <svg width="100" height="100">
      <text x="100" y="20" text-anchor="end" font-family="Arial" font-size="20" fill="white">x ${quantity}</text>
    </svg>
  `);

      components.push({
        input: svgText,
        top: 907,
        left: 120 + index * 52 - (index > 8 ? 6 : 0),
      });

      // 未保有のカードへのオーバーレイ
      if (quantity < 1) {
        const x = 100 + (index % cols) * cardWidth + (index % cols) * px;
        const y =
          127 +
          Math.floor(index / cols) * cardHeight +
          Math.floor(index / cols) * py;

        const overlay = Buffer.from(`
        <svg width="${cardWidth}" height="${cardHeight}">
          <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.8)" rx="${10}" ry="${10}" />
        </svg>
      `);
        components.push({
          input: overlay,
          top: y,
          left: x,
        });
      }

      return components;
    })
    .flat();

  const addressImage = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="1000">${
        address.slice(0, 6) + '...' + address.slice(-4)
      }</span>`,
      font: 'Bigelow Rules',
      fontfile: './public/fonts/BigelowRules-Regular.ttf',
      rgba: true,
      width: 550,
      height: 40,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  const finalImage = await baseImage
    .composite([...composites, { input: addressImage, top: 50, left: 700 }])
    .png()
    .toBuffer();

  return finalImage;
};

const generateChallengeImage = async (
  share: boolean,
  userName: string,
  pfp_url: string,
  wager: number,
) => {
  const isBet = wager > 0;

  let imageName;

  if (share) {
    imageName = isBet ? 'share_toplay_bet.png' : 'share_toplay.png';
  } else {
    imageName = isBet ? 'fin_make_bet.png' : 'fin_make.png';
  }

  const response = await fetch(pfp_url);
  const pfpBuffer = await response.arrayBuffer();

  const canvas = sharp('./public/images/war/' + imageName).resize(1000, 1000);

  let leftUserTop = 488;
  if (!isBet) {
    leftUserTop += 48;
  }
  if (share) {
    leftUserTop -= 6;
  }

  const pfpSize = 42;
  const userNameFontSize = 20;

  const topPfpSize = 75;
  const topUserNameFontSize = 40;

  const circleMask = Buffer.from(
    `<svg><circle cx="${pfpSize / 2}" cy="${pfpSize / 2}" r="${
      pfpSize / 2
    }" /></svg>`,
  );

  const pfpImage = await sharp(pfpBuffer)
    .resize(pfpSize, pfpSize) // アイコン画像のサイズを指定
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const svgText = `
    <svg width="500" height="${pfpSize}">
      <text x="0" y="50%" dy="0.35em" font-family="Arial" font-size="${userNameFontSize}" fill="white">${userName}</text>
    </svg>
  `;

  const userNameImage = await sharp(Buffer.from(svgText)).png().toBuffer();

  const wagerImage = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="1000">${wager} $DEGEN</span>`,
      font: 'Bigelow Rules',
      fontfile: './public/fonts/BigelowRules-Regular.ttf',
      rgba: true,
      width: 550,
      height: 68,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  const topCircleMask = Buffer.from(
    `<svg><circle cx="${topPfpSize / 2}" cy="${topPfpSize / 2}" r="${
      topPfpSize / 2
    }" /></svg>`,
  );
  const topPfpImage = await sharp(pfpBuffer)
    .resize(topPfpSize) // アイコン画像のサイズを指定
    .composite([{ input: topCircleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const topSvgText = `
    <svg width="500" height="${topPfpSize}">
      <text x="0" y="50%" dy="0.35em" font-family="Arial" font-size="${topUserNameFontSize}" fill="white">${userName}</text>
    </svg>
  `;

  const topUserNameImage = await sharp(Buffer.from(topSvgText))
    .png()
    .toBuffer();

  canvas.composite([
    {
      input: pfpImage,
      left: 94,
      top: leftUserTop,
    },
    {
      input: userNameImage,
      left: 94 + pfpSize + 10,
      top: leftUserTop,
    },

    {
      input: topPfpImage,
      left: 566,
      top: 77,
    },
    {
      input: topUserNameImage,
      left: 566 + topPfpSize + 20,
      top: 77,
    },
    ...(isBet
      ? [
          {
            input: wagerImage,
            left: 500,
            top: 888,
          },
        ]
      : []),
  ]);

  const png = await canvas.png().toBuffer();

  return png;
};

const generateUserComponent = async (userName: string, pfp_url: string) => {
  const response = await fetch(pfp_url);
  const pfpBuffer = await response.arrayBuffer();

  const pfpSize = 42;
  const userNameFontSize = 20;

  const circleMask = Buffer.from(
    `<svg width="${pfpSize}" height="${pfpSize}"><circle cx="${
      pfpSize / 2
    }" cy="${pfpSize / 2}" r="${pfpSize / 2}" fill="white" /></svg>`,
  );

  const pfpImage = await sharp(Buffer.from(pfpBuffer))
    .resize(pfpSize, pfpSize)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const svgText = `
    <svg xmlns="http://www.w3.org/2000/svg" width="500" height="${pfpSize}">
      <style>
        .text { font-family: Arial; font-size: ${userNameFontSize}px; fill: white; }
      </style>
      <text x="0" y="50%" dy="0.35em" class="text">${userName}</text>
    </svg>
  `;

  const svgTextBuffer = Buffer.from(svgText);

  // テキストの幅を計算
  const textImage = sharp(svgTextBuffer);
  const textMetadata = await textImage.metadata();
  const textWidth = textMetadata.width ?? 0;

  const combinedImageWidth = pfpSize + textWidth + 10; // 10px マージンを含めた幅

  const userNameImage = await textImage.png().toBuffer();

  const combinedImage = await sharp({
    create: {
      width: combinedImageWidth,
      height: pfpSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: pfpImage, top: 0, left: 0 },
      { input: userNameImage, top: 0, left: pfpSize + 10 },
    ])
    .png()
    .toBuffer();

  return combinedImage;
};

const generatePreviewImage = async (
  userName: string,
  pfp_url: string,
  card: number,
  wager: number,
) => {
  const isBet = wager > 0;
  // const imageName = isBet ? 'tx_make_bet.png' : 'tx_make.png';
  const imageName = 'tx_make.png';

  const canvas = sharp('./public/images/war/' + imageName).resize(1000, 1000);

  // const pfpSize = 42;
  // const userNameFontSize = 20;

  // const circleMask = Buffer.from(
  //   `<svg><circle cx="${pfpSize / 2}" cy="${pfpSize / 2}" r="${
  //     pfpSize / 2
  //   }" /></svg>`,
  // );

  // const pfpImage = await sharp(pfpBuffer)
  //   .resize(pfpSize, pfpSize) // アイコン画像のサイズを指定
  //   .composite([{ input: circleMask, blend: 'dest-in' }])
  //   .png()
  //   .toBuffer();

  // const svgText = `
  //   <svg width="500" height="${pfpSize}">
  //     <text x="0" y="50%" dy="0.35em" font-family="Arial" font-size="${userNameFontSize}" fill="white">${userName}</text>
  //   </svg>
  // `;

  // const userNameImage = await sharp(Buffer.from(svgText)).png().toBuffer();

  const cardImage = await sharp(`./public/images/war/card/${card}.png`)
    .resize(185)
    .png()
    .toBuffer();

  const wagerImage = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="1000">${wager} DEGEN</span>`,
      font: 'Bigelow Rules',
      fontfile: './public/fonts/BigelowRules-Regular.ttf',
      rgba: true,
      width: 550,
      height: 68,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  canvas.composite([
    // {
    //   input: pfpImage,
    //   left: 94,
    //   top: isBet ? 486 : 486 + 48,
    // },
    // {
    //   input: userNameImage,
    //   left: 94 + pfpSize + 10,
    //   top: isBet ? 486 : 486 + 48,
    // },
    {
      input: cardImage,
      left: 290,
      top: 366,
    },
    ...(isBet
      ? [
          {
            input: wagerImage,
            left: 490,
            top: 845,
          },
        ]
      : []),
  ]);

  const png = await canvas.png().toBuffer();
  return png;
};

const generateExpiredImage = async ({
  userName,
  pfp_url,
  card,
  wager,
  c_userName,
  c_pfp_url,
  c_card,
  status,
}: {
  userName: string;
  pfp_url: string;
  card?: number;
  wager: number;
  c_userName?: string;
  c_pfp_url?: string;
  c_card?: number;
  status?: number;
}) => {
  let backgroundImageBuffer;
  if (status === 2) {
    // challenged
    backgroundImageBuffer = await generateChallengeImage(
      true,
      userName,
      pfp_url,
      wager,
    );
  } else if (status === 3) {
    // gamEnded
    backgroundImageBuffer = await generateResultBgImage(
      userName,
      pfp_url,
      card || 0,
      wager,
      c_userName!,
      c_pfp_url!,
      c_card || 0,
    );
  } else if (status === 4) {
    // timeup

    backgroundImageBuffer = await generateChallengeImage(
      true,
      userName,
      pfp_url,
      wager,
    );
  }

  const backgroundImage = sharp(backgroundImageBuffer);

  const overlayImage = await sharp('./public/images/war/expired_overlay.png')
    .resize(1000, 1000)
    .toBuffer();

  const finalImage = await backgroundImage
    .composite([
      {
        input: overlayImage,
        gravity: 'center',
      },
    ])
    .toBuffer();

  return finalImage;
};

const generateDuelImage = async (
  userName: string,
  pfp_url: string,
  wager: number,
  c_userName: string,
  c_pfp_url: string,
) => {
  const isBet = wager > 0;
  const imageName = isBet ? 'tx_challenge_bet.png' : 'tx_challenge.png';

  const baseImage = sharp('./public/images/war/' + imageName).resize(
    1000,
    1000,
  );

  const wagerImage = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="1000">${wager} $DEGEN</span>`,
      font: 'Bigelow Rules',
      fontfile: './public/fonts/BigelowRules-Regular.ttf',
      rgba: true,
      width: 550,
      height: 68,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  const userComponent = await generateUserComponent(userName, pfp_url);
  const opponentComponent = await generateUserComponent(c_userName, c_pfp_url);

  const composites = [
    { input: userComponent, top: 533, left: 100 },
    { input: opponentComponent, top: 533, left: 740 },
    ...(isBet
      ? [
          {
            input: wagerImage,
            left: 490,
            top: 845,
          },
        ]
      : []),
  ];

  const finalImage = await baseImage.composite(composites).png().toBuffer();

  return finalImage;
};

const generateResultBgImage = async (
  userName: string,
  pfp_url: string,
  card: number,
  wager: number,
  c_userName: string,
  c_pfp_url: string,
  c_card: number,
) => {
  const imageName = 'result.png';

  const baseImage = sharp('./public/images/war/' + imageName).resize(
    1000,
    1000,
  );

  let cardImage;
  let c_cardImage;
  if (card !== 0) {
    cardImage = await sharp(`./public/images/war/card/${card}.png`)
      .resize(185)
      .png()
      .toBuffer();
  }
  if (c_card !== 0) {
    c_cardImage = await sharp(`./public/images/war/card/${c_card}.png`)
      .resize(185)
      .png()
      .toBuffer();
  }

  const userComponent = await generateUserComponent(userName, pfp_url);
  const opponentComponent = await generateUserComponent(c_userName, c_pfp_url);

  const composites = [
    { input: userComponent, top: 533, left: 100 },
    { input: opponentComponent, top: 533, left: 740 },
    ...(cardImage
      ? [
          {
            input: cardImage,
            left: 289,
            top: 420,
          },
        ]
      : []),
    ...(c_cardImage
      ? [
          {
            input: c_cardImage,
            left: 527,
            top: 420,
          },
        ]
      : []),
  ];

  const finalImage = await baseImage.composite(composites).png().toBuffer();

  return finalImage;
};

const generateResultImage = async (
  userName: string,
  pfp_url: string,
  card: number,
  wager: number,
  c_userName: string,
  c_pfp_url: string,
  c_card: number,
  isWin: boolean,
) => {
  let backgroundImageBuffer = await generateResultBgImage(
    userName,
    pfp_url,
    card,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
  );

  const backgroundImage = sharp(backgroundImageBuffer);

  const overlayImageName = isWin
    ? 'result_victory_overlay.png'
    : 'result_defeat_overlay.png';
  const overlayImage = await sharp('./public/images/war/' + overlayImageName)
    .resize(1000, 1000)
    .toBuffer();

  const cardSize = 220;

  const hostCardImage = await sharp(`./public/images/war/card/${card}.png`)
    .resize(cardSize)
    .png()
    .toBuffer();

  const challengerCardImage = await sharp(
    `./public/images/war/card/${c_card}.png`,
  )
    .resize(cardSize)
    .png()
    .toBuffer();

  const userComponent = await generateUserComponent(userName, pfp_url);
  const opponentComponent = await generateUserComponent(c_userName, c_pfp_url);

  // userComponent と opponentComponent のサイズを取得
  const userComponentMetadata = await sharp(userComponent).metadata();
  const opponentComponentMetadata = await sharp(opponentComponent).metadata();

  const cardTop = 370;
  const hostCardLeft = 20;
  const challengerCardLeft = 1000 - hostCardLeft - cardSize;

  const containerWidth = 370; // 固定幅のコンテナ
  const userNameTop = 690;

  // userComponent と opponentComponent を中央に揃える
  const userComponentLeft = Math.round(
    hostCardLeft +
      (cardSize - (userComponentMetadata.width ?? 0)) / 2 +
      containerWidth / 2,
  );
  const userComponentTop = userNameTop; // カードの下に配置するため + 10px のマージンを追加

  const opponentComponentLeft = Math.round(
    challengerCardLeft -
      (opponentComponentMetadata.width ?? 0) / 2 +
      containerWidth / 2 +
      90,
  );
  const opponentComponentTop = userNameTop; // カードの下に配置するため + 10px のマージンを追加
  const finalImage = await backgroundImage
    .composite([
      { input: overlayImage, gravity: 'center' },
      {
        input: hostCardImage,
        left: hostCardLeft,
        top: cardTop,
      },
      {
        input: challengerCardImage,
        left: challengerCardLeft,
        top: cardTop,
      },
      {
        input: userComponent,
        left: userComponentLeft,
        top: userComponentTop,
      },
      {
        input: opponentComponent,
        left: opponentComponentLeft,
        top: opponentComponentTop,
      },
    ])
    .toBuffer();

  return finalImage;
};
