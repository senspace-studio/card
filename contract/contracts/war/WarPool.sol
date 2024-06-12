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

    uint256 commissionRateTop;

    uint256 commissionRateBottom;

    uint256 rewardRateBottom;

    modifier onlyWar() {
        require(
            warAddress == msg.sender,
            'WarPool: only war contract can call this function'
        );
        _;
    }

    modifier onlyDepositedByMaker(bytes8 gameId) {
        GameDeposit memory gameDeposit = gameDeposits[gameId];
        require(
            gameDeposit.status == DepositStatus.DepositedByMaker,
            'WarPool: only DepositedByMaker'
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
        commissionRateTop = 1;
        commissionRateBottom = 100;
        rewardRateBottom = 100000;
    }

    function deposit(
        bytes8 gameId,
        address player,
        address currency,
        bool isNativeToken,
        uint256 betAmount
    ) external payable onlyWar whenNotPaused nonReentrant {
        GameDeposit storage gameDeposit = gameDeposits[gameId];

        require(
            betAmount == 0 || betAmount >= rewardRateBottom,
            'WarPool: invalid bet amount'
        );

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
        uint256 rewardRateTop,
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

        require(
            rewardRateTop <= rewardRateBottom,
            'WarPool: invalid reward rate'
        );
        uint256 winningAmount = (gameDeposit.betAmount * rewardRateTop) /
            rewardRateBottom;
        uint256 commissionAmount = _commissionAmount(winningAmount);
        uint256 rewardAmount = winningAmount -
            commissionAmount +
            gameDeposit.betAmount;
        uint256 returnAmount = gameDeposit.betAmount - winningAmount;

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

        emit PayoutForWinner(
            gameId,
            winner,
            loser,
            rewardAmount,
            returnAmount,
            commissionAmount
        );
    }

    function returnToMaker(
        bytes8 gameId
    ) external onlyWar whenNotPaused nonReentrant onlyDepositedByMaker(gameId) {
        GameDeposit storage gameDeposit = gameDeposits[gameId];

        gameDeposit.status = DepositStatus.ReturnedToMaker;

        if (gameDeposit.isNativeToken) {
            require(
                _safeTransfer(gameDeposit.maker, gameDeposit.betAmount),
                'WarPool: failed to return bet amount to maker'
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
        }

        emit ReturnToMaker(gameId);
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
                _safeTransfer(owner(), gameDeposit.betAmount * 2),
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

    function setWarAddress(address _warAddress) external onlyOwner {
        warAddress = _warAddress;
    }

    function withdraw(address currency, uint256 amount) external onlyOwner {
        if (currency == address(0)) {
            require(
                _safeTransfer(owner(), amount),
                'WarPool: failed to withdraw'
            );
        } else {
            IERC20 token = IERC20(currency);
            require(
                _safeTransferToken(token, owner(), amount),
                'WarPool: failed to withdraw'
            );
        }
    }

    function setCommission(
        uint256 _commissionRateTop,
        uint256 _commissionRateBottom
    ) external onlyOwner {
        require(
            _commissionRateTop <= _commissionRateBottom &&
                _commissionRateTop > 0 &&
                _commissionRateTop > 0,
            'WarPool: invalid commission'
        );
        commissionRateTop = _commissionRateTop;
        commissionRateBottom = _commissionRateBottom;
    }

    function setRewardRate(uint256 _rewardRateBottom) external onlyOwner {
        require(_rewardRateBottom > 0, 'WarPool: invalid reward rate');
        rewardRateBottom = _rewardRateBottom;
    }

    function _commissionAmount(uint256 amount) private view returns (uint256) {
        return (amount * commissionRateTop) / commissionRateBottom;
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

    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }
}
