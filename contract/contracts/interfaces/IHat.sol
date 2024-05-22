// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./IERC404.sol";

interface IHat is IERC404 {
    function mint(address to, uint256 amount) external;

    function useTicket(address user) external;

    function setBaseURI(string memory baseURI_) external;
}
