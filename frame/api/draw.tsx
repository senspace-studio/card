import { Button, Frog, parseEther, TextInput } from 'frog';
import { GASHA_ABI } from '../constant/abi.js';
import {
  BASE_URL,
  GASHA_CONTRACT_ADDRESS,
  GASHA_UNIT_PRICE,
} from '../constant/config.js';
import { decodeEventLog } from 'viem';
import tweClient from '../lib/thirdweb-engine/index.js';
import { gashaContract } from '../lib/contract.js';
import sharp from 'sharp';
import JSON from 'json-bigint';

type State = {
  ids: number[];
  quantities: number[];
  transactionId: string;
};

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
      <Button action={`${BASE_URL}/war`}>war</Button>,
    ],
  });
});

drawApp.frame('/input', (c) => {
  const numOfMint = Number(c.inputText);

  return c.res({
    image: '/images/draw/draw.png',
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
        <Button action={`/card/${prevCard}`}>Back</Button>
      ) : (
        <Button action="/score">Back</Button>
      ),
      nextCard ? (
        <Button action={`/card/${nextCard}`}>Next</Button>
      ) : (
        <Button action={`/`}>Top</Button>
      ),
      <Button action={`${BASE_URL}/war`}>War ⚔</Button>,
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

  const canvas = sharp('./public/images/draw/score.png').resize(1000, 1000);

  const white = '#FFFFFF';

  const eachQuantity = await Promise.all(
    event.quantities.map(async (quantity: number, index: number) => {
      const input = await sharp({
        text: {
          text: `<span foreground="${white}" font_weight="bold"
          >x ${quantity}</span>`,
          font: 'Bigelow Rules',
          fontfile: './public/fonts/BigelowRules-Regular.ttf',
          rgba: true,
          width: 250,
          height: 25,
        },
      })
        .png()
        .toBuffer();
      return {
        input,
        left: (index > 8 ? 113 : 158) + index * (index > 8 ? 59 : 52),
        top: 916,
      };
    }),
  );

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

  canvas.composite([
    ...eachQuantity,
    {
      input: addressImage,
      left: 700,
      top: 50,
    },
  ]);

  const png = await canvas.png().toBuffer();

  return c.newResponse(png, 200);
});
