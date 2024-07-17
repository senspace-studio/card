// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '../interfaces/IWar.sol';
import '../interfaces/IWarPool.sol';
import '../interfaces/ICard.sol';
import '../lib/SignatureVerifier.sol';
import 'hardhat/console.sol';

contract War is
    IWar,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    SignatureVerifier
{
    address public dealerAddress;

    IWarPool public warPool;

    ICard public card;

    IERC721 public invitation;

    mapping(bytes8 => Game) public games;

    uint64 expirationTime;

    mapping(bytes => bool) signatures;

    mapping(bytes8 => address) public requestedChallengers;

    mapping(uint256 => uint256[]) public playerCards;

    modifier onlyDealer() {
        require(
            dealerAddress == msg.sender,
            'War: only dealer can call this function'
        );
        _;
    }

    modifier onlyInvitationHolder() {
        require(
            invitation.balanceOf(msg.sender) > 0,
            'War: only invitation holder can call this function'
        );
        _;
    }

    modifier onlyCreatedGame(bytes8 gameId) {
        GameStatus status = gameStatus(gameId);
        require(
            status == GameStatus.Created,
            'War: game status should be Created'
        );
        _;
    }

    modifier onlyChallengedGame(bytes8 gameId) {
        GameStatus status = gameStatus(gameId);
        require(
            status == GameStatus.Challenged,
            'War: game status should be Challenged'
        );
        _;
    }

    modifier onlyExpiredGame(bytes8 gameId) {
        GameStatus status = gameStatus(gameId);
        require(
            status == GameStatus.Expired,
            'War: game status should be Expired'
        );
        _;
    }

    modifier onlyOpenOrRequestedGame(bytes8 gameId, address challenger) {
        address requestedChallenger = requestedChallengers[gameId];
        require(
            requestedChallenger == address(0) ||
                requestedChallenger == challenger,
            'War: you cannot challenge this game'
        );
        _;
    }

    function initialize(
        address _initialOwner,
        address _dealerAddress,
        uint64 _expirationTime
    ) public initializer {
        __Ownable_init(_initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        dealerAddress = _dealerAddress;
        expirationTime = _expirationTime;
    }

    function makeGame(
        address currency,
        uint256 betAmount,
        bool isNativeToken,
        bytes memory signature,
        address requestChallenger
    ) external payable whenNotPaused nonReentrant onlyInvitationHolder {
        require(signatures[signature] == false, 'War: signature already used');

        require(
            isNativeToken ? msg.value == betAmount : true,
            'War: invalid bet amount'
        );

        signatures[signature] = true;

        bytes8 gameId = bytes8(
            keccak256(abi.encodePacked(msg.sender, block.timestamp, signature))
        );

        games[gameId] = Game({
            maker: msg.sender,
            challenger: address(0),
            winner: address(0),
            dealerSignature: signature,
            makerCard: 0,
            challengerCard: 0,
            createdAt: uint64(block.timestamp)
        });

        if (requestChallenger != address(0)) {
            requestedChallengers[gameId] = requestChallenger;
            emit GameRequested(gameId, msg.sender, requestChallenger);
        }

        warPool.deposit{value: isNativeToken ? betAmount : 0}(
            gameId,
            msg.sender,
            currency,
            isNativeToken,
            betAmount
        );

        emit GameMade(gameId, msg.sender, signature);
    }

    function challengeGame(
        bytes8 gameId,
        uint256[] memory challengerCards
    )
        external
        payable
        whenNotPaused
        nonReentrant
        onlyInvitationHolder
        onlyCreatedGame(gameId)
        onlyOpenOrRequestedGame(gameId, msg.sender)
    {
        Game storage game = games[gameId];
        require(game.maker != msg.sender, 'War: cannot challenge own game');

        (
            address maker,
            address challenger,
            address currency,
            bool isNativeToken,
            uint256 betAmount,
            IWarPool.DepositStatus status
        ) = warPool.gameDeposits(gameId);

        require(
            status == IWarPool.DepositStatus.DepositedByMaker &&
                challenger == address(0),
            'War: invalid game status'
        );
        require(
            isNativeToken ? msg.value == betAmount : true,
            'War: invalid bet amount'
        );

        game.challenger = msg.sender;

        _sortCard(challengerCards, 0, int256(challengerCards.length - 1));
        uint256 challengerCardsIdentifier = uint256(
            keccak256(abi.encodePacked(gameId, PlayerSide.Challenger))
        );
        playerCards[challengerCardsIdentifier] = challengerCards;
        game.challengerCard = challengerCardsIdentifier;

        warPool.deposit{value: isNativeToken ? msg.value : 0}(
            gameId,
            msg.sender,
            address(0),
            isNativeToken,
            betAmount
        );

        emit GameChallenged(gameId, msg.sender);
    }

    function revealCard(
        bytes8 gameId,
        uint256[] memory makerCards,
        uint256 nonce
    ) external whenNotPaused nonReentrant onlyChallengedGame(gameId) {
        Game storage game = games[gameId];
        require(game.maker != address(0), 'War: game not found');

        _sortCard(makerCards, 0, int256(makerCards.length - 1));
        bytes32 makerCardsString = keccak256(abi.encodePacked(makerCards));
        require(
            SignatureVerifier.verify(
                dealerAddress,
                makerCardsString,
                nonce,
                game.dealerSignature
            ),
            'War: invalid signature'
        );

        uint256[] memory challengerCards = playerCards[game.challengerCard];

        bool makerHasCard = _hasCards(game.maker, makerCards);

        bool challengerHasCard = _hasCards(game.challenger, challengerCards);

        address winner;
        address loser;
        uint256 rewardRateTop;

        uint256 makerCardsIdentifier = uint256(
            keccak256(abi.encodePacked(gameId, PlayerSide.Maker))
        );

        if (!makerHasCard && !challengerHasCard) {
            game.makerCard = makerCardsIdentifier;
            playerCards[makerCardsIdentifier] = makerCards;
            warPool.withdrawByAdmin(gameId);
            return;
        }

        if (!makerHasCard) {
            winner = game.challenger;
            loser = game.maker;
            rewardRateTop = 100000;
        } else if (!challengerHasCard) {
            winner = game.maker;
            loser = game.challenger;
            rewardRateTop = 100000;
        } else {
            winner = _getWinner(
                makerCards,
                challengerCards,
                game.maker,
                game.challenger
            );

            if (winner != address(0)) {
                loser = winner == game.maker ? game.challenger : game.maker;
                rewardRateTop = calcRewardRateTop(0);
            } else {
                loser = address(0);
                rewardRateTop = 0;
            }
        }

        game.winner = winner;
        game.makerCard = makerCardsIdentifier;
        playerCards[makerCardsIdentifier] = makerCards;

        uint256[] memory burnBatchAmount = new uint256[](makerCards.length);
        for (uint256 i = 0; i < makerCards.length; i++) {
            burnBatchAmount[i] = 1;
        }

        if (winner == address(0)) {
            warPool.returnToBoth(gameId);
            card.burnBatch(game.maker, makerCards, burnBatchAmount);
            card.burnBatch(game.challenger, challengerCards, burnBatchAmount);
        } else {
            warPool.payoutForWinner(gameId, rewardRateTop, winner, loser);
            if (!makerHasCard) {
                card.burnBatch(
                    game.challenger,
                    challengerCards,
                    burnBatchAmount
                );
            } else if (!challengerHasCard) {
                card.burnBatch(game.maker, makerCards, burnBatchAmount);
            } else {
                card.burnBatch(game.maker, makerCards, burnBatchAmount);
                card.burnBatch(
                    game.challenger,
                    challengerCards,
                    burnBatchAmount
                );
            }
        }

        emit GameRevealed(gameId, game.maker, game.challenger, winner);
    }

    function expireGame(
        bytes8 gameId
    ) public whenNotPaused nonReentrant onlyExpiredGame(gameId) {
        Game memory game = games[gameId];

        warPool.returnToMaker(gameId);

        emit GameExpired(gameId, game.maker);
    }

    function gameStatus(bytes8 gameId) public view returns (GameStatus status) {
        Game memory game = games[gameId];

        if (game.maker != address(0)) {
            if (game.challenger == address(0)) {
                if (block.timestamp - game.createdAt > expirationTime) {
                    return GameStatus.Expired;
                } else {
                    return GameStatus.Created;
                }
            } else if (game.challenger != address(0)) {
                // slither-disable-next-line incorrect-equality
                if (game.makerCard == 0) {
                    return GameStatus.Challenged;
                } else {
                    return GameStatus.Revealed;
                }
            }
        } else {
            return GameStatus.NotExist;
        }
    }

    function calcRewardRateTop(
        uint256 looserCard
    ) public pure returns (uint256) {
        return 100000;
    }

    function _getWinner(
        uint256[] memory makerCards,
        uint256[] memory challengerCards,
        address makerAddress,
        address challengerAddress
    ) internal pure returns (address) {
        bool makerHas14 = makerCards[0] == 14;
        bool challengerHas14 = challengerCards[0] == 14;

        bool makerHas1 = makerCards[makerCards.length - 1] == 1;
        bool challengerHas1 = challengerCards[challengerCards.length - 1] == 1;

        // If a player has 14 and the other has 1, the player with 1 wins
        // If both have 14 and 1, it is a draw
        if (makerHas14 && challengerHas14 && makerHas1 && challengerHas1) {
            return address(0);
        } else if (makerHas14 && challengerHas1) {
            return challengerAddress;
        } else if (makerHas1 && challengerHas14) {
            return makerAddress;
        }

        uint8 makerScore = 0;
        uint8 challengerScore = 0;

        // Compare cards one by one, then the player with the higher card wins
        for (uint256 i = 0; i < makerCards.length; i++) {
            uint256 makerCard = makerCards[i];
            uint256 challengerCard = challengerCards[i];
            if (makerCard == 14) {
                makerScore += 1;
                continue;
            } else if (challengerCard == 14) {
                challengerScore += 1;
                continue;
            } else if (makerCard > challengerCard) {
                makerScore += 1;
                continue;
            } else if (makerCard < challengerCard) {
                challengerScore += 1;
                continue;
            }
        }

        if (makerScore > challengerScore) {
            return makerAddress;
        } else if (makerScore < challengerScore) {
            return challengerAddress;
        } else {
            return address(0);
        }
    }

    function _hasCards(
        address owner,
        uint256[] memory tokenIds
    ) internal view returns (bool) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 balance = card.balanceOf(owner, tokenIds[i]);
            if (balance == 0) {
                return false;
            }
        }
        return true;
    }

    function _sortCard(
        uint256[] memory _arr,
        int256 left,
        int256 right
    ) internal pure {
        int256 i = left;
        int256 j = right;
        if (i == j) return;
        uint256 pivot = _arr[uint256(left + (right - left) / 2)];
        while (i <= j) {
            while (_arr[uint256(i)] < pivot) i++;
            while (pivot < _arr[uint256(j)]) j--;
            if (i <= j) {
                (_arr[uint256(i)], _arr[uint256(j)]) = (
                    _arr[uint256(j)],
                    _arr[uint256(i)]
                );
                i++;
                j--;
            }
        }
        if (left < j) _sortCard(_arr, left, j);
        if (i < right) _sortCard(_arr, i, right);
    }

    function setDealerAddress(address _dealerAddress) external onlyOwner {
        dealerAddress = _dealerAddress;
        emit SetDealer(_dealerAddress);
    }

    function setWarPoolAddress(address _warPool) external onlyOwner {
        warPool = IWarPool(_warPool);
        emit SetWarPool(_warPool);
    }

    function setCardAddress(address _card) external onlyOwner {
        card = ICard(_card);
        emit SetCard(_card);
    }

    function setInvitationAddress(address _invitation) external onlyOwner {
        invitation = IERC721(_invitation);
        emit SetInvitation(_invitation);
    }

    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }
}
