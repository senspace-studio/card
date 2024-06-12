import { NEYNAR_API_KEY } from '../constant/config.js';

export const getFarcasterUserInfo = async (fid?: number) => {
  const userInfo = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}&viewer_fid=3`,
    {
      method: 'GET',
      headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
    },
  );
  const userData = await userInfo.json();
  const pfp_url = userData.users[0].pfp_url;
  const userName = userData.users[0].username;
  const verifiedAddresses = userData.users[0].verified_addresses.eth_addresses;

  return { pfp_url, userName, verifiedAddresses };
};