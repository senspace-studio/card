import 'dotenv/config';
import { zeroAddress } from 'viem';
import tweClient from './thirdweb-engine';
import { INVITATION_CONTRACT_ADDRESS, WAR_CONTRACT_ADDRESS } from './config';

type GameRevealedEventLog = {
  gameId: string;
  maker: string;
  challenger: string;
  winner: string;
};

type TransferEventLog = {
  from: string;
  to: string;
  tokenId: { type: string; hex: string };
};

const getBlockNumberFromTimestamp = async (timestamp: number) => {
  const res = await fetch(
    `https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=after`,
  );
  const {
    result: { blockNumber },
  } = (await res.json()) as { result: { blockNumber: string } };
  return blockNumber;
};

const getContractEventLogs = async <E>(
  contractAddress: string,
  eventName: string,
  startDateUnix: number,
  endDateUnix: number,
) => {
  const [fromBlock, toBlock] = await Promise.all([
    getBlockNumberFromTimestamp(startDateUnix),
    getBlockNumberFromTimestamp(endDateUnix),
  ]);
  const res = (await tweClient.POST(
    '/contract/{chain}/{contractAddress}/events/get',
    {
      params: {
        path: {
          chain: 'degen-chain',
          contractAddress,
        },
      },
      body: {
        eventName,
        fromBlock,
        toBlock,
      } as never,
    },
  )) as any;
  const {
    result,
  }: {
    result: {
      eventName: string;
      data: any;
      transaction: any;
    }[];
  } = res.data;
  // 古いログが小さいインデックス
  return result.reverse().map((r) => ({ ...r.data })) as unknown as E[];
};

export const getGameRevealedLogs = async (
  startDateUnix: number,
  endDateUnix: number,
) => {
  return await getContractEventLogs<GameRevealedEventLog>(
    WAR_CONTRACT_ADDRESS,
    'GameRevealed',
    startDateUnix,
    endDateUnix,
  );
};

const getInvivationTransferLogs = async (
  startDateUnix: number,
  endDateUnix: number,
) => {
  return await getContractEventLogs<TransferEventLog>(
    INVITATION_CONTRACT_ADDRESS,
    'Transfer',
    startDateUnix,
    endDateUnix,
  );
};

type Invitation = { tokenId: string; from: string; to: string };

class InvivationMap {
  private _tokenIdMap: { [to: string]: string } = {};
  private _fromMap: { [to: string]: string } = {};
  private _toMap: { [tokenId: string]: string } = {};
  // フラグ
  private _activationMap: { [tokenId: string]: boolean } = {};

  findOne(filter: Partial<Pick<Invitation, 'tokenId' | 'to'>>) {
    const { tokenId, to } = filter;
    if (typeof tokenId === 'string' && typeof to === 'string') {
      if (to === this._toMap[tokenId]) {
        const from = this._fromMap[to];
        return { tokenId, from, to };
      }
    } else if (typeof tokenId === 'string') {
      const to = this._toMap[tokenId];
      if (to) {
        const from = this._fromMap[to];
        return { tokenId, from, to };
      }
    } else if (typeof to === 'string') {
      const tokenId = this._tokenIdMap[to];
      if (tokenId) {
        const from = this._fromMap[to];
        return { tokenId, from, to };
      }
    }
    return null;
  }

  findBy(filter: Partial<Pick<Invitation, 'from'>>) {
    const res: Invitation[] = [];
    const { from } = filter;
    for (const to in this._fromMap) {
      if (from === this._fromMap[to]) {
        const tokenId = this._tokenIdMap[to];
        res.push({ tokenId, from, to });
      }
    }
    return res;
  }

  isActivated(tokenId: string) {
    return !!this._activationMap[tokenId];
  }

  activate(tokenId: string) {
    this._activationMap[tokenId] = true;
  }

  register(invivation: Invitation) {
    const { tokenId, from, to } = invivation;
    // ゼロアドレスは考えない
    if (from === zeroAddress || to === zeroAddress) {
      return { registered: false, message: 'zero_address' };
    }
    // 完全重複のある招待は登録扱い
    if (this.findOne({ tokenId, to })) {
      return { registered: true };
    }
    // 使用済トークンIDは無効
    if (this.findOne({ tokenId })) {
      return { registered: false, message: 'tokenid_used' };
    }
    // 招待は重複できない
    if (this.findOne({ to })) {
      return { registered: false, message: 'duplicated_invitation' };
    }
    this._tokenIdMap[to] = tokenId;
    this._fromMap[to] = from;
    this._toMap[tokenId] = to;
    this._activationMap[tokenId] = false;
    return { registered: true };
  }

  array(): Invitation[] {
    const array: Invitation[] = [];
    for (const to in this._tokenIdMap) {
      const tokenId = this._tokenIdMap[to];
      const from = this._fromMap[to];
      array.push({ tokenId, from, to });
    }
    return array;
  }

  static from(invivations: Invitation[]) {
    const invitationMap = new InvivationMap();
    invivations.map((e) => invitationMap.register(e));
    return invitationMap;
  }
}

/**
 * 招待者が招待したプレイヤーの対戦回数の合計を返す。
 * なお、招待の集計は14日で対戦の集計は7日である。
 * @param invivations 前回のレスポンスのinvivationsを渡すと、重複した招待をブロックできる。
 * @returns
 */
export const countInvitationBattles = async (invivations: Invitation[]) => {
  const invitationMap = InvivationMap.from(invivations);
  const currentUnixTime = Math.floor(new Date().getTime() / 1e3);
  // 14 days before
  const startInvivationDateUnix = currentUnixTime - 14 * 24 * 60 * 60;
  // 7 days before
  const startGameDateUnix = currentUnixTime - 7 * 24 * 60 * 60;
  const [invivationLogs, gameLogs] = await Promise.all([
    getInvivationTransferLogs(startInvivationDateUnix, currentUnixTime),
    getGameRevealedLogs(startGameDateUnix, currentUnixTime),
  ]);
  for (const {
    from,
    to,
    tokenId: { hex: tokenId },
  } of invivationLogs) {
    const { registered } = invitationMap.register({ tokenId, from, to });
    if (registered) {
      invitationMap.activate(tokenId);
    }
  }
  const battleMap: { [from: string]: number } = {};
  const battles: { address: string; battles: number }[] = [];
  for (const { maker, challenger } of gameLogs) {
    const invitations = [
      invitationMap.findOne({ to: maker }),
      invitationMap.findOne({ to: challenger }),
    ];
    for (const invitation of invitations) {
      if (invitation && invitationMap.isActivated(invitation.tokenId)) {
        if (battleMap[invitation.from]) {
          battleMap[invitation.from]++;
        } else {
          battleMap[invitation.from] = 1;
        }
      }
    }
  }
  for (const address in battleMap) {
    battles.push({ address, battles: battleMap[address] });
  }
  return { invivations: invitationMap.array(), battles };
};
// 以下コメントを外して動作
// calcLatest7DaysResult()
//   .then((res) => console.log(res));
// countInvitationBattles([])
//   .then((res) => console.log(res));
