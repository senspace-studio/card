import { NEYNAR_API_KEY } from '../constant/config.js';

export const getFarcasterUserInfo = async (fid?: number) => {
  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}&viewer_fid=3`,
    {
      method: 'GET',
      headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
    },
  );
  const { users } = await response.json();
  const { pfp_url, username: userName, verified_addresses } = users[0];
  const verifiedAddresses = verified_addresses.eth_addresses;
  return { pfp_url, userName, verifiedAddresses };
};

export const getFarcasterUserInfoByAddress = async (address: `0x${string}`) => {
  const userInfo = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}&viewer_fid=3`,
    {
      method: 'GET',
      headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
    },
  );

  const userData = await userInfo.json();
  const addressLowerCase = address.toLowerCase();
  const pfp_url = userData[addressLowerCase]?.[0].pfp_url || '';
  const userName = userData[addressLowerCase]?.[0].username || '???';
  const verifiedAddresses =
    userData[addressLowerCase]?.[0].verified_addresses.eth_addresses || [];

  return { pfp_url, userName, verifiedAddresses };
};

export const getFarcasterUserInfoByCastHash = async (castHash: string) => {
  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/cast?type=hash&identifier=${castHash}`,

    {
      method: 'GET',
      headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
    },
  );

  const { cast } = await response.json();

  const { pfp_url, username: userName, verified_addresses } = cast.author;
  const verifiedAddresses = verified_addresses.eth_addresses;

  return { pfp_url, userName, verifiedAddresses };
};
