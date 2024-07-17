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
        uint256 cardTokenId
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
        address loser;
        uint256 rewardRateTop;

        if (!makerHasCard && !challengerHasCard) {
            game.makerCard = makerCard;
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
                makerCard,
                game.challengerCard,
                game.maker,
                game.challenger
            );

            if (winner != address(0)) {
                loser = winner == game.maker ? game.challenger : game.maker;
                uint256 loserCard = winner == game.maker
                    ? game.challengerCard
                    : makerCard;
                rewardRateTop = calcRewardRateTop(loserCard);
            } else {
                loser = address(0);
                rewardRateTop = 0;
            }
        }

        game.winner = winner;
        game.makerCard = makerCard;

        if (winner == address(0)) {
            warPool.returnToBoth(gameId);
            card.burn(game.maker, makerCard, 1);
            card.burn(game.challenger, game.challengerCard, 1);
        } else {
            warPool.payoutForWinner(gameId, rewardRateTop, winner, loser);
            if (!makerHasCard) {
                card.burn(game.challenger, game.challengerCard, 1);
            } else if (!challengerHasCard) {
                card.burn(game.maker, makerCard, 1);
            } else {
                card.burn(game.maker, makerCard, 1);
                card.burn(game.challenger, game.challengerCard, 1);
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

    function setGame(
        bytes8 _gameId,
        address _maker,
        address _challenger,
        address _winner,
        uint256 _makerCard,
        uint256 _challengerCard,
        bytes memory _dealerSignature,
        uint64 _createdAt
    ) public whenNotPaused nonReentrant onlyOwner {
        games[_gameId] = Game({
            maker: _maker,
            challenger: _challenger,
            winner: _winner,
            makerCard: _makerCard,
            challengerCard: _challengerCard,
            dealerSignature: _dealerSignature,
            createdAt: _createdAt
        });
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

    function _getWinner(
        uint256 makerCard,
        uint256 challengerCard,
        address makerAddress,
        address challengerAddress
    ) internal pure returns (address) {
        if (makerCard == 14 && challengerCard == 1) {
            return challengerAddress;
        } else if (makerCard == 1 && challengerCard == 14) {
            return makerAddress;
        } else if (makerCard > challengerCard) {
            return makerAddress;
        } else if (makerCard < challengerCard) {
            return challengerAddress;
        } else {
            return address(0);
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
