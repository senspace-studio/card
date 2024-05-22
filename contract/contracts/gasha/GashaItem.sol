// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/IGashaItem.sol";

contract GashaItem is
    IGashaItem,
    ERC1155URIStorageUpgradeable,
    OwnableUpgradeable
{
    uint256 public nextTokenId;

    mapping(address => bool) private minters;

    modifier onlyMinter() {
        require(minters[msg.sender], "GashaItem: only minter");
        _;
    }

    function initialize(address _initialOwner) public initializer {
        __ERC1155URIStorage_init();
        __Ownable_init(_initialOwner);
        nextTokenId ++;
    }

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) public onlyMinter {
        require(nextTokenId >= tokenId, "GashaItem: invalid tokenId");
        _mint(to, tokenId, amount, "");
    }

    function setMinter(address minter, bool enabled) public onlyOwner {
        minters[minter] = enabled;
    }

    function setupNewToken(
        string memory tokenURI
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _getAndUpdateNextTokenId();
        _setURI(tokenId, tokenURI);
        return tokenId;
    }

    function setBaseURI(string memory baseURI) public onlyOwner {
        _setBaseURI(baseURI);
    }

    function _getAndUpdateNextTokenId() internal returns (uint256) {
        unchecked {
            return nextTokenId++;
        }
    }
}
