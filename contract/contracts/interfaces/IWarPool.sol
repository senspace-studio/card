// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IWarPool {
    enum DepositStatus {
        NotExist,
        Active,
        PayoutForWinner,
        ReturnedForExpiredGame,
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
        address winner
    ) external;
}
