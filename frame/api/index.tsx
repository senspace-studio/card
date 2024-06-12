import { Frog } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { drawApp } from './draw.js';
import { warApp } from './war.js';
import { teaserApp } from './teaser.js';
import { serve } from '@hono/node-server';

export const app = new Frog({
  assetsPath: '/',
  basePath: '/',
});

app.use('/*', serveStatic({ root: './public' }));

app.frame('/', (c) => {
  // 一時的に画像を表示しない
  return c.res({
    image: '',
  });
  // return c.res({
  //   image: '/images/top.png',
  //   imageAspectRatio: '1:1',
  //   intents: [
  //     <Button action="/draw">Draw</Button>,
  //     <Button value="/war">Battle</Button>,
  //     <Button value="/stack">Stack</Button>,
  //     <Button.Link href="https://google.com">Rule</Button.Link>,
  //   ],
  // });
});

app.route('/teaser', teaserApp);
app.route('/draw', drawApp);
app.route('/war', warApp);

if (process.env.NODE_ENV !== 'production') {
  devtools(app, { serveStatic });
}

serve({ fetch: app.fetch, port: 3000 });
