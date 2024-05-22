import { formatEther } from 'ethers'
import { ethers } from 'hardhat'

const main = async () => {
  const balanceBefore = await ethers.provider.getBalance(
    '0x9a5ba9e13fe9ebbbdfd3cbeadf8b63becd039f4f',
    12501604
  )
  const balanceAfter = await ethers.provider.getBalance(
    '0x9a5ba9e13fe9ebbbdfd3cbeadf8b63becd039f4f',
    12501606
  )
  console.log('balance at 12501604: ', balanceBefore.toString())
  console.log('balance at 12501606: ', balanceAfter.toString())

  console.log(
    'balance diff: ',
    Number(formatEther(balanceBefore)) - Number(formatEther(balanceAfter))
  )
}

main()
