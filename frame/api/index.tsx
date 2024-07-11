import { Button, Frog } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { drawApp } from './draw.js';
import { warApp } from './war.js';
import { teaserApp } from './teaser.js';
import { serve } from '@hono/node-server';
import { stackApp } from './stack.js';
import { IS_MAINTENANCE } from '../constant/config.js';

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
    image: '/images/menu-20240711.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action="/draw">Draw🃏</Button>,
      <Button action="/war">Battle⚔️</Button>,
      <Button action="/stack">Rewards💎</Button>,
      <Button action="https://invitation.thecard.fun/api">Invite📨</Button>,
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
