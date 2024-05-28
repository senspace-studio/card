// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '../interfaces/IGasha.sol';
import '../interfaces/ICard.sol';
import '../interfaces/IHat.sol';

contract Gasha is IGasha, OwnableUpgradeable, PausableUpgradeable {
    ICard public GashaItem;

    IHat public Hat;

    SeriesItem[] public series;

    uint256 public seed;

    uint256 public unitPrice;

    uint64 public startTime;

    uint64 public endTime;

    uint256[] public basePoint;

    BonusPointDuration public bonusPoint;

    mapping(address => bool) public operators;

    modifier isAvailableTime() {
        uint256 currentTime = block.timestamp;
        require(
            startTime <= currentTime && currentTime <= endTime,
            'Gasha: not available now'
        );
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender], 'Gasha: caller is not the operator');
        _;
    }

    function initialize(
        address _initialOwner,
        address _gashaItemERC1155,
        address _hatERC404,
        uint256 _initialSeed,
        uint256 _unitPrice
    ) public initializer {
        __Ownable_init(_initialOwner);
        __Pausable_init();
        GashaItem = ICard(_gashaItemERC1155);
        Hat = IHat(_hatERC404);
        seed = _initialSeed;
        unitPrice = _unitPrice;
        basePoint = [200, 600, 1800];
    }

    function spin(
        uint256 quantity
    ) external payable isAvailableTime whenNotPaused {
        require(quantity > 0 && quantity < 1000, 'Gasha: quantity is invalid');
        require(msg.value >= unitPrice * quantity, 'Gasha: insufficient funds');

        SeriesItem[] memory activeSeriesItem = activeSeriesItems();
        uint256[] memory ids = new uint256[](activeSeriesItem.length);
        uint256[] memory quantities = new uint256[](activeSeriesItem.length);
        uint256 earnedPoint = 0;
        uint32 bonusMultiplier = _bonusMultiplier();

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
            earnedPoint +=
                basePoint[uint256(item.rareness)] *
                bonusMultiplier *
                (10 ** 18);
        }

        _mint(msg.sender, ids, quantities);

        emit Spin(msg.sender, ids, quantities);

        Hat.mint(msg.sender, earnedPoint);
    }

    function dropByOwner(
        address to,
        uint256[] memory ids,
        uint256[] memory quantities
    ) external payable onlyOwner {
        uint256 totalQuantity = 0;
        for (uint256 i = 0; i < quantities.length; i++) {
            totalQuantity += quantities[i];
        }
        require(
            msg.value >= unitPrice * totalQuantity,
            'Gasha: insufficient funds'
        );

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
        SeriesItem memory defaultItem;
        for (uint256 i = 0; i < seriesItem.length; i++) {
            totalWeight += seriesItem[i].weight;
            if (seriesItem[i].rareness == Rareness.Common) {
                defaultItem = seriesItem[i];
            }
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

    function _bonusMultiplier() internal view returns (uint32) {
        uint256 currentTime = block.timestamp;
        if (
            bonusPoint.startTime <= currentTime &&
            currentTime < bonusPoint.endTime
        ) {
            return bonusPoint.multiplier;
        }
        return 1;
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
        for (uint256 i = 0; i < series.length; i++) {
            require(
                series[i].tokenId != tokenId,
                'Gasha: tokenId is already exist'
            );
        }
        series.push(SeriesItem(tokenId, rareness, weight, false));
    }

    function activateSeriesItem(uint256 tokenId) public onlyOwner {
        for (uint256 i = 0; i < series.length; i++) {
            if (series[i].tokenId == tokenId) {
                series[i].isActive = true;
                break;
            }
        }
    }

    function deactivateSeriesItem(uint256 tokenId) public onlyOwner {
        for (uint256 i = 0; i < series.length; i++) {
            if (series[i].tokenId == tokenId) {
                series[i].isActive = false;
                break;
            }
        }
    }

    function resetSeed(uint256 newSeed) external onlyOwner {
        seed = newSeed;
    }

    function setAvailableTime(
        uint64 _startTime,
        uint64 _endTime
    ) external onlyOwner {
        startTime = _startTime;
        endTime = _endTime;

        emit SetAvailableTime(_startTime, _endTime);
    }

    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    function setOperator(address _operator, bool _status) external onlyOwner {
        operators[_operator] = _status;
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
