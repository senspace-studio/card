import { ethers } from 'hardhat'

const main = async () => {
  const zoraCreateERC1155 = await ethers.getContractAt(
    'ZoraCreator1155Impl',
    '0x3B02fF1e626Ed7a8fd6eC5299e2C54e1421B626B'
  )

  const totalSupply = await zoraCreateERC1155.balanceOf(
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    1
  )
  console.log(totalSupply.toString())
}

main()
