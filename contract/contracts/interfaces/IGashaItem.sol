// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC1155.sol";
import "@openzeppelin/contracts/interfaces/IERC1155MetadataURI.sol";

interface IGashaItem is IERC1155, IERC1155MetadataURI {
    function mint(address to, uint256 tokenId, uint256 amount) external;

    function setupNewToken(string memory tokenURI) external returns (uint256);
}
