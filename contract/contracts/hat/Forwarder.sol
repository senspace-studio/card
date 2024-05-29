// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import '../interfaces/IHat.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract Forwarder is Ownable {
    IHat public hat;

    mapping(address => bool) public operators;

    event Forwarded(address indexed to, uint256 rewardValue, string memo);

    modifier onlyOperator() {
        require(operators[msg.sender], 'Forwarder: caller is not the operator');
        _;
    }

    constructor(address _initialOwner, address _hat) Ownable(_initialOwner) {
        hat = IHat(_hat);
    }

    receive() external payable {}

    fallback() external payable {}

    function burnAndRedeemReward(
        address to,
        uint256 rewardValue,
        string memory memo
    ) external onlyOperator {
        require(hat.erc721BalanceOf(to) > 0, 'Forwarder: NFT required');

        hat.useTicket(to);

        // slither-disable-next-line all
        (bool success, ) = to.call{value: rewardValue}('');
        require(success, 'Transfer failed.');

        emit Forwarded(to, rewardValue, memo);
    }

    function burn(address to, string memory memo) external onlyOperator {
        require(hat.erc721BalanceOf(to) > 0, 'Forwarder: NFT required');
        hat.useTicket(to);

        emit Forwarded(to, 0, memo);
    }

    function setOperator(address operator, bool enabled) external onlyOwner {
        operators[operator] = enabled;
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }
}
