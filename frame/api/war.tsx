import { Button, Frog, TextInput } from 'frog';
import { NEYNAR_API_KEY, WAR_CONTRACT_ADDRESS } from '../constant/config.js';
import tweClient from '../lib/thirdweb-engine/index.js';
import { convertCardValue } from '../lib/convertCardValue.js';
import {
  cardContract,
  warContract,
  inivtationNFTContracrt,
} from '../lib/contract.js';

import sharp from 'sharp';
import JSON from 'json-bigint';
import { CARD_ABI, WAR_ABI } from '../constant/abi.js';
import {
  zeroAddress,
  encodePacked,
  keccak256,
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

// Common
const getUserData = async (fid: string) => {
  const userInfo = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}&viewer_fid=3`,
    {
      method: 'GET',
      headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
    },
  );
  const userData = await userInfo.json();
  const pfp_url = userData.users[0].pfp_url;
  const userName = userData.users[0].username;
  const verifyedAddresses = userData.users[0].verified_addresses.eth_addresses;
  const verifyedAddress = verifyedAddresses[0];

  return { pfp_url, userName, verifyedAddress };
};

const getQuantities = async (address: string) => {
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

  const quantities = data.map((quantity) => Number(quantity));
  return quantities;
};

warApp.frame('/', (c) => {
  return c.res({
    image: '/images/war/title.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/make-duel">make duel</Button>,
      <Button action="/rule">Rule</Button>,
    ],
  });
});

const checkInvitation = async (address: `0x${string}`) => {
  const balance = await inivtationNFTContracrt.read.balanceOf([address]);
  console.log(balance);
  return Number(balance) > 0;
};

warApp.frame('/make-duel', async (c) => {
  const { frameData } = c;
  const fid = frameData?.fid !== undefined ? frameData.fid.toString() : '';
  const { pfp_url, userName, verifyedAddress } = await getUserData(fid);

  // Check Verifyed Address
  if (!verifyedAddress) {
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

  const quantities = await getQuantities(address);

  c.deriveState((prevState) => {
    prevState.quantities = quantities;
    prevState.address = address;
    prevState.userName = userName;
    prevState.pfp_url = pfp_url;
  });

  return c.res({
    image: '/war/image/score/' + encodeURIComponent(JSON.stringify(quantities)),
    imageAspectRatio: '1:1',
    intents: [
      <TextInput placeholder="11 or J or ..." />,
      <Button action="/bet">Set</Button>,
    ],
  });
});

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

warApp.frame('/bet', async (c) => {
  const { inputText } = c;

  const { quantities, card } = c.previousState;

  const inputCardNumber = inputText || card;

  const cardNumber = convertCardValue(inputCardNumber as string);
  console.log('card:', cardNumber);

  const errorMessage = checkCardNumber(cardNumber, quantities);

  if (errorMessage) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: errorMessage,
        quantities: quantities,
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
        message: 'Faild get signature',
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

  return c.res({
    image: '/images/war/bet.png',
    imageAspectRatio: '1:1',
    intents: [
      <TextInput placeholder="999" />,
      <Button action="/preview">Bet</Button>,
    ],
  });
});

async function getSignature(c: any): Promise<string> {
  try {
    const body = await c.req.json();
    const { trustedData } = body;

    console.log('A');
    console.time('fetch signature');
    const response = await fetch(`${process.env.BACKEND_URL!}/war/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageBytes: trustedData.messageBytes,
      }),
    });
    console.timeEnd('fetch signature');

    console.log('b');
    console.log(response.ok);
    if (!response.ok) {
      console.error('Failed to fetch the signature:', response.statusText);
      return '';
    }

    const responseText = await response.text();
    console.log(responseText);

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
}

function safeIsNaN(inputText: string | undefined): boolean {
  if (inputText === undefined || inputText === '') {
    return false;
  }

  const number = Number(inputText); // 文字列を数値に変換
  return isNaN(number); // 変換された数値が NaN であるかどうかをチェック
}

warApp.frame('/preview', async (c) => {
  const { inputText } = c;
  const { userName, pfp_url, card, quantities } = c.previousState;
  console.log(c.previousState);

  console.log(inputText, safeIsNaN(inputText));

  if (safeIsNaN(inputText)) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: 'Invalid Number',
        quantities: quantities,
      }),
    );

    return c.res({
      image: `/war/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [<Button action="/bet">Back</Button>],
    });
  }

  const wager = Number(inputText) || 0;
  c.deriveState((prevState) => {
    prevState.wager = wager;
  });

  console.log({
    userName,
    pfp_url,
    card,
    wager,
  });

  return c.res({
    image:
      '/war/image/preview/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          card,
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
  const { address, card, wager, signature } = c.previousState;

  const salt = Math.floor(Math.random() * 1000000);

  const messageHash = keccak256(
    encodePacked(['uint256', 'uint256'], [BigInt(card), BigInt(salt)]),
  );

  // TODO APIとかからサインするようにする
  // const privateKey = generatePrivateKey();
  // const privateKey =
  //   '0xfd95fb2325d5462ebe5832fb969e06ca4d66c944404b323475e60df4402e0451';

  // const account = privateKeyToAccount(privateKey);
  // const signature = (await account.signMessage({
  //   message: messageHash,
  // })) as `0x${string}`;

  // currency, betAmount, isNaitiveToken, signature
  // const args = [zeroAddress, 0, true, signature];
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

  console.log(receipt);

  console.log('A');

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

  console.log(gameMadeEvent);
  console.log('B');
  console.log(gameMadeEvent?.args);
  const gameId =
    gameMadeEvent?.args && 'gameId' in gameMadeEvent.args
      ? gameMadeEvent.args.gameId
      : null;
  console.log(gameId);
  console.log('C');

  if (!gameId) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: 'GameId retribe error',
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
  console.log(shareLink);

  return c.res({
    image: '/war/image/find/' + params,
    browserLocation: '/war/image/find/' + params,

    imageAspectRatio: '1:1',
    intents: [<Button.Link href={shareLink}>Find a duel partner</Button.Link>],
  });
});

const generateOwnCard = async (quantities: number[]) => {
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
        left: 120 + index * 52,
      });

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

  const finalImage = await baseImage.composite(composites).png().toBuffer();

  return finalImage;
};

warApp.hono.get('/image/score/:quantities', async (c) => {
  const quantities = JSON.parse(decodeURIComponent(c.req.param('quantities')));

  const finalImage = await generateOwnCard(quantities);

  return c.newResponse(finalImage, 200, {
    'Content-Type': 'image/png',
  });
});

warApp.hono.get('/image/preview/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, card, wager } = params;

  const response = await fetch(pfp_url);
  const pfpBuffer = await response.arrayBuffer();

  const isBet = wager > 0;
  const imageName = isBet ? 'tx_make_bet.png' : 'tx_make.png';

  const canvas = sharp('./public/images/war/' + imageName).resize(1000, 1000);

  const pfpSize = 42;
  const userNameFontSize = 20;

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
    {
      input: pfpImage,
      left: 94,
      top: isBet ? 486 : 486 + 48,
    },
    {
      input: userNameImage,
      left: 94 + pfpSize + 10,
      top: isBet ? 486 : 486 + 48,
    },
    {
      input: cardImage,
      left: 290,
      top: isBet ? 366 : 366 + 48,
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

  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

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

  const pfpSize = 42;
  const userNameFontSize = 20;

  const topPfpSize = 75;
  const topUserNameFontSize = 48;

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
      top: isBet ? 486 : 486 + 42,
    },
    {
      input: userNameImage,
      left: 94 + pfpSize + 10,
      top: isBet ? 486 : 486 + 42,
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

warApp.hono.get('/image/find/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager } = params;

  const png = await generateChallengeImage(false, userName, pfp_url, wager);
  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/error/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));

  const { message, quantities } = params;

  const backgroundImage = await generateOwnCard(quantities);

  const svgOverlay = Buffer.from(`
  <svg width="1000" height="1000">
    <rect width="1000" height="1000" fill="rgba(0, 0, 0, 0.5)" />
    <text x="500" y="450" font-family="Bigelow Rules" font-size="150" fill="white" text-anchor="middle">
      ${message
        .split('\n')
        .map(
          (line: string, index: number) =>
            `<tspan x="500" dy="${index * 120}">${line}</tspan>`,
        )
        .join('')}
    </text>
  </svg>
`);

  const canvas = await sharp(backgroundImage);

  const finalImage = await canvas
    .composite([
      {
        input: backgroundImage,
        top: 0,
        left: 0,
      },
      {
        // input:  messageImage,
        input: svgOverlay,
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return c.newResponse(finalImage, 200, { 'Content-Type': 'image/png' });
});

warApp.frame('/rule', (c) => {
  return c.res({
    image: '/rule.png',
    imageAspectRatio: '1:1',
    intents: [<Button action={`/`}>Back</Button>],
  });
});

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

  const { userName, pfp_url, wager } = gameInfo;

  // const userName = 'ytenden';
  // const pfp_url =
  //   'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/a32e3541-f87b-4814-fee5-5ec1cee3c600/original';
  // const wager = 0;

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

warApp.hono.get('/image/challenge/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager } = params;
  const png = await generateChallengeImage(true, userName, pfp_url, wager);
  return c.newResponse(png, 200, { 'Content-Type': 'image/png' });
});

warApp.frame('/choose', async (c) => {
  const { quantities } = c.previousState;

  return c.res({
    image: '/war/image/score/' + encodeURIComponent(JSON.stringify(quantities)),
    imageAspectRatio: '1:1',
    action: '/choose',
    intents: [
      <TextInput placeholder="11 or J or ..." />,
      <Button action="/duel">Set</Button>,
    ],
  });
});

warApp.frame('/choose/:params', async (c) => {
  console.log('choooose');
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager, gameId } = params;

  const { frameData } = c;
  const fid = frameData?.fid !== undefined ? frameData.fid.toString() : '';
  const {
    pfp_url: c_pfp_url,
    userName: c_userName,
    verifyedAddress,
  } = await getUserData(fid);

  if (!verifyedAddress) {
    return c.res({
      image: '/error_address.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const address = verifyedAddress as `0x${string}`;

  const quantities = await getQuantities(address);

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

  console.log(userName, pfp_url, wager, gameId, c_userName, c_pfp_url, address);

  return c.res({
    image: '/war/image/score/' + encodeURIComponent(JSON.stringify(quantities)),
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
  } = c.previousState;

  console.log('duel start');

  const inputCardNumber = inputText;

  const c_card = convertCardValue(inputCardNumber as string);
  const errorMessage = checkCardNumber(c_card, quantities);

  console.log(errorMessage);

  if (errorMessage) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: errorMessage,
        quantities: quantities,
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

  console.log(gameId, String(c_address), c_userName!, c_pfp_url!);
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

warApp.hono.get('/image/loading/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, wager, c_userName, c_pfp_url } = params;

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
  return c.newResponse(finalImage, 200, { 'Content-Type': 'image/png' });
});

warApp.hono.get('/image/result/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));

  console.log(params);

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
  console.log('genereate result');
  console.log({
    userName,
    pfp_url,
    card,
    wager,
    c_userName,
    c_pfp_url,
    c_card,
    isWin,
  });

  const backgroundImageBuffer = await generateDuelImage(
    userName,
    pfp_url,
    wager,
    c_userName,
    c_pfp_url,
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

  return c.newResponse(finalImage, 200, { 'Content-Type': 'image/png' });
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

  console.log('get db');

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

  console.log(
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
  );

  console.log(c_card);
  console.log(c_card);
  console.log(c_card);
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
