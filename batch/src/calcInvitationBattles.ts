import { zeroAddress } from 'viem';
import { getGameRevealedLogs, getInvivationTransferLogs } from './batch';
import { getFileFromS3, uploadS3 } from './utils/s3';

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
    if (from === to) {
      return { registered: false, message: 'same_address' };
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

export const handler = async () => {
  try {
    const lastFile = await getFileFromS3('calcInvitationBattles/result.json');
    const lastInvitations: Invitation[] = lastFile ? lastFile.invivations : [];
  
    const invitationMap = InvivationMap.from(lastInvitations);
    const currentUnixTime = Math.floor(new Date().getTime() / 1e3);
  
    const startInvivationDateUnix = currentUnixTime - 14 * 24 * 60 * 60;
    const startGameDateUnix = currentUnixTime - 7 * 24 * 60 * 60;
  
    const [invivationLogs, gameLogs] = await Promise.all([
      getInvivationTransferLogs(startInvivationDateUnix, currentUnixTime),
      getGameRevealedLogs(startGameDateUnix, currentUnixTime),
    ]);
  
    for (const { data: {
      from,
      to,
      tokenId: { hex: tokenId },
    }} of invivationLogs) {
      const { registered } = invitationMap.register({
        tokenId,
        from: from.toLowerCase(),
        to: to.toLowerCase(),
      });
      if (registered) {
        invitationMap.activate(tokenId);
      }
    }
  
    const battleMap: { [from: string]: number } = {};
    const battles: { address: string; battles: number }[] = [];
  
    for (const { data: { maker, challenger } } of gameLogs) {
      const invitations = [
        invitationMap.findOne({ to: maker.toLowerCase() }),
        invitationMap.findOne({ to: challenger.toLowerCase() }),
      ];
      for (const invitation of invitations) {
        if (invitation && invitationMap.isActivated(invitation.tokenId)) {
          if (battleMap[invitation.from.toLowerCase()]) {
            battleMap[invitation.from.toLowerCase()]++;
          } else {
            battleMap[invitation.from.toLowerCase()] = 1;
          }
        }
      }
    }
  
    for (const address in battleMap) {
      battles.push({
        address: address.toLowerCase(),
        battles: battleMap[address.toLowerCase()],
      });
    }
  
    await uploadS3(
      { invivations: invitationMap.array(), battles, updatedAt: currentUnixTime },
      'calcInvitationBattles/result.json',
    );
  } catch (error) {
    // ToDo: Discord webhook
    console.log(error);
  }
};
