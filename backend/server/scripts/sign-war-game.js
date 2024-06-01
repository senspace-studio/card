const { JsonRpcProvider, Wallet, getBytes, keccak256 } = require('ethers');
const { encodePacked } = require('viem');

const provider = new JsonRpcProvider(
  'https://nitrorpc-degen-mainnet-1.t.conduit.xyz',
);
const dealar = new Wallet(process.env.DEALER_PRIVATE_KEY, provider);

const main = async (tokenId, seed) => {
  const messageHash = keccak256(
    encodePacked(['uint256', 'uint256'], [tokenId, seed]),
  );
  const signature = await dealar.signMessage(getBytes(messageHash));
  console.log(signature);
};
main(3n, 0n);
