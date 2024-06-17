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

app.frame('/', (c) => {
  // 一時的にproductionでは画像を表示しない

  if (process.env.NODE_ENV === 'production') {
    return c.res({
      image: '',
    });
  }

  return c.res({
    image: '/images/top.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/draw">Draw</Button>,
      <Button action="/war">Battle</Button>,
      <Button action="/stack">Stack</Button>,
      <Button.Link href="https://google.com">Rule</Button.Link>,
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
