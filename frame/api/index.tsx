import { Button, Frog } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { drawApp } from './draw.js';
import { warApp } from './war.js';
import { teaserApp } from './teaser.js';
import { serve } from '@hono/node-server';
import { stackApp } from './stack.js';

export const app = new Frog({
  assetsPath: '/',
  basePath: '/',
});

app.use('/*', serveStatic({ root: './public' }));

const title = 'House of Cardians';

app.frame('/', (c) => {
  // 一時的にproductionでは画像を表示しない

  if (process.env.NODE_ENV === 'production') {
    return c.res({
      image: '',
    });
  }

  return c.res({
    title,
    image: '/images/top.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/draw">Draw🃏</Button>,
      <Button action="/war">Battle⚔️</Button>,
      <Button action="/stack">Stack🗼</Button>,
      <Button action="/sub">Next ＞</Button>,
    ],
  });
});

app.frame('/sub', (c) => {
  return c.res({
    title,
    image: '/images/sub.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="https://invitation.thecard.fun/api">Invite📨</Button>,
      <Button.Link href="https://google.com">Rules📖</Button.Link>,
      <Button action="/">＜ Back</Button>,
    ],
  });
});

app.route('/teaser', teaserApp);
app.route('/draw', drawApp);
app.route('/war', warApp);
app.route('/stack', stackApp);

if (process.env.NODE_ENV !== 'production') {
  devtools(app, { serveStatic });
}

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 5173 });

console.log(`Server started: ${new Date()} `);
