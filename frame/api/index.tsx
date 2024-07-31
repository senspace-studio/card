import { Button, Frog } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { drawApp } from './draw.js';
import { warApp } from './war.js';
import { teaserApp } from './teaser.js';
import { serve } from '@hono/node-server';
import { stackApp } from './stack.js';
import { BACKEND_URL, IS_MAINTENANCE } from '../constant/config.js';
import sharp from 'sharp';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { warTournamentApp } from './war-tournament.js';

dayjs.extend(utc);

export const app = new Frog({
  assetsPath: '/',
  basePath: '/',
});

app.use('/*', serveStatic({ root: './public' }));

const title = 'House of Cardians';

app.frame('/', (c) => {
  return c.res({
    title,
    image: '/images/title.png',
    imageAspectRatio: '1:1',
    intents: [<Button action="/top">Enter</Button>],
  });
});

app.frame('/top', (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  return c.res({
    title,
    image: '/image/top',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/war/select-game-mode">Make Game</Button>,
      <Button action="/war/challenge/select-game-mode">Challenge</Button>,
      <Button action="/stack">Rewards</Button>,
      <Button action="/menu">Menu</Button>,
    ],
  });
});

app.frame('/menu', (c) => {
  if (IS_MAINTENANCE)
    return c.error({ message: 'Under maintenance, please try again later.' });

  return c.res({
    title,
    image: '/images/menu-20240724.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/draw">Draw🃏</Button>,
      <Button action="/war">Battle⚔️</Button>,
      <Button action="/tools">Tools⛏</Button>,
      <Button action="/top">Back</Button>,
    ],
  });
});

app.frame('/tools', (c) => {
  return c.res({
    title,
    image: '/images/war/tools.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button.AddCastAction action="https://card-scouter.vercel.app/api/card-scouter">
        Scouter
      </Button.AddCastAction>,
      <Button.AddCastAction action="/war/vs-match">
        Let's Play
      </Button.AddCastAction>,
      <Button action="/menu">Back</Button>,
    ],
  });
});

app.hono.get('/image/top', async (c) => {
  const container = sharp('./public/images/top.png');
  const response = await fetch(`${BACKEND_URL}/points/realtime-total-rewards`);
  const { totalRewardsAmount } = await response.json();
  const totalRewardsAmountStr = totalRewardsAmount.toLocaleString();

  const date = dayjs().utc();
  const dateStr =
    date.get('hours') >= 3
      ? date.format('M/D/YYYY')
      : date.subtract(1, 'day').format('M/D/YYYY');

  const [dateImage, rewardsImage, unitLabelImage, notEnoughDataImage] =
    await Promise.all([
      sharp({
        text: {
          text: `<span foreground="#fff" letter_spacing="1000">${dateStr}</span>`,
          font: 'OpenSans',
          fontfile: './public/fonts/OpenSans-Regular.ttf',
          rgba: true,
          width: 200,
          height: 16,
          align: 'left',
        },
      })
        .png()
        .toBuffer(),
      sharp({
        text: {
          text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">${totalRewardsAmountStr}</span>`,
          font: 'OpenSans',
          fontfile: './public/fonts/OpenSans-Regular.ttf',
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
          text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">DEGEN</span>`,
          font: 'OpenSans',
          fontfile: './public/fonts/OpenSans-Regular.ttf',
          rgba: true,
          width: 550,
          height: 25,
          align: 'left',
        },
      })
        .png()
        .toBuffer(),
      sharp({
        text: {
          text: `<span foreground="#fff" font_weight="bold" letter_spacing="1000">Not Enough Data</span>`,
          font: 'OpenSans',
          fontfile: './public/fonts/OpenSans-Regular.ttf',
          rgba: true,
          width: 550,
          height: 30,
          align: 'left',
        },
      })
        .png()
        .toBuffer(),
    ]);

  container.composite(
    totalRewardsAmount > 1000
      ? [
          {
            input: dateImage,
            left: 290,
            top: 870,
          },
          {
            input: rewardsImage,
            left: 500 - totalRewardsAmountStr.length * 10,
            top: 862,
          },
          {
            input: unitLabelImage,
            left: 610,
            top: 865,
          },
        ]
      : [
          {
            input: dateImage,
            left: 290,
            top: 870,
          },
          {
            input: notEnoughDataImage,
            left: 460,
            top: 865,
          },
        ],
  );

  const png = await container.png().toBuffer();

  return c.newResponse(png, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'max-age=300',
  });
});

app.route('/teaser', teaserApp);
app.route('/draw', drawApp);
app.route('/war', warApp);
app.route('/war-tournament', warTournamentApp);
app.route('/stack', stackApp);

if (process.env.NODE_ENV !== 'production') {
  devtools(app, { serveStatic });
}

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 5173 });

console.log(`Server started: ${new Date()} `);
