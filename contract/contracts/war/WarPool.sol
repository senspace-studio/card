// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IWarPool.sol";

contract WarPool is IWarPool, OwnableUpgradeable, PausableUpgradeable {
    address warAddress;

    modifier onlyWar() {
        require(
            warAddress == msg.sender,
            "WarPool: only war contract can call this function"
        );
        _;
    }

    mapping(bytes8 => GameDeposit) public gameDeposits;

    function initialize(address _initialOwner) public initializer {
        __Ownable_init(_initialOwner);
        __Pausable_init();
    }

    function deposit(
        bytes8 gameId,
        address player,
        address currency,
        bool isNativeToken,
        uint256 betAmount
    ) external payable onlyWar {
        GameDeposit storage gameDeposit = gameDeposits[gameId];

        if (gameDeposit.status == DepositStatus.NotExist) {
            gameDeposits[gameId] = GameDeposit({
                maker: player,
                challenger: address(0),
                currency: currency,
                isNativeToken: isNativeToken,
                betAmount: betAmount,
                status: DepositStatus.Active
            });
        } else if (
            gameDeposit.status == DepositStatus.Active &&
            gameDeposit.challenger == address(0)
        ) {
            require(
                gameDeposit.maker != player,
                "WarPool: player should not be the maker"
            );
            gameDeposit.challenger = player;
        } else {
            revert("WarPool: invalid game status");
        }

        if (isNativeToken) {
            require(msg.value == betAmount, "WarPool: invalid bet amount");
        } else {
            IERC20 token = IERC20(currency);
            token.transferFrom(player, address(this), betAmount);
        }
    }

    function payoutForWinner(
        bytes8 gameId,
        uint256 rewardRate,
        address winner
    ) external onlyWar {
        GameDeposit storage gameDeposit = gameDeposits[gameId];
        uint256 rewardAmount = (gameDeposit.betAmount * rewardRate) / 100;

        if (!gameDeposit.isNativeToken) {
            IERC20 token = IERC20(gameDeposit.currency);
            token.transfer(winner, rewardAmount);
        } else {
            (bool success, ) = winner.call{value: rewardAmount}("");
            require(success, "WarPool: failed to send reward amount");
        }

        gameDeposit.status = DepositStatus.PayoutForWinner;
    }

    function setWarAddress(address _warAddress) external onlyOwner {
        warAddress = _warAddress;
    }
}
