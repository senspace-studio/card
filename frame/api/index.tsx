import { Button, Frog } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { handle } from 'frog/vercel';
import { drawApp } from './draw.js';
import { warApp } from './war.js';
import { teaserApp } from './teaser.js';

export const app = new Frog({
  assetsPath: '/',
  basePath: '/',
});

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

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined';
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development';
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
