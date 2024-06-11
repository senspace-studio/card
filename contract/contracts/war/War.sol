// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
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
    address dealerAddress;

    IWarPool warPool;

    ICard card;

    mapping(bytes8 => Game) public games;

    modifier onlyDealer() {
        require(
            dealerAddress == msg.sender,
            'War: only dealer can call this function'
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

    function initialize(
        address _initialOwner,
        address _dealerAddress
    ) public initializer {
        __Ownable_init(_initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        dealerAddress = _dealerAddress;
    }

    function makeGame(
        address currency,
        uint256 betAmount,
        bool isNativeToken,
        bytes memory signature
    ) external payable whenNotPaused nonReentrant {
        bytes8 gameId = bytes8(
            keccak256(abi.encodePacked(msg.sender, block.timestamp, signature))
        );

        require(
            isNativeToken ? msg.value == betAmount : true,
            'War: invalid bet amount'
        );

        warPool.deposit{value: isNativeToken ? betAmount : 0}(
            gameId,
            msg.sender,
            currency,
            isNativeToken,
            betAmount
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

        emit GameMade(gameId, msg.sender, signature);
    }

    function challengeGame(
        bytes8 gameId,
        uint256 cardTokenId
    ) external payable whenNotPaused nonReentrant onlyCreatedGame(gameId) {
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
        game.challengerCard = cardTokenId;

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
        uint256 makerCard,
        uint256 nonce
    ) external whenNotPaused nonReentrant onlyChallengedGame(gameId) {
        Game storage game = games[gameId];
        require(game.maker != address(0), 'War: game not found');

        require(
            SignatureVerifier.verify(
                dealerAddress,
                makerCard,
                nonce,
                game.dealerSignature
            ),
            'War: invalid signature'
        );

        bool makerHasCard = _hasCard(game.maker, makerCard);
        bool challengerHasCard = _hasCard(game.challenger, game.challengerCard);

        address winner;
        uint256 rewardRateTop;

        if (!makerHasCard && !challengerHasCard) {
            game.makerCard = makerCard;
            warPool.withdrawByAdmin(gameId);
            return;
        } else if (!makerHasCard) {
            winner = game.challenger;
            rewardRateTop = 100;
            card.burn(game.challenger, game.challengerCard, 1);
        } else if (!challengerHasCard) {
            winner = game.maker;
            rewardRateTop = 100;
            card.burn(game.maker, makerCard, 1);
            warPool.payoutForWinner(gameId, rewardRateTop, winner, address(0));
        } else {
            winner = makerCard > game.challengerCard
                ? game.maker
                : makerCard == game.challengerCard
                ? address(0)
                : game.challenger;

            if (winner == address(0)) {
                warPool.returnToBoth(gameId);
            } else {
                address loser = winner == game.maker
                    ? game.challenger
                    : game.maker;
                uint256 looserCard = winner == game.maker
                    ? game.challengerCard
                    : makerCard;
                rewardRateTop = calcRewardRateTop(looserCard);
                warPool.payoutForWinner(gameId, rewardRateTop, winner, loser);
            }

            card.burn(game.maker, makerCard, 1);
            card.burn(game.challenger, game.challengerCard, 1);
        }

        game.winner = winner;
        game.makerCard = makerCard;

        emit GameRevealed(gameId, game.maker, game.challenger, winner);
    }

    function gameStatus(bytes8 gameId) public view returns (GameStatus status) {
        Game memory game = games[gameId];

        if (
            game.maker != address(0) &&
            game.challenger == address(0) &&
            block.timestamp - game.createdAt > 1 days
        ) {
            return GameStatus.Expired;
        } else if (game.maker != address(0) && game.challenger == address(0)) {
            return GameStatus.Created;
        } else if (
            game.maker != address(0) &&
            game.challenger != address(0) &&
            game.makerCard == 0
        ) {
            return GameStatus.Challenged;
        } else if (game.maker != address(0) && game.challenger != address(0)) {
            return GameStatus.Revealed;
        } else {
            return GameStatus.NotExist;
        }
    }

    function calcRewardRateTop(
        uint256 looserCard
    ) public pure returns (uint256) {
        if (looserCard == 1) {
            return 1095;
        } else if (looserCard == 2) {
            return 9529;
        } else if (looserCard == 3) {
            return 19058;
        } else if (looserCard == 4) {
            return 9529;
        } else if (looserCard == 5) {
            return 38116;
        } else if (looserCard == 6) {
            return 47645;
        } else if (looserCard == 7) {
            return 57174;
        } else if (looserCard == 8) {
            return 66703;
        } else if (looserCard == 9) {
            return 76232;
        } else if (looserCard == 10) {
            return 85761;
        } else if (looserCard == 11) {
            return 90625;
        } else if (looserCard == 12) {
            return 94792;
        } else if (looserCard == 13) {
            return 98958;
        } else if (looserCard == 14) {
            return 91212;
        } else {
            return 0;
        }
    }

    function _hasCard(
        address owner,
        uint256 tokenId
    ) internal view returns (bool) {
        uint256 balance = card.balanceOf(owner, tokenId);

        return balance > 0;
    }

    function setDealerAddress(address _dealerAddress) external onlyOwner {
        dealerAddress = _dealerAddress;
    }

    function setWarPoolAddress(address _warPool) external onlyOwner {
        warPool = IWarPool(_warPool);
    }

    function setCardAddress(address _card) external onlyOwner {
        card = ICard(_card);
    }
}
