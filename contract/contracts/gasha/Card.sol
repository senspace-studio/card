// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import '@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155URIStorageUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../interfaces/ICard.sol';

contract Card is ICard, ERC1155URIStorageUpgradeable, OwnableUpgradeable {
    uint256 public nextTokenId;

    mapping(address => bool) private minters;

    mapping(address => bool) private burners;

    modifier onlyMinter() {
        require(minters[msg.sender], 'Card: only minter');
        _;
    }

    modifier onlyBurnerOrSelf(address account) {
        require(
            burners[msg.sender] || account == msg.sender,
            'Card: only bunner'
        );
        _;
    }

    function initialize(address _initialOwner) public initializer {
        __ERC1155URIStorage_init();
        __Ownable_init(_initialOwner);
        nextTokenId++;
    }

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) public onlyMinter {
        require(nextTokenId >= tokenId, 'Card: invalid tokenId');
        _mint(to, tokenId, amount, '');
    }

    function burn(
        address account,
        uint256 tokenId,
        uint256 amount
    ) public onlyBurnerOrSelf(account) {
        _burn(account, tokenId, amount);
    }

    function burnBatch(
        address account,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) public onlyBurnerOrSelf(account) {
        _burnBatch(account, tokenIds, amounts);
    }

    function setMinter(address minter, bool enabled) public onlyOwner {
        minters[minter] = enabled;
    }

    function setBurner(address burner, bool enabled) public onlyOwner {
        burners[burner] = enabled;
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
