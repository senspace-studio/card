import { expect } from "chai"
import { Gasha, GashaItem, Hat } from "../typechain-types"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { ContractTransactionResponse, parseEther } from "ethers"
import { deployGashaContract, deployGashaItemContract } from "./helper"
import { deployHatContract } from "../scripts/helper/hat"

describe("Gasha", () => {
  let Gasha: Gasha
  let GashaItem: GashaItem
  let Hat: Hat
  let admin: SignerWithAddress
  let user: SignerWithAddress
  let operator: SignerWithAddress

  before(async () => {
    ;[admin, user, operator] = await ethers.getSigners()

    GashaItem = await deployGashaItemContract(admin.address)

    Hat = await deployHatContract(admin.address)

    Gasha = await deployGashaContract(
      admin.address,
      await GashaItem.getAddress(),
      await Hat.getAddress(),
      0.000777
    )

    for (const tokenId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
      let tx = await GashaItem.setupNewToken(`${tokenId}.json`)
      await tx.wait()
    }

    let tx = await GashaItem.setMinter(await Gasha.getAddress(), true)
    await tx.wait()
    tx = await GashaItem.setBaseURI("https://zora.co/")

    tx = await Hat.setForwarder(await Gasha.getAddress(), true)
    await tx.wait()

    tx = await Gasha.setOperator(operator.address, true)
    await tx.wait()
  })

  it("should add series item", async () => {
    for (let index = 0; index < 14; index++) {
      let tx!: ContractTransactionResponse
      switch (true) {
        case index < 10:
          tx = await Gasha.setNewSeriesItem(index + 1, 0, 87)
          await tx.wait()
          break
        case index < 13:
          tx = await Gasha.setNewSeriesItem(index + 1, 1, 40)
          await tx.wait()
          break
        case index == 13:
          tx = await Gasha.setNewSeriesItem(index + 1, 2, 10)
          await tx.wait()
          break
      }
      tx = await Gasha.activateSeriesItem(index + 1)
      await tx.wait()
    }

    const seriesItem = await Gasha.series(0)
    expect(seriesItem.tokenId).to.equal(1)
    expect(seriesItem.rareness).to.equal(0)
    expect(seriesItem.weight).to.equal(87)
  })

  it("should revert when not available time", async () => {
    await expect(
      Gasha.setAvailableTime(0, Math.ceil(new Date().getTime() / 1000) - 1e6)
    ).emit(Gasha, "SetAvailableTime")
    await expect(
      Gasha.connect(operator).spin(1, admin.address, {
        value: parseEther("0.000777"),
      })
    ).to.be.revertedWith("Gasha: not available now")
  })

  it("should set available time", async () => {
    await expect(Gasha.setAvailableTime(0, 1893456000)).emit(
      Gasha,
      "SetAvailableTime"
    )
  })

  it("shoud spin", async () => {
    let amount = 10
    await expect(
      Gasha.connect(operator).spin(amount, admin.address, {
        value: parseEther(String(0.000777 * amount)),
      })
    ).emit(Gasha, "Spin")

    amount = 10
    await expect(
      Gasha.connect(operator).spin(amount, user.address, {
        value: parseEther(String(0.000777 * amount)),
      })
    ).emit(Gasha, "Spin")
  })

  it("should fail to spin when not enough ether", async () => {
    await expect(
      Gasha.connect(operator).spin(1, admin.address, {
        value: parseEther("0.000776"),
      })
    ).to.be.revertedWith("Gasha: insufficient funds")
  })

  it("should fail to spin when not operator", async () => {
    await expect(
      Gasha.spin(1, admin.address, { value: parseEther("0.000777") })
    ).to.be.revertedWith("Gasha: caller is not the operator")
  })

  it("should get active items", async () => {
    const activeItems = await Gasha.activeSeriesItems()
    expect(activeItems.length).to.equal(14)
    expect(activeItems[0].tokenId).to.equal(1)
    expect(activeItems[0].rareness).to.equal(0)
    expect(activeItems[0].weight).to.equal(87)
  })

  it("should deactivate series item", async () => {
    await Gasha.deactivateSeriesItem(1)
    const activeItems = await Gasha.activeSeriesItems()
    expect(activeItems.length).to.equal(13)
    expect(activeItems[0].tokenId).to.equal(2)
    expect(activeItems[0].rareness).to.equal(0)
    expect(activeItems[0].weight).to.equal(87)
  })

  it("should activate series item", async () => {
    await Gasha.activateSeriesItem(1)
    const activeItems = await Gasha.activeSeriesItems()
    expect(activeItems.length).to.equal(14)
    expect(activeItems[0].tokenId).to.equal(1)
    expect(activeItems[0].rareness).to.equal(0)
    expect(activeItems[0].weight).to.equal(87)
  })

  it("should drop by owner", async () => {
    await Gasha.dropByOwner(user, [1], [1], {
      value: parseEther("0.000777"),
    })
  })

  it("check token uri", async () => {
    const uri = await GashaItem.uri(1)
    console.log(uri)
  })
})
