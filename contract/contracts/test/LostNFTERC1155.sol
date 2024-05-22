// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract LostNFTERC1155 is ERC1155 {
    constructor() ERC1155("https://game.example/api/item/{id}.json") {
        _mint(msg.sender, 0, 10 ** 18, "");
    }

    function mintTo(
        address to,
        uint256 tokenId,
        string calldata uri,
        uint256 amount
    ) external {
        _mint(to, tokenId, amount, "");
    }
}
