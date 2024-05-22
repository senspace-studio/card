//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC404} from "./ERC404.sol";
import "../interfaces/IHat.sol";

contract Hat is IHat, OwnableUpgradeable, ERC404 {
    string private baseURI;

    mapping(address => bool) private forwarders;

    modifier onlyForwarder() {
        require(forwarders[msg.sender], "Hat: only forwarder");
        _;
    }

    function initialize(
        address _initialOwner,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public initializer {
        __Ownable_init(_initialOwner);
        __ERC404_init(_name, _symbol, _decimals);
    }

    function mint(address _to, uint256 _amount) external onlyForwarder {
        _mintERC20(_to, _amount);
    }

    function useTicket(address user) external onlyForwarder {
        _withdrawAndStoreERC721(user);
    }

    function tokenURI(
        uint256 id_
    ) public view override(ERC404, IERC404) returns (string memory) {
        return "ipfs://QmVLv1nhqN3wUtsG5g3XVLNCLU7yo43X4UbNwG4cmPBcji";
    }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        baseURI = baseURI_;
    }

    function setForwarder(address forwarder, bool enabled) public onlyOwner {
        forwarders[forwarder] = enabled;
    }
}
