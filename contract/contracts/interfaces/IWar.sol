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

    event GameCreated(address indexed maker, bytes8 indexed gameId);

    event GameChallenged(address indexed challenger, bytes8 indexed gameId);

    event GameRevealed(bytes8 indexed gameId);
}
