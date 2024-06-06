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
}
