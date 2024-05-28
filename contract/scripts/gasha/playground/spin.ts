import { parseEther } from 'ethers';
import { ethers } from 'hardhat';

const main = async () => {
  const [wallet] = await ethers.getSigners();

  const GashaContract = await ethers.getContractAt(
    'Gasha',
    '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
  );

  for (let i = 0; i < 20; i++) {
    // predict the gas limit
    const txData = GashaContract.interface.encodeFunctionData('spin', [100]);
    const gas = await wallet.estimateGas({
      to: await GashaContract.getAddress(),
      data: txData,
    });

    await GashaContract.spin(10, {
      gasLimit: BigInt(Math.ceil(Number(gas) * 1.5)),
    });
    console.log('estimated gas:', gas.toString());
  }
};

main();
