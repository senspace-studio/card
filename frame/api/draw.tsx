import { Button, Frog, TextInput } from 'frog';
import { GASHA_ABI } from '../constant/abi.js';
import {
  BASE_URL,
  GASHA_CONTRACT_ADDRESS,
  GASHA_UNIT_PRICE,
} from '../constant/config.js';
import { decodeEventLog, formatEther, parseEther } from 'viem';
import tweClient from '../lib/thirdweb-engine/index.js';
import {
  cardContract,
  checkInvitation,
  gashaContract,
  publicClient,
} from '../lib/contract.js';
import sharp from 'sharp';
import JSON from 'json-bigint';
import { getFarcasterUserInfo } from '../lib/neynar.js';
import { getBalance } from 'viem/actions';

type State = {
  ids: number[];
  quantities: number[];
  transactionId: string;
  hasInvitation: boolean;
  verifiedAddresses: `0x${string}`[];
};

const MINIMUM_NATIVE_TOKEN = 100;

const shareUrlBase = 'https://warpcast.com/~/compose?text=';
const embedParam = '&embeds[]=';

const title = 'Draw | House of Cardians';

export const drawApp = new Frog<{ State: State }>({
  initialState: {
    ids: [],
    quantities: [],
    transactionId: '',
    hasInvitation: false,
    verifiedAddresses: [],
  },
});

drawApp.frame('/', async (c) => {
  if (c.frameData?.fid) {
    const { verifiedAddresses } = await getFarcasterUserInfo(c.frameData?.fid);

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
    image: '/images/draw/top.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/input">Start</Button>,
      // <Button action={`${BASE_URL}`}>Home</Button>,
      <Button action="/mycards">My Cards</Button>,
    ],
  });
});

drawApp.frame('/input', async (c) => {
  const numOfMint = Number(c.inputText);

  const verifiedAddresses =
    c.previousState.verifiedAddresses ||
    (await getFarcasterUserInfo(c.frameData?.fid)).verifiedAddresses;

  if (!verifiedAddresses || verifiedAddresses.length === 0) {
    return c.res({
      title,
      image: '/images/verify.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const hasInvitation =
    c.previousState.hasInvitation ||
    (await checkInvitation(verifiedAddresses[0]));

  if (!hasInvitation) {
    return c.res({
      title,
      image: '/images/war/no_invi.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const amountOfDegen = formatEther(
    await getBalance(publicClient, {
      address: verifiedAddresses[0],
    }),
  );

  if (Number(amountOfDegen) < MINIMUM_NATIVE_TOKEN) {
    return c.res({
      title,
      image: '/images/draw/bridge.png',
      imageAspectRatio: '1:1',
      intents: [
        <Button.Link href="https://bridge.degen.tips">Bridge</Button.Link>,
        <Button action="/">Back</Button>,
      ],
    });
  }

  return c.res({
    title,
    image: '/images/draw/mint.png',
    imageAspectRatio: '1:1',
    action: '/score',
    intents: [
      typeof numOfMint == 'number' &&
      numOfMint > 0 &&
      numOfMint < 1000 ? null : (
        <TextInput placeholder="Number of cards to draw" />
      ),
      <Button.Transaction target="/transaction/1">1 card</Button.Transaction>,
      <Button.Transaction target="/transaction/5">5 cards</Button.Transaction>,
      <Button.Transaction target="/transaction/10">
        10 cards
      </Button.Transaction>,
      typeof numOfMint == 'number' && numOfMint > 0 && numOfMint < 1000 ? (
        <Button.Transaction target={`/transaction/${numOfMint}`}>
          {`${numOfMint}`} cards
        </Button.Transaction>
      ) : (
        <Button action="/input">Custom</Button>
      ),
    ],
  });
});

drawApp.frame('/score', async (c) => {
  const transactionId = c.transactionId || c.previousState.transactionId;

  while (true) {
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

    const spinEvent = receipt?.result?.logs
      ?.map((log: any) => {
        try {
          return decodeEventLog({
            abi: GASHA_ABI,
            data: log.data,
            topics: log.topics,
          });
        } catch (error) {
          return;
        }
      })
      .find((l) => l?.eventName === 'Spin') as any;

    if (spinEvent) {
      const ids = spinEvent.args.ids.map((id: BigInt) => Number(id));
      const quantities = spinEvent.args.quantities.map((quantity: BigInt) =>
        Number(quantity),
      );
      c.deriveState((prevState) => {
        prevState.ids = ids;
        prevState.quantities = quantities;
        prevState.transactionId = transactionId;
      });

      const shareLink = `${shareUrlBase}My hand is stacked! Draw your cards from the frame.%0AFollow /card and @cardgamemaster for more info.${embedParam}${BASE_URL}/draw/score/${transactionId}`;

      return c.res({
        title,
        image:
          '/draw/image/score/' +
          encodeURIComponent(JSON.stringify(spinEvent.args)),
        imageAspectRatio: '1:1',
        intents: [
          <Button action="/score">-</Button>,
          <Button action={`/card/${getNextCard(ids, quantities, 15)}`}>
            Next ＞
          </Button>,
          <Button action={`/input`}>Draw Again</Button>,
          // <Button action={`${BASE_URL}/war`}>War ⚔</Button>,
          <Button.Link href={shareLink}>Share</Button.Link>,
        ],
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
});

drawApp.frame('/card/:id', (c) => {
  const { ids, quantities } = c.previousState;
  const id = Number(c.req.param('id'));

  if (ids.length === 0 || quantities.length === 0) {
    return c.res({
      title,
      image: `/images/draw/${c.req.param('id')}.png`,
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Draw My Cards</Button>],
    });
  }

  const prevCard = getPrevCard(ids, quantities, id);
  const nextCard = getNextCard(ids, quantities, id);

  const shareCard = id === 14 ? 'Joker' : id;
  const shareLink = `${shareUrlBase}I got a ${shareCard}! Draw your cards from the frame.%0AFollow /card and @cardgamemaster for more info. ${embedParam}${BASE_URL}/draw/card/${id}`;

  return c.res({
    title,
    image: `/images/draw/${c.req.param('id')}.png`,
    imageAspectRatio: '1:1',
    intents: [
      prevCard ? (
        <Button action={`/card/${prevCard}`}>{`＜ Back`}</Button>
      ) : (
        <Button action="/score">{`＜ Back`}</Button>
      ),
      nextCard && <Button action={`/card/${nextCard}`}>{`Next ＞`}</Button>,
      <Button action={`/input`}>Draw Again</Button>,
      <Button.Link href={shareLink}>Share</Button.Link>,
      // <Button action={`${BASE_URL}/war`}>Battle ⚔</Button>,
    ],
  });
});

drawApp.frame('/score/:transactionId', async (c) => {
  const transactionId = c.req.param('transactionId');

  while (true) {
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

    const spinEvent = receipt?.result?.logs
      ?.map((log: any) => {
        try {
          return decodeEventLog({
            abi: GASHA_ABI,
            data: log.data,
            topics: log.topics,
          });
        } catch (error) {
          return;
        }
      })
      .find((l) => l?.eventName === 'Spin') as any;

    if (spinEvent) {
      const ids = spinEvent.args.ids.map((id: BigInt) => Number(id));
      const quantities = spinEvent.args.quantities.map((quantity: BigInt) =>
        Number(quantity),
      );
      c.deriveState((prevState) => {
        prevState.ids = ids;
        prevState.quantities = quantities;
        prevState.transactionId = transactionId;
      });

      return c.res({
        title,
        image:
          '/draw/image/score/' +
          encodeURIComponent(JSON.stringify(spinEvent.args)),
        imageAspectRatio: '1:1',
        intents: [<Button action="/">Draw My Cards</Button>],
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
});

drawApp.frame('/mycards', async (c) => {
  const verifiedAddresses =
    c.previousState.verifiedAddresses ||
    (await getFarcasterUserInfo(c.frameData?.fid)).verifiedAddresses;

  if (!verifiedAddresses || verifiedAddresses.length === 0) {
    return c.res({
      image: '/images/verify.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const hasInvitation =
    c.previousState.hasInvitation ||
    (await checkInvitation(verifiedAddresses[0]));

  if (!hasInvitation) {
    return c.res({
      title,
      image: '/images/war/no_invi.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const quantities = await getQuantities(verifiedAddresses[0]);

  return c.res({
    title,
    image:
      '/war/image/score/' +
      encodeURIComponent(
        JSON.stringify({ quantities, address: verifiedAddresses[0] }),
      ),
    imageAspectRatio: '1:1',
    intents: [<Button action="/">Back</Button>],
  });
});

const getPrevCard = (
  ids: number[],
  quantities: number[],
  currentId: number,
) => {
  const prevId = ids
    .filter((id, i) => id > currentId && quantities[i] > 0)
    .sort((a, b) => a - b)[0];

  return prevId;
};

const getNextCard = (
  ids: number[],
  quantities: number[],
  currentId: number,
) => {
  const nextId = ids
    .filter((id, i) => id < currentId && quantities[i] > 0)
    .sort((a, b) => b - a)[0];

  return nextId;
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

drawApp.transaction('/transaction/:numOfMint', async (c) => {
  const numOfMint = Number(c.req.param('numOfMint'));
  const requiredDegen = parseEther(String(numOfMint * GASHA_UNIT_PRICE));

  const estimatedGas = await gashaContract.estimateGas.spin(
    [BigInt(numOfMint)],
    {
      value: BigInt(requiredDegen),
      account: '0xa3F7125A348161517e8a92a64dB1B62C5cda3f0a',
    },
  );

  return c.contract({
    chainId: 'eip155:666666666',
    to: GASHA_CONTRACT_ADDRESS,
    abi: GASHA_ABI,
    functionName: 'spin',
    args: [BigInt(numOfMint)],
    value: BigInt(requiredDegen),
    gas: BigInt(Math.ceil(Number(estimatedGas) * 1.3)),
  });
});

drawApp.hono.get('/image/score/:event', async (c) => {
  const event = JSON.parse(decodeURIComponent(c.req.param('event')));

  const baseImage = sharp('./public/images/war/pick_card.png').resize(
    1000,
    1000,
  );

  const cardWidth = 144;
  const cardHeight = 211;
  const px = 19;
  const py = 21;
  const cols = 5;

  const composites = event.quantities
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

  const addressImage = await sharp({
    text: {
      text: `<span foreground="white" letter_spacing="1000">${
        event.minter.slice(0, 6) + '...' + event.minter.slice(-4)
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

  return c.newResponse(finalImage, 200, { 'Content-Type': 'image/png' });
});
