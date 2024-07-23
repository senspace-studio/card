import { Button, FrameContext, Frog, TextInput } from 'frog';
import {
  BACKEND_URL,
  BASE_URL,
  IS_MAINTENANCE,
  WAR_CONTRACT_ADDRESS,
} from '../constant/config.js';
import tweClient from '../lib/thirdweb-engine/index.js';
import { convertCardValue } from '../lib/convertCardValue.js';
import {
  cardContract,
  warContract,
  warPoolContract,
  checkInvitation,
  publicClient,
} from '../lib/contract.js';

import sharp from 'sharp';
import JSON from 'json-bigint';
import { WAR_ABI } from '../constant/abi.js';
import { zeroAddress, parseEther, decodeEventLog, Address } from 'viem';
import {
  setGameInfo,
  updateChallenger,
  updateResult,
  getGameInfoByGameId,
} from '../lib/database.js';
import {
  getFarcasterUserInfo,
  getFarcasterUserInfoByAddress,
  getFarcasterUserInfoByCastHash,
} from '../lib/neynar.js';
import { BlankInput } from 'hono/types';
import { isJokerKilling } from '../utils/wat.js';
// import { ethers, getBytes, keccak256 } from 'ethers';
// import { encodePacked } from 'viem';

const shareUrlBase = 'https://warpcast.com/~/compose?text=';
const embedParam = '&embeds[]=';
const shareText = encodeURIComponent('Wanna battle?');

const PFP_SIZE = 42;
const USER_NAME_FONT_SIZE = 20;
const IMAGE_SIZE = 1000;
const CARD_SIZE = 220;

const title = 'Battle | House of Cardians';

type State = {
  quantities: number[];
  address: `0x${string}`;
  pfp_url: string;
  userName: string;
  card: number[];
  wager: number;
  gameId: `0x${string}`;
  c_address?: `0x${string}`;
  c_pfp_url?: string;
  c_userName?: string;
  c_card?: number[];
  signature?: Address;
  verifiedAddresses?: `0x${string}`[];
  hasInvitation?: boolean;
  numOfCards?: number;
  sumOfCards?: number;
};

enum Result {
  Win = 'Win',
  Lose = 'Lose',
  Draw = 'Draw',
}

export const warApp = new Frog<{ State: State }>({
  title: '',
  initialState: {
    quantities: [],
    address: '',
    pfp_url: '',
    userName: '',
    card: [],
    wager: 0,
    gameId: '',
    hasInvitation: false,
  },
  headers: {
    'Cache-Control': 'max-age=300',
  },
});

warApp.frame('/', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  if (c.frameData?.fid) {
    const { verifiedAddresses, userName, pfp_url } = await getFarcasterUserInfo(
      c.frameData?.fid,
    );

    if (!verifiedAddresses || verifiedAddresses.length === 0) {
      return c.res({
        title,
        image: '/images/verify.png',
        imageAspectRatio: '1:1',
        intents: [<Button action={BASE_URL}>Back</Button>],
      });
    }

    c.deriveState((prevState) => {
      prevState.verifiedAddresses = verifiedAddresses;
      prevState.userName = userName;
      prevState.pfp_url = pfp_url;
    });

    const hasInvitation = await checkInvitation(verifiedAddresses[0]);

    if (!hasInvitation) {
      return c.res({
        title,
        image: '/images/war/no_invi.png',
        imageAspectRatio: '1:1',
        intents: [<Button action="/">Back</Button>],
      });
    }

    c.deriveState((prevState) => {
      prevState.hasInvitation = hasInvitation;
    });
  }

  return c.res({
    title,
    image: '/images/war/title.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/make-duel">Make Game</Button>,
      <Button action="/challenge/random">Challenge</Button>,
      <Button action="/tools">Tools</Button>,
      <Button action={`${BASE_URL}/top`}>＜ Back</Button>,
    ],
  });
});

warApp.frame('/tools', (c) => {
  return c.res({
    title,
    image: '/images/war/tools.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button.AddCastAction action="https://card-scouter.vercel.app/api/card-scouter">
        Scouter
      </Button.AddCastAction>,
      <Button.AddCastAction action="/lets-play">
        Let's Play
      </Button.AddCastAction>,
      <Button action="/">Back</Button>,
    ],
  });
});

warApp.frame('/make-duel', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const { frameData } = c;
  const fid = frameData?.fid;
  const { pfp_url, userName, verifiedAddresses } = c.previousState.userName
    ? c.previousState
    : await getFarcasterUserInfo(fid);

  if (!verifiedAddresses || verifiedAddresses.length === 0) {
    return c.res({
      title,
      image: '/images/verify.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const address = verifiedAddresses[0] as `0x${string}`;

  const [hasNFT, quantities] = await Promise.all([
    checkInvitation(address),
    getQuantities(address, c),
  ]);

  if (!hasNFT) {
    return c.res({
      title,
      image: '/images/war/no_invi.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  c.deriveState((prevState) => {
    prevState.quantities = quantities;
    prevState.address = address;
    prevState.userName = userName;
    prevState.pfp_url = pfp_url;
    prevState.hasInvitation = hasNFT;
    prevState.verifiedAddresses = verifiedAddresses;
  });

  return c.res({
    title,
    image:
      '/war/image/score/' +
      encodeURIComponent(JSON.stringify({ quantities, address })),
    imageAspectRatio: '1:1',
    intents: [
      <TextInput placeholder="1,2....11,12,13 or J" />,
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
//       title,
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
//       title,
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
//     title,
//     image: '/images/war/bet.png',
//     imageAspectRatio: '1:1',
//     intents: [
//       <TextInput placeholder="999" />,
//       <Button action="/preview">Bet</Button>,
//     ],
//   });
// });
warApp.frame('/preview', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const { inputText } = c;
  const { userName, pfp_url, card, quantities, address } = c.previousState;

  // bet機能をリリースする時は/bet frameで行うためこの辺はスキップ

  // inputをsplitして配列にする
  const inputCardNumberArray =
    inputText && typeof inputText === 'string' ? inputText.split(',') : [];

  // splitしたinputをコンバートする
  const convertedArray = inputCardNumberArray.map((item) =>
    convertCardValue(item),
  );

  const allInputsValid = convertedArray.every((value) => value !== -1);
  if (!allInputsValid) {
    return c.error({ message: 'Invalid Input Number.' });
  }

  // 入力数が1,3,5のいずれかをチェック
  const isValidCardCount = [1, 3, 5].includes(convertedArray.length);
  if (!isValidCardCount) {
    return c.error({
      message: 'Invalid number of cards. Please enter 1, 3, or 5 cards.',
    });
  }

  // 入力値が1-14に収まっているか、各カードを保有しているかをチェック
  const errorMessages = convertedArray
    .map((cardNumber) => checkCardNumber(cardNumber, quantities))
    .filter((message) => message !== '');

  if (errorMessages.length > 0) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: errorMessages.join(', '),
        quantities: quantities,
        address,
      }),
    );

    return c.res({
      title,
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [
        <Button action="/make-duel">Back</Button>,
        <Button action={`${BASE_URL}/draw`}>Draw</Button>,
      ],
    });
  }

  // 入力値が3,5個のいずれかなら合計値が25以下であることをチェック
  if (convertedArray.length === 3 || convertedArray.length === 5) {
    const sum = convertedArray.reduce((acc, curr) => {
      // 14（ジョーカー）は合計に含めない
      return curr !== 14 ? acc + curr : acc;
    }, 0);

    if (sum > 25) {
      return c.error({
        message:
          'The sum of card values (excluding Jokers) must not exceed 25.',
      });
    }
  }

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
      title,
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [<Button action="/make-duel">Back</Button>],
    });
  }

  // cardを降順ソートする

  const cardArray = convertedArray.sort((a, b) => b - a);

  c.deriveState((prevState) => {
    prevState.card = cardArray;
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
  //     title,
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

  // direct match
  const { c_address, c_pfp_url, c_userName } = c.previousState;
  let params;
  if (c_address) {
    params = encodeURIComponent(
      JSON.stringify({
        userName,
        pfp_url,
        card: cardArray,
        wager,
        c_address,
        c_pfp_url,
        c_userName,
      }),
    );
  } else {
    params = encodeURIComponent(
      JSON.stringify({
        userName,
        pfp_url,
        card: cardArray,
        wager,
      }),
    );
  }

  return c.res({
    title,
    image: '/war/image/preview/' + params,
    imageAspectRatio: '1:1',
    action: '/find',
    intents: [
      <Button.Transaction target="/duel-letter">Battle</Button.Transaction>,
      <Button action="/">Quit</Button>,
    ],
  });
});

warApp.transaction('/duel-letter', async (c) => {
  const { address, card, signature, wager, c_address } = c.previousState;

  const targetAddress = c_address || zeroAddress;
  const numOfCards = card.length;
  const sumOfCards = card.reduce((total, card) => total + card, 0);

  const args: readonly [
    `0x${string}`,
    bigint,
    boolean,
    `0x${string}`,
    bigint,
    bigint,
    `0x${string}`,
  ] = [
    zeroAddress,
    0n,
    true,
    signature!,
    BigInt(numOfCards),
    BigInt(sumOfCards),
    targetAddress,
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
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const transactionId = c.transactionId;
  const { userName, pfp_url, card, wager, address } = c.previousState;

  let gameId = null;
  let retryCount = 0;
  while (gameId === null && retryCount < 3) {
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

    const gameMadeEvent = receipt?.result?.logs
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

    gameId =
      gameMadeEvent?.args && 'gameId' in gameMadeEvent.args
        ? gameMadeEvent.args.gameId
        : null;

    await new Promise((resolve) => setTimeout(resolve, 1000));
    retryCount++;
  }

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
  const numOfCards = card.length;
  const sumOfCards = Number(await warContract.read.sumOfCards([gameId]));
  await setGameInfo(
    gameId,
    address,
    userName,
    pfp_url,
    wager,
    createdAt,
    numOfCards,
    sumOfCards,
  );

  // direct match
  const { c_address, c_userName, c_pfp_url } = c.previousState;
  if (c_address && c_userName && c_pfp_url) {
    await updateChallenger(gameId, c_address, c_userName, c_pfp_url);
  }

  const params = encodeURIComponent(
    JSON.stringify({
      userName,
      pfp_url,
      wager,
      gameId,
      numOfCards,
      sumOfCards,
      c_userName,
      c_pfp_url,
    }),
  );

  // c_userNameをDirectMatchの条件にしてメッセージを変える
  const shareLink = `${shareUrlBase}${
    c_userName
      ? `It's time to battle, @${c_userName}! Get your cards ready!`
      : shareText
  }${embedParam}${BASE_URL}/war/challenge/${gameId}`;

  return c.res({
    title,
    image: '/war/image/find/' + params,
    browserLocation: '/war/image/find/' + params,

    imageAspectRatio: '1:1',
    intents: [
      <Button.Link href={shareLink}>
        {c_userName ? 'Dare to Duel' : 'Share Game'}
      </Button.Link>,
    ],
  });
});

const generateErrorImage = async (
  message: string,
  quantities: any,
  address: string,
) => {
  const backgroundImage = await generateOwnCard(quantities, address);

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
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  return c.res({
    title,
    image: '/images/war/address_error.png',
    imageAspectRatio: '1:1',
    intents: [<Button action={`/`}>Back</Button>],
  });
});

warApp.frame('/challenge/random', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const { frameData } = c;
  const fid = frameData?.fid;
  const { verifiedAddresses } = c.previousState.userName
    ? c.previousState
    : await getFarcasterUserInfo(fid);

  if (!verifiedAddresses || verifiedAddresses.length === 0) {
    return c.res({
      title,
      image: '/images/verify.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const address = verifiedAddresses[0] as `0x${string}`;

  const hasNFT = await checkInvitation(address);

  if (!hasNFT) {
    return c.res({
      title,
      image: '/images/war/no_invi.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  // Direct Matchを省くために、requestedChallengersがzeroAddressのものを取得
  let gameId!: `0x${string}`;
  let retryCount = 0;
  while (!gameId && retryCount < 3) {
    const response = await fetch(
      `${BACKEND_URL!}/war/getRandomChallengableGame?exept_maker=${address}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    const game = await response.json();
    if (!game.game_id) return c.error({ message: 'No game found' });

    const requestedAddress = await warContract.read.requestedChallengers([
      game.game_id,
    ]);
    retryCount++;
    if (requestedAddress === zeroAddress) {
      gameId = game.game_id;
    } else if (retryCount >= 3) {
      return c.error({ message: 'No game found' });
    }
  }

  return await challengeFrame(c, gameId);
});

warApp.frame('/challenge/:gameId', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const gameId = c.req.param('gameId') as `0x${string}`;
  return await challengeFrame(c, gameId);
});

const challengeFrame = async (
  c: FrameContext<
    {
      State: State;
    },
    '/challenge/:gameId' | '/challenge/random',
    BlankInput
  >,
  gameId: `0x${string}`,
) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  let gameInfo = await getGameInfoByGameId(gameId);

  if (!gameInfo) {
    try {
      const game = await warContract.read.games([gameId]);
      const makerAddress = game[0];
      if (!makerAddress || makerAddress === zeroAddress) {
        throw Error();
      }

      const numOfCards = Number(await warContract.read.numOfCards([gameId]));
      const sumOfCards = Number(await warContract.read.sumOfCards([gameId]));

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
        numOfCards,
        sumOfCards,
      );

      let challengerAddress = game[1];
      if (challengerAddress !== zeroAddress) {
        const { pfp_url, userName } = await getFarcasterUserInfoByAddress(
          challengerAddress,
        );

        await updateChallenger(gameId, challengerAddress, userName, pfp_url);
      }

      let makerCard = game[3];

      if (makerCard !== BigInt(0)) {
        let winner = game[2];

        const makerCards: number[] = await Promise.all(
          Array.from({ length: numOfCards }, async (_, i) => {
            return Number(
              await warContract.read.playerCards([game[3], BigInt(i)]),
            );
          }),
        );
        const challengerCards: number[] = await Promise.all(
          Array.from({ length: numOfCards }, async (_, i) => {
            return Number(
              await warContract.read.playerCards([game[4], BigInt(i)]),
            );
          }),
        );
        await updateResult(gameId, makerCards, challengerCards, winner);
      }
    } catch (e) {
      console.log(e);
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

  const { userName, pfp_url, wager, numOfCards, sumOfCards } = gameInfo;

  const params = encodeURIComponent(
    JSON.stringify({
      userName,
      pfp_url,
      wager,
      gameId,
      numOfCards,
      sumOfCards,
    }),
  );

  c.deriveState((prevState) => {
    prevState.userName = userName;
    prevState.pfp_url = pfp_url;
    prevState.wager = wager;
    prevState.gameId = gameId;
    prevState.numOfCards = numOfCards;
    prevState.sumOfCards = sumOfCards;
  });

  const { c_userName, c_pfp_url } = gameInfo;

  return c.res({
    title,
    image:
      '/war/image/challenge/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          wager,
          gameId,
          c_userName: c_userName || '',
          c_pfp_url: c_pfp_url || '',
          numOfCards,
          sumOfCards,
        }),
      ),
    imageAspectRatio: '1:1',
    intents: [<Button action={`/choose/${params}`}>Start</Button>],
  });
};

warApp.frame('/choose', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const { quantities, c_address } = c.previousState;

  return c.res({
    title,
    image:
      '/war/image/score/' +
      encodeURIComponent(JSON.stringify({ quantities, address: c_address })),
    imageAspectRatio: '1:1',
    action: '/choose',
    intents: [
      <TextInput placeholder="1,2....11,12,13 or J" />,
      <Button action="/duel">Set</Button>,
    ],
  });
});

warApp.frame('/choose/:params', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager, gameId, numOfCards, sumOfCards } = params;

  const { frameData } = c;
  const fid = frameData?.fid;

  const userInfo = await getFarcasterUserInfo(fid);
  const {
    pfp_url: c_pfp_url,
    userName: c_userName,
    verifiedAddresses,
  } = userInfo;

  if (!verifiedAddresses || verifiedAddresses.length === 0) {
    return c.res({
      title,
      image: '/images/verify.png',
      action: '/choose',
      imageAspectRatio: '1:1',
      intents: [<Button action={`/challenge/${gameId}`}>Back</Button>],
    });
  }

  const address = verifiedAddresses[0] as `0x${string}`;
  const [hasNFT, quantities] = await Promise.all([
    checkInvitation(address),
    getQuantities(address, c),
  ]);

  if (!hasNFT) {
    return c.res({
      title,
      image: '/images/war/no_invi.png',
      action: '/choose',
      imageAspectRatio: '1:1',
      intents: [<Button action={`/challenge/${gameId}`}>Back</Button>],
    });
  }
  const gameStatus = await warContract.read.gameStatus([gameId]);
  if (gameStatus.toString() !== '1') {
    return c.res({
      title,
      image: '/images/war/title.png',
      imageAspectRatio: '1:1',
      action: '/',
      intents: [
        <Button action="/make-duel">Start</Button>,
        <Button action="/challenge/random">Matches</Button>,
        <Button.Link href="https://paragraph.xyz/@houseofcardians/rules-house-of-cardians#h-battle">
          Rules
        </Button.Link>,
        <Button action={`${BASE_URL}/top`}>＜ Back</Button>,
      ],
    });
  }

  // direct match
  const requestedChallengers = await warContract.read.requestedChallengers([
    gameId,
  ]);

  if (
    requestedChallengers !== zeroAddress &&
    requestedChallengers.toLowerCase() !== address.toLowerCase()
  ) {
    return c.error({ message: 'You are not the requested challenger' });
  }

  const totalBalance = quantities.reduce((acc, cur) => acc + cur, 0);

  c.deriveState((prevState) => {
    prevState.quantities = quantities;
    prevState.userName = userName;
    prevState.pfp_url = pfp_url;
    prevState.wager = wager;
    prevState.gameId = gameId;
    prevState.c_userName = c_userName;
    prevState.c_pfp_url = c_pfp_url;
    prevState.c_address = address;
    prevState.numOfCards = numOfCards;
    prevState.sumOfCards = sumOfCards;
  });

  return c.res({
    title,
    image:
      '/war/image/score/' +
      encodeURIComponent(JSON.stringify({ quantities, address })),
    imageAspectRatio: '1:1',
    action: '/choose',
    intents: [
      <TextInput placeholder="1,2....11,12,13 or J" />,
      <Button action="/duel">Set</Button>,
      totalBalance === 0 && (
        <Button action={BASE_URL + '/draw'}>Draw Card</Button>
      ),
    ],
  });
});

warApp.frame('/duel', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

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
    numOfCards,
    sumOfCards,
  } = c.previousState;

  // const inputCardNumber = inputText;
  // inputをsplitして配列にする
  const inputCardNumberArray =
    inputText && typeof inputText === 'string' ? inputText.split(',') : [];

  // splitしたinputをコンバートする
  const convertedArray = inputCardNumberArray.map((item) =>
    convertCardValue(item),
  );

  const allInputsValid = convertedArray.every((value) => value !== -1);
  if (!allInputsValid) {
    return c.error({ message: 'Invalid Input Number.' });
  }

  // 入力数がゲームに対応しているかチェック
  const isValidCardCount = numOfCards === convertedArray.length;
  if (!isValidCardCount) {
    return c.error({
      message: `Invalid number of cards. Please enter ${numOfCards} cards.`,
    });
  }

  const errorMessages = convertedArray
    .map((cardNumber) => checkCardNumber(cardNumber, quantities))
    .filter((message) => message !== '');

  if (errorMessages.length > 0) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: errorMessages.join(', '),
        quantities: quantities,
        c_address,
      }),
    );

    return c.res({
      title,
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [
        <Button action="/make-duel">Back</Button>,
        <Button action={`${BASE_URL}/draw`}>Draw</Button>,
      ],
    });
  }

  // 入力値が3,5個のいずれかなら合計値が25以下であることをチェック
  if (convertedArray.length === 3 || convertedArray.length === 5) {
    const sum = convertedArray.reduce((acc, curr) => {
      // 14（ジョーカー）は合計に含めない
      return curr !== 14 ? acc + curr : acc;
    }, 0);

    if (sum > 25) {
      return c.error({
        message:
          'The sum of card values (excluding Jokers) must not exceed 25.',
      });
    }
  }

  const cardArray = convertedArray.sort((a, b) => b - a);

  const c_card = cardArray;
  c.deriveState((prevState) => {
    prevState.c_card = c_card;
  });

  return c.res({
    title,
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
          numOfCards,
        }),
      ),

    imageAspectRatio: '1:1',
    action: '/loading',
    intents: [
      <Button.Transaction target="/challengeGame">Battle</Button.Transaction>,
      <Button action={`/challenge/${gameId}`}>Quit</Button>,
    ],
  });
});

warApp.transaction('/challengeGame', async (c) => {
  const { gameId, c_address, c_card } = c.previousState;

  try {
    if (gameId === undefined || c_card === undefined) {
      throw new Error('gameId or c_card is undefined');
    }

    const args: readonly [`0x${string}`, bigint[]] = [
      gameId,
      c_card.map((num) => BigInt(num)),
    ];

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
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  if (c.transactionId === undefined) return c.error({ message: 'No txId' });
  const transactionReceipt = await publicClient.getTransactionReceipt({
    hash: c.transactionId,
  });
  if (transactionReceipt && transactionReceipt.status == 'reverted') {
    return c.error({ message: 'Transaction failed' });
  }

  const {
    userName,
    pfp_url,
    wager,
    c_address,
    c_userName,
    c_pfp_url,
    gameId,
    numOfCards,
  } = c.previousState;

  await updateChallenger(gameId, String(c_address), c_userName!, c_pfp_url!);

  return c.res({
    title,
    image:
      '/war/image/loading/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          wager,
          c_userName,
          c_pfp_url,
          numOfCards,
        }),
      ),
    imageAspectRatio: '1:1',
    action: '/loading',
    intents: [<Button action={`/result/${gameId}`}>Check Result</Button>],
  });
});

warApp.frame('/result/:gameId', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const gameId = c.req.param('gameId') as `0x${string}`;
  const recentCard = c.previousState.c_card;

  let gameInfo;
  let contractResult;

  if (recentCard && recentCard.length > 0) {
    // DBのreadとコントラクトのreadを同時に行う
    [gameInfo, contractResult] = await Promise.all([
      getGameInfoByGameId(gameId),
      warContract.read.games([gameId]),
    ]);
  } else {
    gameInfo = await getGameInfoByGameId(gameId);
  }
  if (!gameInfo) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: 'Invalid Game Id',
      }),
    );
    return c.res({
      title,
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
    numOfCards,
  } = gameInfo;

  if (!winner || winner === zeroAddress) {
    if (!contractResult) {
      contractResult = await warContract.read.games([gameId]);
    }
    const makerCardIdentifier = contractResult[3];
    const challengerCardIdentifier = contractResult[4];

    winner = contractResult[2];
    c_card = contractResult[4];

    if (winner === zeroAddress && Number(makerCardIdentifier) === 0) {
      return c.error({ message: 'Please wait …' });
    }

    if (numOfCards === 1) {
      // 1枚のカードの場合
      card = Number(makerCardIdentifier);
      c_card = Number(challengerCardIdentifier);
    } else {
      const makerCards: number[] = [];
      const challengerCards: number[] = [];

      for (let i = 0; i < numOfCards; i++) {
        const [makerCard, challengerCard] = await Promise.all([
          warContract.read.playerCards([makerCardIdentifier, BigInt(i)]),
          warContract.read.playerCards([challengerCardIdentifier, BigInt(i)]),
        ]);
        makerCards.push(Number(makerCard));
        challengerCards.push(Number(challengerCard));
      }

      card = makerCards;
      c_card = challengerCards;
    }
    // レスポンス改善のためDBへの書き込みはwaitしない
    updateResult(gameId, card, c_card, winner);
  }

  let resultStatus: Result;

  if (numOfCards === 1) {
    // 1枚のカードの場合
    resultStatus =
      card === c_card
        ? Result.Draw
        : winner.toLowerCase() === c_address.toLowerCase()
        ? Result.Win
        : Result.Lose;
  } else {
    // 複数枚のカードの場合
    if (winner === zeroAddress) {
      resultStatus = Result.Draw;
    } else {
      resultStatus =
        winner.toLowerCase() === c_address.toLowerCase()
          ? Result.Win
          : Result.Lose;
    }
  }

  const resultParams = JSON.stringify({
    userName,
    pfp_url,
    card,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
    numOfCards,
    result: resultStatus,
  });

  const encodedResultParams = encodeURIComponent(resultParams);

  let shareLink = '';
  if (winner?.toLowerCase() === c_address?.toLowerCase()) {
    shareLink = `${shareUrlBase}Victory is mine! I beat @${userName} 🏆%0A${embedParam}${BASE_URL}/war/result/${gameId}`;
  } else if (winner?.toLowerCase() === zeroAddress) {
    shareLink = `${shareUrlBase}I drew with @${userName} 🤝%0A${embedParam}${BASE_URL}/war/result/${gameId}`;
  } else {
    shareLink = `${shareUrlBase}I lost to @${userName} 😭%0A${embedParam}${BASE_URL}/war/result/${gameId}`;
  }

  const intents = [<Button action={`/`}>Create Battle</Button>];
  if (c.frameData?.fid) {
    intents.unshift(<Button.Link href={shareLink}>Share</Button.Link>);
  }

  return c.res({
    title,
    image: `/war/image/result/${encodedResultParams}`,
    imageAspectRatio: '1:1',
    browserLocation: `/war/image/result/${encodedResultParams}`,
    intents,
  });
});

warApp.frame('/addAction', (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  return c.res({
    // TODO
    image: '/images/war/title.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button.AddCastAction action="/vs-match">Add</Button.AddCastAction>,
    ],
  });
});

warApp.castAction(
  '/lets-play',
  async (c) => {
    const { actionData } = c;
    const castHash = actionData?.castId.hash;

    return c.res({
      type: 'frame',
      path: `/make-direct-duel/${castHash}`,
    });
  },
  {
    name: "Let's Play🃏",
    icon: 'zap',
    description: 'Select a friend to play against!',
  },
);

warApp.frame('/make-direct-duel/:castHash', async (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  const castHash = c.req.param('castHash');
  // const params = JSON.parse(decodeURIComponent(c.req.param('params')));

  const {
    pfp_url: c_pfp_url,
    userName: c_userName,
    verifiedAddresses: c_verifiedAddresses,
  } = await getFarcasterUserInfoByCastHash(castHash);

  const c_address = c_verifiedAddresses[0];
  const c_hasInvitation = await checkInvitation(c_address);

  const { frameData } = c;
  const fid = frameData?.fid;
  const { pfp_url, userName, verifiedAddresses } = c.previousState.userName
    ? c.previousState
    : await getFarcasterUserInfo(fid);

  if (
    !verifiedAddresses ||
    verifiedAddresses.length === 0 ||
    !c_verifiedAddresses ||
    c_verifiedAddresses.length === 0
  ) {
    return c.res({
      title,
      image: '/images/verify.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const address = verifiedAddresses[0] as `0x${string}`;

  if (address.toLowerCase() === c_address.toLowerCase()) {
    return c.error({ message: 'You cannot battle yourself' });
  }

  const [hasNFT, quantities] = await Promise.all([
    checkInvitation(address),
    getQuantities(address, c),
  ]);

  if (!hasNFT) {
    return c.res({
      title,
      image: '/images/war/no_invi.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  c.deriveState((prevState) => {
    prevState.quantities = quantities;
    prevState.address = address;
    prevState.userName = userName;
    prevState.pfp_url = pfp_url;
    prevState.c_address = c_address;
    prevState.c_userName = c_userName;
    prevState.c_pfp_url = c_pfp_url;
    prevState.hasInvitation = hasNFT;
    prevState.verifiedAddresses = verifiedAddresses;
  });

  return c.res({
    title,
    image:
      '/war/image/score/' +
      encodeURIComponent(JSON.stringify({ quantities, address })),
    imageAspectRatio: '1:1',
    intents: [
      <TextInput placeholder="1,2....11,12,13 or J" />,
      <Button action="/preview">Set</Button>,
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
    .composite([{ input: overlayImage, gravity: 'center' }])
    .toBuffer();

  return finalImage;
};

const generateMultiLoadingImage = async (
  userName: string,
  pfp_url: string,
  wager: number,
  c_userName: string,
  c_pfp_url: string,
  numOfCards: number,
  c_card?: number[],
) => {
  const backgroundImageBuffer = await generateMultiDuelImage(
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
    numOfCards,
    c_card || [],
  );

  const backgroundImage = sharp(backgroundImageBuffer);

  const overlayImage = await sharp('./public/images/war/loading_overlay.png')
    .resize(1000, 1000)
    .toBuffer();

  const finalImage = await backgroundImage
    .composite([{ input: overlayImage, gravity: 'center' }])
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
  const {
    userName,
    pfp_url,
    wager,
    gameId,
    c_userName,
    c_pfp_url,
    numOfCards,
    sumOfCards,
  } = params;

  const status = await warContract.read.gameStatus([gameId]);
  // const gameInfo = await getGameInfoByGameId(gameId);

  // status
  // 0. NotExist,
  // 1. Created,
  // 2. Challenged,
  // 3. Revealed,
  // 4. Expired

  let png;

  if (numOfCards === 1) {
    if (status.toString() == '1') {
      png = await generateChallengeImage(
        true,
        userName,
        pfp_url,
        wager,
        c_userName,
        c_pfp_url,
      );
    } else if (status.toString() == '2' || status.toString() == '3') {
      png = await generatePlayedSimpleImage();
    } else {
      png = await generateExpiredSimpleImage();
    }
  } else {
    if (status.toString() == '1') {
      png = await generateMultiChallengeImage(
        true,
        userName,
        pfp_url,
        wager,
        c_userName,
        c_pfp_url,
        numOfCards,
        sumOfCards,
      );
    } else if (status.toString() == '2' || status.toString() == '3') {
      png = await generatePlayedSimpleImage();
    } else {
      png = await generateExpiredSimpleImage();
    }
  }

  const response = c.newResponse(png, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'max-age=300',
  });
  return response;
});

warApp.hono.get('/image/duel/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const {
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
    numOfCards,
  } = params;

  let png;

  if (numOfCards === 1) {
    png = await generateDuelImage(
      userName,
      pfp_url,
      wager,
      c_userName,
      c_pfp_url,
    );
  } else {
    png = await generateMultiDuelImage(
      userName,
      pfp_url,
      wager,
      c_userName,
      c_pfp_url,
      numOfCards,
      c_card,
    );
  }
  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/loading/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const {
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
    numOfCards,
  } = params;

  let png;
  if (numOfCards === 1)
    png = await generateLoadingImage(
      userName,
      pfp_url,
      wager,
      c_userName,
      c_pfp_url,
    );
  else {
    png = await generateMultiLoadingImage(
      userName,
      pfp_url,
      wager,
      c_userName,
      c_pfp_url,
      numOfCards,
      c_card,
    );
  }
  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

// ///////////////////
// Common Function
// ///////////////////
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

  const body = await c.req.json();
  const { trustedData } = body;
  const response = await fetch(`${BACKEND_URL!}/war/getReservedCards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messageBytes: trustedData.messageBytes,
    }),
  });

  const usedQuantities = await response.json();

  const quantities = data.map((quantity, index) => {
    const remainingQuantity =
      Number(quantity) - (Number(usedQuantities[index]) || 0);
    return remainingQuantity < 0 ? 0 : remainingQuantity;
  });

  return quantities;
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

    const response = await fetch(`${BACKEND_URL!}/war/sign`, {
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

  const number = Number(inputText);
  return isNaN(number);
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
  const { userName, pfp_url, card, wager, c_userName, c_pfp_url } = params;

  let png;
  if (card.length === 1) {
    png = await generatePreviewImage({
      userName,
      pfp_url,
      card,
      wager,
      c_userName,
      c_pfp_url,
    });
  } else {
    png = await generateMultiPreviewImage({
      userName,
      pfp_url,
      card,
      wager,
      c_userName,
      c_pfp_url,
    });
  }
  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/find/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const {
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
    numOfCards,
    sumOfCards,
  } = params;

  let png;
  if (numOfCards === 1) {
    png = await generateChallengeImage(
      false,
      userName,
      pfp_url,
      wager,
      c_userName,
      c_pfp_url,
    );
  } else {
    png = await generateMultiShareImage(
      false,
      userName,
      pfp_url,
      wager,
      c_userName,
      c_pfp_url,
      numOfCards,
      sumOfCards,
    );
  }
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
    result,
    numOfCards,
  } = params;

  let png;

  const jokerKilling = isJokerKilling(card, c_card);

  if (jokerKilling) {
    png = await generateJokerKillingImage(pfp_url, c_pfp_url, result);
  } else if (numOfCards === 1) {
    png = await generateResultImage(
      userName,
      pfp_url,
      card,
      wager,
      c_userName,
      c_pfp_url,
      c_card,
      result,
    );
  } else {
    png = await generateMultiResultImage(
      userName,
      pfp_url,
      card,
      wager,
      c_userName,
      c_pfp_url,
      c_card,
      result,
      numOfCards,
    );
  }

  return c.newResponse(png, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'max-age=3600',
  });
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

  const overlayComponents = quantities
    .map((quantity: number, index: number) => {
      const components = [];

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

      if (quantity < 1) {
        const x = 100 + (index % cols) * cardWidth + (index % cols) * px;
        const y =
          127 +
          Math.floor(index / cols) * cardHeight +
          Math.floor(index / cols) * py;

        const overlay = Buffer.from(`
        <svg width="${cardWidth}" height="${cardHeight}">
          <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.8)" rx="10" ry="10" />
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
    .composite([
      ...overlayComponents,
      { input: addressImage, top: 50, left: 700 },
    ])
    .png()
    .toBuffer();

  return finalImage;
};

const generateChallengeImage = async (
  share: boolean,
  userName: string,
  pfp_url: string,
  wager: number,
  c_userName: string = '',
  c_pfp_url: string = '',
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

  let leftUserTop = 479;
  if (!isBet) {
    leftUserTop += 48;
  }

  const topPfpSize = 75;
  const topUserNameFontSize = 40;

  const userComponent = await generateUserComponent(userName, pfp_url);

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
    .resize(topPfpSize, topPfpSize)
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

  const composites = [
    {
      input: userComponent,
      left: 58,
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
  ];

  if (isBet) {
    composites.push({ input: wagerImage, left: 500, top: 888 });
  }

  // direct match
  if (c_userName && c_pfp_url) {
    const opponentComponent = await generateUserComponent(
      c_userName,
      c_pfp_url,
    );
    composites.push({
      input: opponentComponent,
      left: 742,
      top: leftUserTop,
    });
  }

  const png = await canvas.composite(composites).png().toBuffer();
  return png;
};

const generateMultiChallengeImage = async (
  share: boolean,
  userName: string,
  pfp_url: string,
  wager: number,
  c_userName: string = '',
  c_pfp_url: string = '',
  numOfCards: number,
  sumOfCards: number,
) => {
  const imageName =
    numOfCards === 3 ? '3_card_challenge.png' : '5_card_challenge.png';

  const response = await fetch(pfp_url);
  const pfpBuffer = await response.arrayBuffer();

  const canvas = sharp('./public/images/war/multi/' + imageName).resize(
    1000,
    1000,
  );

  const topUserTop = 56;
  const topUserLeft = 460;
  const bottomUserLeft = 320;
  const bottomUserTop = 914;

  const topPfpSize = 75;
  const topUserNameFontSize = 40;

  const userComponent = await generateUserComponent(userName, pfp_url);

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

  const topSvgText = `
    <svg width="500" height="${topPfpSize}">
      <text x="0" y="50%" dy="0.35em" font-family="Arial" font-size="${topUserNameFontSize}" fill="white">${userName}</text>
    </svg>
  `;

  const topUserNameImage = await sharp(Buffer.from(topSvgText))
    .png()
    .toBuffer();

  const sumOfCardsImage = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="1000">${sumOfCards}</span>`,
      font: 'Bigelow Rules',
      fontfile: './public/fonts/BigelowRules-Regular.ttf',
      rgba: true,
      width: 40,
      height: 40,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  const composites = [
    {
      input: userComponent,
      left: bottomUserLeft,
      top: bottomUserTop,
    },
    {
      input: topPfpImage,
      left: topUserLeft,
      top: topUserTop,
    },
    {
      input: topUserNameImage,
      left: topUserLeft + topPfpSize + 20,
      top: topUserTop,
    },
    { input: sumOfCardsImage, left: 576, top: 168 },
  ];

  // direct match
  if (c_userName && c_pfp_url) {
    const opponentComponent = await generateUserComponent(
      c_userName,
      c_pfp_url,
    );
    composites.push({
      input: opponentComponent,
      left: bottomUserLeft,
      top: 246,
    });
  }

  const png = await canvas.composite(composites).png().toBuffer();
  return png;
};

const generateMultiShareImage = async (
  share: boolean,
  userName: string,
  pfp_url: string,
  wager: number,
  c_userName: string = '',
  c_pfp_url: string = '',
  numOfCards: number,
  sumOfCards: number,
) => {
  const imageName = numOfCards === 3 ? '3_card_share.png' : '5_card_share.png';

  const response = await fetch(pfp_url);
  const pfpBuffer = await response.arrayBuffer();

  const canvas = sharp('./public/images/war/multi/' + imageName).resize(
    1000,
    1000,
  );

  const topUserTop = 56;
  const topUserLeft = 460;
  const bottomUserLeft = 320;
  const bottomUserTop = 914;

  const topPfpSize = 75;
  const topUserNameFontSize = 40;

  const userComponent = await generateUserComponent(userName, pfp_url);

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

  const topSvgText = `
    <svg width="500" height="${topPfpSize}">
      <text x="0" y="50%" dy="0.35em" font-family="Arial" font-size="${topUserNameFontSize}" fill="white">${userName}</text>
    </svg>
  `;

  const topUserNameImage = await sharp(Buffer.from(topSvgText))
    .png()
    .toBuffer();

  const sumOfCardsImage = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="1000">${sumOfCards}</span>`,
      font: 'Bigelow Rules',
      fontfile: './public/fonts/BigelowRules-Regular.ttf',
      rgba: true,
      width: 40,
      height: 40,
      align: 'left',
    },
  })
    .png()
    .toBuffer();

  const composites = [
    {
      input: userComponent,
      left: bottomUserLeft,
      top: bottomUserTop,
    },
    {
      input: topPfpImage,
      left: topUserLeft,
      top: topUserTop,
    },
    {
      input: topUserNameImage,
      left: topUserLeft + topPfpSize + 20,
      top: topUserTop,
    },
    { input: sumOfCardsImage, left: 652, top: 168 },
  ];

  // direct match
  if (c_userName && c_pfp_url) {
    const opponentComponent = await generateUserComponent(
      c_userName,
      c_pfp_url,
    );
    composites.push({
      input: opponentComponent,
      left: bottomUserLeft,
      top: 246,
    });
  }

  const png = await canvas.composite(composites).png().toBuffer();
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

  const textImage = sharp(svgTextBuffer);
  const textMetadata = await textImage.metadata();
  const textWidth = textMetadata.width ?? 0;

  const combinedImageWidth = pfpSize + textWidth + 10;

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

const generatePreviewImage = async ({
  userName,
  pfp_url,
  card,
  wager,
  c_userName,
  c_pfp_url,
}: {
  userName: string;
  pfp_url: string;
  card: number;
  wager: number;
  c_userName?: string;
  c_pfp_url?: string;
}) => {
  const isBet = wager > 0;
  const imageName = isBet ? 'tx_make_bet.png' : 'tx_make.png';
  const canvas = sharp(`./public/images/war/${imageName}`).resize(1000, 1000);

  const [userComponent, cardImage, wagerImage] = await Promise.all([
    generateUserComponent(userName, pfp_url),
    sharp(`./public/images/war/card/${card}.png`).resize(185).png().toBuffer(),
    isBet
      ? sharp({
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
          .toBuffer()
      : Promise.resolve(null),
  ]);

  const isBetAdjustment = isBet ? 0 : 48;

  const composites = [
    { input: userComponent, left: 57, top: 480 + isBetAdjustment },
    { input: cardImage, left: 290, top: 361 + isBetAdjustment },
  ];

  if (isBet && wagerImage) {
    composites.push({ input: wagerImage, left: 490, top: 845 });
  }

  // direct match
  if (c_userName && c_pfp_url) {
    const opponentComponent = await generateUserComponent(
      c_userName,
      c_pfp_url,
    );
    composites.push({
      input: opponentComponent,
      left: 744,
      top: 480 + isBetAdjustment,
    });
  }

  const png = await canvas.composite(composites).png().toBuffer();
  return png;
};

const calculateCardPositions = (handSize: number, top: number) => {
  const cardWidth = 100;
  const spacing = 23; // カード間のスペース
  const totalWidth = handSize * cardWidth + (handSize - 1) * spacing;
  const startLeft = (1000 - totalWidth) / 2; // キャンバスの中央に配置

  return Array.from({ length: handSize }, (_, index) => ({
    left: startLeft + index * (cardWidth + spacing),
    top: top,
  }));
};
const generateMultiPreviewImage = async ({
  userName,
  pfp_url,
  card,
  wager,
  c_userName,
  c_pfp_url,
}: {
  userName: string;
  pfp_url: string;
  card: number[];
  wager: number;
  c_userName?: string;
  c_pfp_url?: string;
}) => {
  const isBet = wager > 0;
  const cardWidth = 100;

  const handSize = card.length;
  const imageName =
    handSize === 3 ? '3_card_preview.png' : '5_card_preview.png';
  const canvas = sharp(`./public/images/war/multi/${imageName}`).resize(
    1000,
    1000,
  );

  const cardImagePromises = card
    .slice(0, handSize)
    .map((cardValue) =>
      sharp(`./public/images/war/multi/card/${cardValue}.png`)
        .resize(cardWidth)
        .png()
        .toBuffer(),
    );

  const [userComponent, ...cardImages] = await Promise.all([
    generateUserComponent(userName, pfp_url),
    ...cardImagePromises,
  ]);

  const cardPositions = calculateCardPositions(handSize, 622);

  const composites = [
    { input: userComponent, left: 328, top: 914 },
    ...cardImages.map((cardImage, index) => ({
      input: cardImage,
      left: cardPositions[index].left,
      top: cardPositions[index].top,
    })),
  ];

  // direct match
  if (c_userName && c_pfp_url) {
    const opponentComponent = await generateUserComponent(
      c_userName,
      c_pfp_url,
    );
    composites.push({
      input: opponentComponent,
      left: 328,
      top: 244,
    });
  }

  const png = await canvas.composite(composites).png().toBuffer();
  return png;
};

const generatePlayedSimpleImage = async () => {
  const canvas = sharp('./public/images/war/played.png').resize(1000, 1000);

  const png = await canvas.png().toBuffer();
  return png;
};
const generateExpiredSimpleImage = async () => {
  const canvas = sharp('./public/images/war/expired.png').resize(1000, 1000);

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
    backgroundImageBuffer = await generateChallengeImage(
      true,
      userName,
      pfp_url,
      wager,
    );
  } else if (status === 3) {
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

  const [wagerImage, userComponent, opponentComponent] = await Promise.all([
    isBet
      ? sharp({
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
          .toBuffer()
      : Promise.resolve(null),
    generateUserComponent(userName, pfp_url),
    generateUserComponent(c_userName, c_pfp_url),
  ]);

  const composites = [
    { input: userComponent, top: 533, left: 53 },
    { input: opponentComponent, top: 533, left: 740 },
  ];

  if (isBet && wagerImage) {
    composites.push({ input: wagerImage, left: 490, top: 845 });
  }

  const finalImage = await baseImage.composite(composites).png().toBuffer();

  return finalImage;
};

const generateMultiDuelImage = async (
  userName: string,
  pfp_url: string,
  wager: number,
  c_userName: string,
  c_pfp_url: string,
  numOfCards: number,
  c_card?: number[],
  card?: number[],
) => {
  const userLeft = 320;
  const topUserTop = 246;
  const bottomUserTop = 914;

  const cardWidth = 100;

  const imageName =
    numOfCards === 3
      ? '3_card_challenge_preview.png'
      : '5_card_challenge_preview.png';

  const baseImage = sharp('./public/images/war/multi/' + imageName).resize(
    1000,
    1000,
  );

  const cardList =
    c_card && c_card.length > 0 ? c_card : Array(numOfCards).fill(0);

  const cardImagePromises = cardList
    .slice(0, numOfCards)
    .map((cardValue) =>
      sharp(`./public/images/war/multi/card/${cardValue}.png`)
        .resize(cardWidth)
        .png()
        .toBuffer(),
    );

  const [userComponent, opponentComponent, ...cardImages] = await Promise.all([
    generateUserComponent(userName, pfp_url),
    generateUserComponent(c_userName, c_pfp_url),
    ...cardImagePromises,
  ]);

  const cardPositions = calculateCardPositions(numOfCards, 444);

  const composites = [
    { input: userComponent, top: bottomUserTop, left: userLeft },
    { input: opponentComponent, top: topUserTop, left: userLeft },
    ...cardImages.map((cardImage, index) => ({
      input: cardImage,
      left: cardPositions[index].left,
      top: cardPositions[index].top,
    })),
  ];

  if (card && card.length > 0) {
    const makerCardImagePromises = card
      .slice(0, numOfCards)
      .map((cardValue) =>
        sharp(`./public/images/war/multi/card/${cardValue}.png`)
          .resize(cardWidth)
          .png()
          .toBuffer(),
      );
    const [...cardImages] = await Promise.all([...makerCardImagePromises]);
    const cardPositions = calculateCardPositions(numOfCards, 620);
    composites.push(
      ...cardImages.map((cardImage, index) => ({
        input: cardImage,
        left: cardPositions[index].left,
        top: cardPositions[index].top,
      })),
    );
  }

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

  // const [cardImage, c_cardImage, userComponent, opponentComponent] =
  //   await Promise.all([
  //     sharp(`./public/images/war/card/${card}.png`)
  //       .resize(185)
  //       .png()
  //       .toBuffer(),
  //     sharp(`./public/images/war/card/${c_card}.png`)
  //       .resize(185)
  //       .png()
  //       .toBuffer(),
  //     generateUserComponent(userName, pfp_url),
  //     generateUserComponent(c_userName, c_pfp_url),
  //   ]);

  const composites: any[] = [
    // { input: userComponent, top: 533, left: 100 },
    // { input: opponentComponent, top: 533, left: 740 },
    // ...(cardImage ? [{ input: cardImage, left: 289, top: 420 }] : []),
    // ...(c_cardImage ? [{ input: c_cardImage, left: 527, top: 420 }] : []),
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
  result: Result,
) => {
  const backgroundImageBuffer = await generateResultBgImage(
    userName,
    pfp_url,
    card,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
  );

  const backgroundImage = sharp(backgroundImageBuffer);

  const overlayImageName =
    result === Result.Win
      ? 'result_victory_overlay.png'
      : result === Result.Lose
      ? 'result_defeat_overlay.png'
      : 'result_draw_overlay.png';

  const overlayImage = await sharp('./public/images/war/' + overlayImageName)
    .resize(1000, 1000)
    .toBuffer();

  const [hostCardImage, challengerCardImage, userComponent, opponentComponent] =
    await Promise.all([
      sharp(`./public/images/war/card/${card}.png`)
        .resize(CARD_SIZE)
        .png()
        .toBuffer(),
      sharp(`./public/images/war/card/${c_card}.png`)
        .resize(CARD_SIZE)
        .png()
        .toBuffer(),
      generateUserComponent(userName, pfp_url),
      generateUserComponent(c_userName, c_pfp_url),
    ]);

  const userComponentMetadata = await sharp(userComponent).metadata();
  const opponentComponentMetadata = await sharp(opponentComponent).metadata();

  const cardTop = 370;
  const hostCardLeft = 20;
  const challengerCardLeft = IMAGE_SIZE - hostCardLeft - CARD_SIZE;

  const containerWidth = 370;
  const userNameTop = 690;

  const userComponentLeft = Math.round(
    hostCardLeft +
      (CARD_SIZE - (userComponentMetadata.width ?? 0)) / 2 +
      containerWidth / 2,
  );
  const userComponentTop = userNameTop;

  const opponentComponentLeft = Math.round(
    challengerCardLeft -
      (opponentComponentMetadata.width ?? 0) / 2 +
      containerWidth / 2 +
      110,
  );
  const opponentComponentTop = userNameTop;

  const finalImage = await backgroundImage
    .composite([
      { input: overlayImage, gravity: 'center' },
      { input: hostCardImage, left: hostCardLeft, top: cardTop },
      { input: challengerCardImage, left: challengerCardLeft, top: cardTop },
      { input: userComponent, left: userComponentLeft, top: userComponentTop },
      {
        input: opponentComponent,
        left: opponentComponentLeft,
        top: opponentComponentTop,
      },
    ])
    .toBuffer();

  return finalImage;
};

const generateMultiResultImage = async (
  userName: string,
  pfp_url: string,
  card: number[],
  wager: number,
  c_userName: string,
  c_pfp_url: string,
  c_card: number[],
  result: Result,
  numOfCards: number,
) => {
  // 定数定義
  const CARD_SIZE = 120;
  const CARD_SPACING = numOfCards === 3 ? 70 : 60;
  const IMAGE_SIZE = 1000;
  const HORIZONTAL_ADJUST = 20;
  const cardLeft = 70;
  const cardRight = IMAGE_SIZE - CARD_SIZE - cardLeft;

  [card, c_card] = reorderCards(card, c_card);

  // 背景画像生成
  const backgroundImageBuffer = await generateMultiDuelImage(
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
    numOfCards,
    c_card || [],
    card,
  );
  const backgroundImage = sharp(backgroundImageBuffer);

  // 各カードの勝敗を判定
  const results = card.map((card, index) => {
    if (card > c_card[index]) return Result.Win;
    if (card < c_card[index]) return Result.Lose;
    return Result.Draw;
  });

  // 全体の結果を計算
  const overallResult = results.reduce((acc, result) => {
    if (acc === Result.Draw) return result;
    if (result === Result.Draw) return acc;
    if (acc === Result.Win && result === Result.Lose) return Result.Draw;
    if (acc === Result.Lose && result === Result.Win) return Result.Draw;
    return acc;
  }, Result.Draw);

  // オーバーレイ画像の選択と読み込み
  const overlayImageName =
    result === Result.Win
      ? 'result_victory_overlay.png'
      : result === Result.Lose
      ? 'result_defeat_overlay.png'
      : 'result_draw_overlay.png';
  const overlayImage = await sharp('./public/images/war/' + overlayImageName)
    .resize(IMAGE_SIZE, IMAGE_SIZE)
    .toBuffer();

  // カード画像とユーザーコンポーネントの生成
  const [
    userCardImages,
    challengerCardImages,
    userComponent,
    opponentComponent,
  ] = await Promise.all([
    Promise.all(
      card.map((cardValue, index) => {
        const cardPath =
          results[index] === Result.Win
            ? `./public/images/war/multi/card/${cardValue}.png`
            : `./public/images/war/multi/card/dark/${cardValue}.png`;
        return sharp(cardPath).resize(CARD_SIZE).png().toBuffer();
      }),
    ),
    Promise.all(
      c_card.map((cardValue, index) => {
        const cardPath =
          results[index] === Result.Lose
            ? `./public/images/war/multi/card/${cardValue}.png`
            : `./public/images/war/multi/card/dark/${cardValue}.png`;
        return sharp(cardPath).resize(CARD_SIZE).png().toBuffer();
      }),
    ),
    generateUserComponent(userName, pfp_url),
    generateUserComponent(c_userName, c_pfp_url),
  ]);

  // ユーザーコンポーネントのメタデータ取得
  const userComponentMetadata = await sharp(userComponent).metadata();
  const opponentComponentMetadata = await sharp(opponentComponent).metadata();

  // カードとコンポーネントの配置計算
  const totalCardsHeight =
    (CARD_SIZE + CARD_SPACING) * numOfCards - CARD_SPACING;
  const verticalOffset = numOfCards === 5 ? -50 : 0;
  const cardsVerticalCenter =
    (IMAGE_SIZE - totalCardsHeight) / 2 + verticalOffset;

  const COMPONENT_VERTICAL_ADJUST = 10; // この値を調整して、下げる量を制御します
  const componentTop =
    cardsVerticalCenter + totalCardsHeight + 50 + COMPONENT_VERTICAL_ADJUST;

  // ユーザーコンポーネントの位置計算
  const userComponentLeft =
    cardLeft +
    (CARD_SIZE - (userComponentMetadata.width ?? 0)) / 2 -
    HORIZONTAL_ADJUST;
  const opponentComponentLeft =
    cardRight +
    (CARD_SIZE - (opponentComponentMetadata.width ?? 0)) / 2 -
    HORIZONTAL_ADJUST;

  // コンポーネントの位置がカードの範囲内に収まるように調整
  const adjustedUserComponentLeft = Math.max(
    cardLeft - HORIZONTAL_ADJUST,
    Math.min(
      userComponentLeft,
      cardLeft + CARD_SIZE - (userComponentMetadata.width ?? 0),
    ),
  );
  const adjustedOpponentComponentLeft = Math.max(
    cardRight,
    Math.min(
      opponentComponentLeft,
      cardRight + CARD_SIZE - (opponentComponentMetadata.width ?? 0),
    ),
  );

  // 勝利数を計算する関数
  const calculateWins = (results: Result[]): [number, number] => {
    const playerWins = results.filter((r) => r === Result.Win).length;
    const opponentWins = results.filter((r) => r === Result.Lose).length;
    return [playerWins, opponentWins];
  };

  // 勝利数の計算
  const [playerWins, opponentWins] = calculateWins(results);

  // 結果テキストの作成
  const resultText = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="1000">${playerWins}-${opponentWins}</span>`,
      font: 'Bigelow Rules',
      fontfile: './public/fonts/BigelowRules-Regular.ttf',
      rgba: true,
      width: 300,
      height: 140,
      align: 'center',
    },
  })
    .png()
    .toBuffer();
  const resultTextMetadata = await sharp(resultText).metadata();

  const textLeft = (IMAGE_SIZE - (resultTextMetadata.width ?? 0)) / 2;
  const textTop = 700;

  // 合成操作の定義
  const compositeOperations = [
    { input: overlayImage, gravity: 'center' },
    ...userCardImages.map((cardImage, index) => ({
      input: cardImage,
      left: cardLeft,
      top: cardsVerticalCenter + (CARD_SIZE + CARD_SPACING) * index,
    })),
    ...challengerCardImages.map((cardImage, index) => ({
      input: cardImage,
      left: cardRight,
      top: cardsVerticalCenter + (CARD_SIZE + CARD_SPACING) * index,
    })),
    {
      input: userComponent,
      left: adjustedUserComponentLeft,
      top: componentTop,
    },
    {
      input: opponentComponent,
      left: adjustedOpponentComponentLeft,
      top: componentTop,
    },

    { input: resultText, left: textLeft, top: textTop },
  ];

  // 最終画像の生成
  const finalImage = await backgroundImage
    .composite(compositeOperations)
    .toBuffer();

  return finalImage;
};

// カードの並び替え処理
const reorderCards = (
  playerCards: number[],
  opponentCards: number[],
): [number[], number[]] => {
  const playerHasJoker = playerCards.includes(14);
  const opponentHasJoker = opponentCards.includes(14);
  const playerHasAce = playerCards.includes(1);
  const opponentHasAce = opponentCards.includes(1);

  if (
    (playerHasJoker && opponentHasAce) ||
    (playerHasAce && opponentHasJoker)
  ) {
    const newPlayerCards = [...playerCards];
    const newOpponentCards = [...opponentCards];

    if (playerHasAce) {
      const aceIndex = newPlayerCards.indexOf(1);
      newPlayerCards.splice(aceIndex, 1);
      newPlayerCards.unshift(1);
    }
    if (opponentHasAce) {
      const aceIndex = newOpponentCards.indexOf(1);
      newOpponentCards.splice(aceIndex, 1);
      newOpponentCards.unshift(1);
    }

    return [newPlayerCards, newOpponentCards];
  }

  return [playerCards, opponentCards];
};

const generateJokerKillingImage = async (
  pfp_url: string,
  c_pfp_url: string,
  jokerKilling: 'Win' | 'Lose',
) => {
  const seedString = pfp_url + c_pfp_url;
  const seed = seedString
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const imageNo = (seed % 5) + 1;

  const container = sharp(
    `./public/images/war/jokerkilling/jokerkilling_${imageNo}_${jokerKilling.toLowerCase()}.png`,
  ).resize(1000, 1000);

  let pfpSize = 0;
  let pfpLeft = 0;
  let pfpTop = 0;
  let c_pfpSize = 0;
  let c_pfpLeft = 0;
  let c_pfpTop = 0;

  switch (imageNo) {
    case 1:
      pfpSize = 145;
      pfpLeft = 383;
      pfpTop = 45;
      c_pfpSize = 145;
      c_pfpLeft = 727;
      c_pfpTop = 778;
      break;
    case 2:
      pfpSize = 154;
      pfpLeft = 173;
      pfpTop = 276;
      c_pfpSize = 154;
      c_pfpLeft = 787;
      c_pfpTop = 102;
      break;
    case 3:
      pfpSize = 130;
      pfpLeft = 375;
      pfpTop = 683;
      c_pfpSize = 105;
      c_pfpLeft = 449;
      c_pfpTop = 148;
      break;
    case 4:
      pfpSize = 92;
      pfpLeft = 452;
      pfpTop = 231;
      c_pfpSize = 85;
      c_pfpLeft = 475;
      c_pfpTop = 640;
      break;
    case 5:
      pfpSize = 137;
      pfpLeft = 372;
      pfpTop = 287;
      c_pfpSize = 144;
      c_pfpLeft = 418;
      c_pfpTop = 692;
      break;
  }

  const [pfpImage, c_pfpImage] = await Promise.all([
    sharp(Buffer.from(await fetch(pfp_url).then((res) => res.arrayBuffer())))
      .resize(pfpSize, pfpSize)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${pfpSize}" height="${pfpSize}"><circle cx="${
              pfpSize / 2
            }" cy="${pfpSize / 2}" r="${pfpSize / 2}" fill="white" /></svg>`,
          ),
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer(),
    sharp(Buffer.from(await fetch(c_pfp_url).then((res) => res.arrayBuffer())))
      .resize(c_pfpSize, c_pfpSize)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${c_pfpSize}" height="${c_pfpSize}"><circle cx="${
              c_pfpSize / 2
            }" cy="${c_pfpSize / 2}" r="${
              c_pfpSize / 2
            }" fill="white" /></svg>`,
          ),
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer(),
  ]);

  const finalImage = await container
    .composite([
      { input: pfpImage, left: pfpLeft, top: pfpTop },
      { input: c_pfpImage, left: c_pfpLeft, top: c_pfpTop },
    ])
    .toBuffer();

  return finalImage;
};
