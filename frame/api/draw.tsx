import { Button, Frog, parseEther, TextInput } from 'frog';
import { GASHA_ABI } from '../constant/abi.js';
import {
  BASE_URL,
  GASHA_CONTRACT_ADDRESS,
  GASHA_UNIT_PRICE,
} from '../constant/config.js';
import { decodeEventLog, formatEther } from 'viem';
import tweClient from '../lib/thirdweb-engine/index.js';
import { gashaContract, publicClient } from '../lib/contract.js';
import sharp from 'sharp';
import JSON from 'json-bigint';
import { getFarcasterUserInfo } from '../lib/neynar.js';
import { getBalance } from 'viem/actions';

type State = {
  ids: number[];
  quantities: number[];
  transactionId: string;
};

const MINIMUM_NATIVE_TOKEN = 0;

export const drawApp = new Frog<{ State: State }>({
  initialState: {
    ids: [],
    quantities: [],
    transactionId: '',
  },
});

drawApp.frame('/', (c) => {
  return c.res({
    image: '/images/draw/top.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/input">Start</Button>,
      <Button action={`${BASE_URL}`}>Home</Button>,
      <Button action="/mycards">My Cards</Button>,
    ],
  });
});

drawApp.frame('/input', async (c) => {
  const numOfMint = Number(c.inputText);

  const { verifyedAddresses } = await getFarcasterUserInfo(c.frameData?.fid);
  const amountOfDegen = formatEther(
    await getBalance(publicClient, {
      address: verifyedAddresses[0],
    }),
  );

  if (Number(amountOfDegen) < MINIMUM_NATIVE_TOKEN) {
    return c.res({
      image: '/images/draw/bridge.png',
      imageAspectRatio: '1:1',
      intents: [
        <Button.Link href="https://bridge.degen.tips">Bridge</Button.Link>,
        <Button action="/">Back</Button>,
      ],
    });
  }

  return c.res({
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
      .find((l) => l?.eventName === 'Spin');

    if (spinEvent) {
      const ids = spinEvent.args.ids.map((id) => Number(id));
      const quantities = spinEvent.args.quantities.map((quantity) =>
        Number(quantity),
      );
      c.deriveState((prevState) => {
        prevState.ids = ids;
        prevState.quantities = quantities;
        prevState.transactionId = transactionId;
      });

      return c.res({
        image:
          '/draw/image/score/' +
          encodeURIComponent(JSON.stringify(spinEvent.args)),
        imageAspectRatio: '1:1',
        intents: [
          <Button action="/score">-</Button>,
          <Button action={`/card/${getNextCard(ids, quantities, 15)}`}>
            Next
          </Button>,
          <Button action={`/input`}>Draw Again</Button>,
          <Button action={`${BASE_URL}/war`}>War ⚔</Button>,
        ],
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
});

drawApp.frame('/card/:id', (c) => {
  const { ids, quantities } = c.previousState;

  const prevCard = getPrevCard(ids, quantities, Number(c.req.param('id')));
  const nextCard = getNextCard(ids, quantities, Number(c.req.param('id')));

  return c.res({
    image: `/images/draw/${c.req.param('id')}.png`,
    imageAspectRatio: '1:1',
    intents: [
      prevCard ? (
        <Button action={`/card/${prevCard}`}>{`＜ Back`}</Button>
      ) : (
        <Button action="/score">{`＜ Back`}</Button>
      ),
      nextCard ? (
        <Button action={`/card/${nextCard}`}>{`Next ＞`}</Button>
      ) : (
        <Button action={`/`}>Home 🏠</Button>
      ),
      <Button action={`/input`}>Draw Again</Button>,
      <Button action={`${BASE_URL}/war`}>Battle ⚔</Button>,
    ],
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

drawApp.transaction('/transaction/:numOfMint', async (c) => {
  const numOfMint = Number(c.req.param('numOfMint'));
  const requiredDegen = numOfMint * GASHA_UNIT_PRICE;

  const estimatedGas = await gashaContract.estimateGas.spin(
    [BigInt(numOfMint)],
    {
      value: parseEther(requiredDegen.toString()),
      account: '0x807C69F16456F92ab2bFc9De8f14AF31051f9678',
    },
  );

  return c.contract({
    chainId: 'eip155:666666666',
    to: GASHA_CONTRACT_ADDRESS,
    abi: GASHA_ABI,
    functionName: 'spin',
    args: [BigInt(numOfMint)],
    value: parseEther(requiredDegen.toString()),
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

  return c.newResponse(finalImage, 200);
});
