// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IWar {
    enum GameStatus {
        NotExist,
        Created,
        Challenged,
        Revealed,
        Expired
    }

    enum PlayerSide {
        Maker,
        Challenger
    }

    struct Game {
        address maker;
        address challenger;
        address winner;
        uint256 makerCard;
        uint256 challengerCard;
        bytes dealerSignature;
        uint64 createdAt;
    }

    event GameMade(
        bytes8 indexed gameId,
        address indexed maker,
        bytes signature
    );

    event GameChallenged(bytes8 indexed gameId, address indexed challenger);

    event GameRevealed(
        bytes8 indexed gameId,
        address indexed maker,
        address indexed challenger,
        address winner
    );

    event GameRequested(
        bytes8 indexed gameId,
        address indexed maker,
        address indexed challenger
    );

    event GameExpired(bytes8 indexed gameId, address indexed maker);

    event SetDealer(address indexed dealer);

    event SetWarPool(address indexed warPool);

    event SetCard(address indexed card);

    event SetInvitation(address indexed invitation);
}
