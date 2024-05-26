// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IWar {
    event GameCreated(address indexed maker, bytes8 indexed gameId);

    event GameChallenged(address indexed challenger, bytes8 indexed gameId);
}
