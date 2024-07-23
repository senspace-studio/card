import { FrameContext, Button } from 'frog';
import { BlankInput } from 'hono/types';
import { WarState } from '../api/war.js';
import { getFarcasterUserInfo } from '../lib/neynar.js';
import { BASE_URL } from '../constant/config.js';
import { checkInvitation } from '../lib/contract.js';

export const isJokerKilling = (
  cards: number | number[],
  c_cards: number | number[],
) => {
  if (typeof cards === 'object' && typeof c_cards === 'object') {
    return (
      ((cards.includes(14) && c_cards.includes(1)) ||
        (cards.includes(1) && c_cards.includes(14))) &&
      !(
        cards.includes(14) &&
        !c_cards.includes(1) &&
        cards.includes(1) &&
        !c_cards.includes(14)
      )
    );
  } else {
    return (
      (Number(cards) === 14 && Number(c_cards) === 1) ||
      (Number(cards) === 1 && Number(c_cards) === 14)
    );
  }
};

export const initLocalState = async (
  c: FrameContext<
    {
      State: WarState;
    },
    '/',
    BlankInput
  >,
) => {
  const title = 'Battle | House of Cardians';

  if (c.frameData?.fid && !c.previousState.initialized) {
    const { verifiedAddresses, userName, pfp_url } = await getFarcasterUserInfo(
      c.frameData?.fid,
    );

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
      prevState.userName = userName;
      prevState.pfp_url = pfp_url;
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
      prevState.initialized = true;
    });
  }
};
