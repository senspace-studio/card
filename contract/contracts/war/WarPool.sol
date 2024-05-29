// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/IWarPool.sol';

contract WarPool is
    IWarPool,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    address warAddress;

    modifier onlyWar() {
        require(
            warAddress == msg.sender,
            'WarPool: only war contract can call this function'
        );
        _;
    }

    modifier onlyDepositedByChallenger(bytes8 gameId) {
        GameDeposit memory gameDeposit = gameDeposits[gameId];
        require(
            gameDeposit.status == DepositStatus.DepositedByChallenger,
            'WarPool: only DepositedByChallenger'
        );
        _;
    }

    mapping(bytes8 => GameDeposit) public gameDeposits;

    function initialize(address _initialOwner) public initializer {
        __Ownable_init(_initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
    }

    function deposit(
        bytes8 gameId,
        address player,
        address currency,
        bool isNativeToken,
        uint256 betAmount
    ) external payable onlyWar whenNotPaused nonReentrant {
        GameDeposit storage gameDeposit = gameDeposits[gameId];

        if (gameDeposit.status == DepositStatus.NotExist) {
            gameDeposits[gameId] = GameDeposit({
                maker: player,
                challenger: address(0),
                currency: currency,
                isNativeToken: isNativeToken,
                betAmount: betAmount,
                status: DepositStatus.DepositedByMaker
            });
        } else if (
            gameDeposit.status == DepositStatus.DepositedByMaker &&
            gameDeposit.challenger == address(0)
        ) {
            require(
                gameDeposit.maker != player,
                'WarPool: player should not be the maker'
            );
            gameDeposit.challenger = player;
            gameDeposit.status = DepositStatus.DepositedByChallenger;
        } else {
            revert('WarPool: invalid game status');
        }

        if (isNativeToken) {
            require(msg.value == betAmount, 'WarPool: invalid bet amount');
        } else {
            IERC20 token = IERC20(currency);
            //slither-disable-next-line all
            token.transferFrom(player, address(this), betAmount);
        }

        emit Deposit(gameId, player, gameDeposit.status);
    }

    function payoutForWinner(
        bytes8 gameId,
        uint256 rewardRate,
        address winner,
        address loser
    )
        external
        onlyWar
        whenNotPaused
        nonReentrant
        onlyDepositedByChallenger(gameId)
    {
        GameDeposit storage gameDeposit = gameDeposits[gameId];

        gameDeposit.status = DepositStatus.PayoutForWinner;

        uint256 rewardAmount = (gameDeposit.betAmount * rewardRate) /
            100 +
            gameDeposit.betAmount;
        uint256 returnAmount = (gameDeposit.betAmount * (100 - rewardRate)) /
            100;

        if (gameDeposit.isNativeToken) {
            require(
                _safeTransfer(winner, rewardAmount),
                'WarPool: failed to send reward amount'
            );
            require(
                _safeTransfer(loser, returnAmount),
                'WarPool: failed to send return amount'
            );
        } else {
            IERC20 token = IERC20(gameDeposit.currency);
            require(
                _safeTransferToken(token, winner, rewardAmount),
                'WarPool: failed to send reward amount'
            );
            require(
                _safeTransferToken(token, loser, returnAmount),
                'WarPool: failed to send return amount'
            );
        }

        emit PayoutForWinner(gameId, winner, loser);
    }

    function returnToBoth(
        bytes8 gameId
    )
        external
        onlyWar
        whenNotPaused
        nonReentrant
        onlyDepositedByChallenger(gameId)
    {
        GameDeposit storage gameDeposit = gameDeposits[gameId];

        gameDeposit.status = DepositStatus.ReturnedToBoth;

        if (gameDeposit.isNativeToken) {
            require(
                _safeTransfer(gameDeposit.maker, gameDeposit.betAmount),
                'WarPool: failed to return bet amount to maker'
            );

            require(
                _safeTransfer(gameDeposit.challenger, gameDeposit.betAmount),
                'WarPool: failed to return bet amount to challenger'
            );
        } else {
            IERC20 token = IERC20(gameDeposit.currency);
            require(
                _safeTransferToken(
                    token,
                    gameDeposit.maker,
                    gameDeposit.betAmount
                ),
                'WarPool: failed to return bet amount to maker'
            );

            require(
                _safeTransferToken(
                    token,
                    gameDeposit.challenger,
                    gameDeposit.betAmount
                ),
                'WarPool: failed to return bet amount to challenger'
            );
        }

        emit ReturnToBoth(gameId);
    }

    function withdrawByAdmin(
        bytes8 gameId
    )
        external
        onlyWar
        whenNotPaused
        nonReentrant
        onlyDepositedByChallenger(gameId)
    {
        GameDeposit storage gameDeposit = gameDeposits[gameId];

        gameDeposit.status = DepositStatus.WithdrawnByAdmin;

        if (gameDeposit.isNativeToken) {
            require(
                _safeTransfer(owner(), gameDeposit.betAmount),
                'WarPool: failed to withdraw'
            );
        } else {
            IERC20 token = IERC20(gameDeposit.currency);
            require(
                _safeTransferToken(token, owner(), gameDeposit.betAmount * 2),
                'WarPool: failed to withdraw'
            );
        }

        emit WithdrawByAdmin(gameId);
    }

    function _safeTransfer(address to, uint256 amount) private returns (bool) {
        // slither-disable-next-line arbitrary-send-eth
        (bool success, ) = to.call{value: amount}('');

        return success;
    }

    function _safeTransferToken(
        IERC20 token,
        address to,
        uint256 amount
    ) private returns (bool) {
        return token.transfer(to, amount);
    }

    function setWarAddress(address _warAddress) external onlyOwner {
        warAddress = _warAddress;
    }
}
