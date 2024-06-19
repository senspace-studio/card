// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import '@openzeppelin/contracts/access/Ownable.sol';

contract StackVariables is Ownable {
    uint256 public bonusMultiprierTop;
    uint256 public bonusMultiprierBottom;
    uint256 public difficultyTop;
    uint256 public difficultyBottom;

    constructor(address _initialOwner) Ownable(_initialOwner) {
        bonusMultiprierTop = 1;
        bonusMultiprierBottom = 1;
        difficultyTop = 1;
        difficultyBottom = 100;
    }

    function setBonusMultiprier(
        uint256 _bonusMultiplierTop,
        uint256 _bonusMultiplierBottom
    ) public onlyOwner {
        bonusMultiprierTop = _bonusMultiplierTop;
        bonusMultiprierBottom = _bonusMultiplierBottom;
    }

    function setDifficulty(
        uint256 _difficultyTop,
        uint256 _difficultyBottom
    ) public onlyOwner {
        difficultyTop = _difficultyTop;
        difficultyBottom = _difficultyBottom;
    }
}
