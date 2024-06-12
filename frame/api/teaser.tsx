import { Button, Frog } from 'frog';
import { getFarcasterUserInfo } from '../lib/neynar.js';
import tweClient from '../lib/thirdweb-engine/index.js';
import { INVITATION_NFT_CONTRACT_ADDRESS } from '../constant/config.js';

export const teaserApp = new Frog({
  assetsPath: '/',
  basePath: '/',
});

teaserApp.frame('/', (c) => {
  return c.res({
    image: '/images/teaser/title.png',
    imageAspectRatio: '1:1',
    intents: [<Button action="/invitation">Enter</Button>],
  });
});

teaserApp.frame('/invitation', async (c) => {
  const { verifiedAddresses } = await getFarcasterUserInfo(c.frameData?.fid);
  const address = verifiedAddresses[0];

  if (!address) {
    return c.res({
      image: '/images/verify.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  const { data } = await tweClient.GET(
    '/contract/{chain}/{contractAddress}/read',
    {
      params: {
        path: {
          chain: 'degen-chain',
          contractAddress: INVITATION_NFT_CONTRACT_ADDRESS,
        },
        query: {
          functionName: 'balanceOf',
          args: address,
        },
      },
    },
  );

  if (Number(data?.result) === 0) {
    return c.res({
      image: '/images/teaser/no_invite.png',
      imageAspectRatio: '1:1',
      intents: [<Button action="/">Back</Button>],
    });
  }

  return c.res({
    image: '/images/teaser/invitation.png',
    imageAspectRatio: '1:1',
    intents: [<Button action="/">Back</Button>],
  });
});
