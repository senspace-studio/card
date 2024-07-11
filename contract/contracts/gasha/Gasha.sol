// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '../interfaces/IGasha.sol';
import '../interfaces/ICard.sol';

contract Gasha is IGasha, OwnableUpgradeable, PausableUpgradeable {
    ICard public GashaItem;

    IERC721 public invitation;

    address public poolWallet;

    SeriesItem[] public series;

    uint256 public seed;

    uint256 public unitPrice;

    uint64 public startTime;

    uint64 public endTime;

    address public commissionWallet;

    modifier isAvailableTime() {
        uint256 currentTime = block.timestamp;
        require(
            startTime <= currentTime && currentTime <= endTime,
            'Gasha: not available now'
        );
        _;
    }

    modifier onlyInvitationHolder() {
        // require(
        //     invitation.balanceOf(msg.sender) > 0,
        //     'War: only invitation holder can call this function'
        // );
        _;
    }

    function initialize(
        address _initialOwner,
        address _gashaItemERC1155,
        address _poolWallet,
        uint256 _initialSeed,
        uint256 _unitPrice
    ) public initializer {
        __Ownable_init(_initialOwner);
        __Pausable_init();
        GashaItem = ICard(_gashaItemERC1155);
        poolWallet = _poolWallet;
        seed = _initialSeed;
        unitPrice = _unitPrice;
    }

    function spin(
        uint256 quantity
    ) external payable isAvailableTime whenNotPaused onlyInvitationHolder {
        require(quantity > 0 && quantity < 1000, 'Gasha: quantity is invalid');
        require(msg.value >= unitPrice * quantity, 'Gasha: insufficient funds');

        SeriesItem[] memory activeSeriesItem = activeSeriesItems();
        uint256[] memory ids = new uint256[](activeSeriesItem.length);
        uint256[] memory quantities = new uint256[](activeSeriesItem.length);

        for (uint256 i = 0; i < activeSeriesItem.length; i++) {
            ids[i] = activeSeriesItem[i].tokenId;
            quantities[i] = 0;
        }

        for (uint256 i = 0; i < quantity; i++) {
            SeriesItem memory item = _pickRandomBall(i);
            for (uint256 j = 0; j < activeSeriesItem.length; j++) {
                if (activeSeriesItem[j].tokenId == item.tokenId) {
                    quantities[j]++;
                    break;
                }
            }
        }

        uint256 poolValue = (msg.value * 95) / 100;
        uint256 commission = msg.value - poolValue;
        require(_safeTransfer(poolWallet, poolValue), 'Gasha: transfer failed');
        require(
            _safeTransfer(commissionWallet, commission),
            'Gasha: transfer failed'
        );

        _mint(msg.sender, ids, quantities);

        emit Spin(msg.sender, ids, quantities);
    }

    function dropByOwner(
        address to,
        uint256[] memory ids,
        uint256[] memory quantities
    ) external payable onlyOwner {
        _mint(to, ids, quantities);

        emit Spin(to, ids, quantities);
    }

    function _mint(
        address to,
        uint256[] memory ids,
        uint256[] memory quantities
    ) private {
        for (uint256 i = 0; i < ids.length; i++) {
            if (quantities[i] > 0) {
                GashaItem.mint(to, ids[i], quantities[i]);
            }
        }
    }

    function _pickRandomBall(
        uint256 salt
    ) internal view returns (SeriesItem memory item) {
        uint256 totalWeight = 0;
        SeriesItem[] memory seriesItem = activeSeriesItems();
        SeriesItem memory defaultItem = seriesItem[0];
        for (uint256 i = 0; i < seriesItem.length; i++) {
            totalWeight += seriesItem[i].weight;
        }

        // slither-disable-start weak-prng
        uint256 randomNum = uint256(
            keccak256(
                abi.encodePacked(block.timestamp, block.prevrandao, seed - salt)
            )
        ) % totalWeight;
        // slither-disable-end weak-prng

        uint256 sum = 0;
        for (uint256 i = 0; i < seriesItem.length; i++) {
            sum += seriesItem[i].weight;
            if (randomNum < sum) {
                return seriesItem[i];
            }
        }

        return defaultItem;
    }

    function _safeTransfer(address to, uint256 amount) private returns (bool) {
        // slither-disable-next-line arbitrary-send-eth
        (bool success, ) = to.call{value: amount}('');

        return success;
    }

    function activeSeriesItems() public view returns (SeriesItem[] memory) {
        uint256 activeItemCount = 0;
        for (uint256 i = 0; i < series.length; i++) {
            if (series[i].isActive) {
                activeItemCount++;
            }
        }

        SeriesItem[] memory activeItems = new SeriesItem[](activeItemCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < series.length; i++) {
            if (series[i].isActive) {
                activeItems[currentIndex] = series[i];
                currentIndex++;
            }
        }

        return activeItems;
    }

    function seriesItems() public view returns (SeriesItem[] memory) {
        return series;
    }

    function setNewSeriesItem(
        uint256 tokenId,
        Rareness rareness,
        uint256 weight
    ) public onlyOwner {
        series.push(SeriesItem(tokenId, rareness, weight, false));

        emit SetNewSeriesItem(tokenId, weight, rareness);
    }

    function activateSeriesItem(uint256 index) public onlyOwner {
        series[index].isActive = true;

        emit ActivateSeriesItem(index);
    }

    function deactivateSeriesItem(uint256 index) public onlyOwner {
        series[index].isActive = false;

        emit DeactivateSeriesItem(index);
    }

    function resetSeed(uint256 newSeed) external onlyOwner {
        seed = newSeed;

        emit ResetSeed(newSeed);
    }

    function setAvailableTime(
        uint64 _startTime,
        uint64 _endTime
    ) external onlyOwner {
        startTime = _startTime;
        endTime = _endTime;

        emit SetAvailableTime(_startTime, _endTime);
    }

    function setPoolWallet(address _poolWallet) external onlyOwner {
        poolWallet = _poolWallet;

        emit SetPool(_poolWallet);
    }

    function setCommissionWallet(address _commissionWallet) external onlyOwner {
        commissionWallet = _commissionWallet;

        emit SetCommission(_commissionWallet);
    }

    function setInvitationAddress(address _invitation) external onlyOwner {
        invitation = IERC721(_invitation);

        emit SetInvitation(_invitation);
    }

    function setUnitPrice(uint256 _unitPrice) external onlyOwner {
        unitPrice = _unitPrice;

        emit SetUnitPrice(_unitPrice);
    }

    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public virtual returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public virtual returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
