import { Button, Frog, TextInput, parseEther } from 'frog';
import {
  CARD_CONTRACT_ADDRESS,
  NEYNAR_API_KEY,
  WAR_CONTRACT_ADDRESS,
} from '../constant/config.js';
import tweClient from '../lib/thirdweb-engine/index.js';
import { convertCardValue } from '../lib/convertCardValue.js';
import { cardContract, warContract } from '../lib/contract.js';

import sharp from 'sharp';
import JSON from 'json-bigint';
import { CARD_ABI, WAR_ABI } from '../constant/abi.js';
import { zeroAddress, encodePacked, keccak256, decodeEventLog } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { getFarcasterUserInfo } from '../lib/neynar.js';

const shareUrlBase = 'https://warpcast.com/~/compose?text=';
const embedParam = '&embeds[]=';
const shareText = encodeURIComponent('To challenge?');

type State = {
  ids: number[];
  quantities: number[];
  address: `0x${string}`;
  pfp_url: string;
  userName: string;
  card: number;
  wager: number;
};

export const warApp = new Frog<{ State: State }>({
  initialState: {
    ids: [],
    quantities: [],
    address: '',
    pfp_url: '',
    userName: '',
    card: 0,
    wager: 0,
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
      <Button action="/rule">Rule</Button>,
    ],
  });
});

warApp.frame('/make-duel', async (c) => {
  console.time('make-duel');
  const { frameData } = c;

  const { pfp_url, userName, verifiedAddresses } = await getFarcasterUserInfo(
    frameData?.fid,
  );

  if (!verifiedAddresses) {
    return c.res({
      image: '/error_address.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  // const address = verifyedAddresses[0] as `0x${string}`;
  const address = '0xEb9981D68572B0553B98E5AECb920b6a7843733e';

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

  const event = {
    eventName: 'Spin',
    args: {
      minter: address,
      ids: allCardIds,
      quantities: data,
    },
  };

  const ids = event.args.ids.map((id) => Number(id));
  const quantities = event.args.quantities.map((quantity) => Number(quantity));
  c.deriveState((prevState) => {
    prevState.ids = ids;
    prevState.quantities = quantities;
    prevState.address = address;
    prevState.userName = userName;
    prevState.pfp_url = pfp_url;
  });

  const isApprovedForAll = await cardContract.read.isApprovedForAll([
    address,
    WAR_CONTRACT_ADDRESS,
  ]);

  console.timeEnd('make-duel');
  return c.res({
    image: '/war/image/score/' + encodeURIComponent(JSON.stringify(event.args)),
    imageAspectRatio: '1:1',
    intents: isApprovedForAll
      ? [
          <TextInput placeholder="11 or J or ..." />,
          <Button action="/bet">Set</Button>,
        ]
      : [
          <Button.Transaction target="/setApprovalForAll">
            Approve
          </Button.Transaction>,
        ],
  });
});

warApp.transaction('/setApprovalForAll', async (c) => {
  const { address } = c.previousState;
  const estimatedGas = await cardContract.estimateGas.setApprovalForAll(
    [WAR_CONTRACT_ADDRESS, true],
    {
      account: address,
    },
  );

  return c.contract({
    chainId: 'eip155:666666666',
    to: CARD_CONTRACT_ADDRESS,
    abi: CARD_ABI,
    functionName: 'setApprovalForAll',
    args: [WAR_CONTRACT_ADDRESS, true],
    gas: BigInt(Math.ceil(Number(estimatedGas) * 1.3)),
  });
});

warApp.frame('/bet', async (c) => {
  const { inputText } = c;
  const { quantities, card } = c.previousState;

  const inputCardNumber = inputText || card;

  const cardNumber = convertCardValue(inputCardNumber as string);
  if (cardNumber < 1 || 14 < cardNumber) {
    // TODO エラー時のフレーム
    return c.error({ message: 'invalid card number' });
  }

  if (quantities[cardNumber - 1] === 0) {
    const message = "You Don't have\n this card."
      .replace(/'/g, '&apos;')
      .replace('\n', '%0A');

    const params = encodeURIComponent(
      JSON.stringify({
        message: message,
        quantities: quantities,
      }),
    );

    return c.res({
      image: `/image/error/${params}`,
      imageAspectRatio: '1:1',
      intents: [
        <Button action="/make-duel">Back</Button>,
        <Button.Link href="https://google.com">go to</Button.Link>,
      ],
    });
  }

  c.deriveState((prevState) => {
    prevState.card = cardNumber;
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

  console.log(inputText, safeIsNaN(inputText));

  if (safeIsNaN(inputText)) {
    const params = encodeURIComponent(
      JSON.stringify({
        message: 'Invalid Number',
        quantities: quantities,
      }),
    );

    return c.res({
      image: `/image/error/${params}`,
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
  const { address, card, wager } = c.previousState;

  const salt = Math.floor(Math.random() * 1000000);

  const messageHash = keccak256(
    encodePacked(['uint256', 'uint256'], [BigInt(card), BigInt(salt)]),
  );

  // TODO APIとかからサインするようにする
  // const privateKey = generatePrivateKey();
  const privateKey =
    '0xfd95fb2325d5462ebe5832fb969e06ca4d66c944404b323475e60df4402e0451';

  const account = privateKeyToAccount(privateKey);
  const signature = (await account.signMessage({
    message: messageHash,
  })) as `0x${string}`;

  // currency, betAmount, isNaitiveToken, signature
  // const args = [zeroAddress, 0, true, signature];
  const args: readonly [`0x${string}`, bigint, boolean, `0x${string}`] = [
    zeroAddress,
    0n,
    true,
    signature,
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
  const { userName, pfp_url, card, wager } = c.previousState;

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
        return;
      }
    })
    .find((l) => l?.eventName === 'GameMade');

  const gameId = gameMadeEvent?.args.gameId;

  const params = JSON.stringify({
    userName,
    pfp_url,
    wager,
    gameId,
  });

  const shareLink = `${shareUrlBase}${shareText}${embedParam}${process.env.SITE_URL}${params}`;

  return c.res({
    image:
      '/war/image/find/' +
      encodeURIComponent(
        JSON.stringify({
          userName,
          pfp_url,
          wager,
        }),
      ),
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

warApp.hono.get('/image/score/:event', async (c) => {
  const event = JSON.parse(decodeURIComponent(c.req.param('event')));

  const finalImage = await generateOwnCard(event.quantities);

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

warApp.hono.get('/image/find/:params', async (c) => {
  const params = JSON.parse(decodeURIComponent(c.req.param('params')));
  const { userName, pfp_url, card, wager } = params;

  const isBet = wager > 0;
  const imageName = isBet ? 'share_toplay_bet.png' : 'share_toplay.png';

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
warApp.frame('/challenge', (c) => {
  return c.res({
    image: '/images/war/address_error.png',
    imageAspectRatio: '1:1',
    intents: [<Button action={`/`}>Back</Button>],
  });
});
