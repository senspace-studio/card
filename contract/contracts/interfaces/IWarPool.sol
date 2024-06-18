// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IWarPool {
    enum DepositStatus {
        NotExist,
        DepositedByMaker,
        DepositedByChallenger,
        PayoutForWinner,
        ReturnedToMaker,
        ReturnedToBoth,
        WithdrawnByAdmin
    }

    struct GameDeposit {
        address maker;
        address challenger;
        address currency;
        bool isNativeToken;
        uint256 betAmount;
        DepositStatus status;
    }

    event Deposit(
        bytes8 indexed gameId,
        address indexed player,
        DepositStatus status,
        address currency,
        bool isNativeToken,
        uint256 betAmount
    );

    event PayoutForWinner(
        bytes8 indexed gameId,
        address indexed winner,
        address indexed loser,
        uint256 rewardAmount,
        uint256 returnAmount,
        uint256 commissionAmount
    );

    event ReturnToMaker(bytes8 indexed gameId);

    event ReturnToBoth(bytes8 indexed gameId);

    event WithdrawByAdmin(bytes8 indexed gameId);

    event SetWar(address indexed war);

    event Withdraw(address indexed currency, uint256 amount);

    event SetCommission(
        uint256 commissionRateTop,
        uint256 commissionRateBottom
    );

    event SetRewardRate(uint256 rewardRateBottom);

    function gameDeposits(
        bytes8
    )
        external
        view
        returns (
            address maker,
            address challenger,
            address currency,
            bool isNativeToken,
            uint256 betAmount,
            DepositStatus status
        );

    function deposit(
        bytes8 gameId,
        address player,
        address currency,
        bool isNativeToken,
        uint256 betAmount
    ) external payable;

    function payoutForWinner(
        bytes8 gameId,
        uint256 rewardRate,
        address winner,
        address loser
    ) external;

    function returnToMaker(bytes8 gameId) external;

    function returnToBoth(bytes8 gameId) external;

    function withdrawByAdmin(bytes8 gameId) external;
}
