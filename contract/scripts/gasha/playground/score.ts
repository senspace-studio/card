import { appendFileSync } from 'fs';

type Role = 'Maker' | 'Challenger';

interface Match {
  role: Role;
  daysElapsed: number;
  result: 'win' | 'lose' | 'draw';
  winCard: number;
  opponent: string;
}

const calculateContribution = (matches: Match[]) => {
  const maxDays = 4; // 最大経過日数

  function roleMultiplier(role: Role): number {
    return role === 'Maker' ? 1.2 : 1.0;
  }

  function resultMultiplier(result: 'win' | 'draw' | 'lose'): number {
    return result === 'draw' ? 0.2 : 1;
  }

  function winCardMultiplier(winCard: number): number {
    return 1.989904;
  }

  function decay(daysElapsed: number): number {
    return Math.max(0, 1 - 0.25 * (daysElapsed - 1));
  }

  function matchCountMultiplier(totalMatches: number): number {
    if (totalMatches <= 50) {
      return 1 + totalMatches / 50;
    } else {
      return Math.min(2 + (totalMatches - 50) / 50, 3);
    }
  }

  function diversityMultiplier(uniqueOpponents: number): number {
    if (uniqueOpponents < 5) {
      return 1;
    } else if (uniqueOpponents <= 50) {
      return 1 + (uniqueOpponents - 5) * (4 / 45);
    } else {
      return 5;
    }
  }

  const recentMatches = matches.filter((match) => match.daysElapsed <= maxDays);
  const totalRecentMatches = recentMatches.length;
  const matchCountBonus = matchCountMultiplier(totalRecentMatches);

  const uniqueOpponents = new Set(recentMatches.map((match) => match.opponent))
    .size;
  const diversityBonus = diversityMultiplier(uniqueOpponents);

  const totalContribution = recentMatches.reduce((total, match) => {
    const R = roleMultiplier(match.role);
    const Res = resultMultiplier(match.result);
    const D = decay(match.daysElapsed);
    const W = match.result == 'win' ? winCardMultiplier(match.winCard) : 1;
    const contribution = R * Res * D * W;
    return total + contribution;
  }, 0);

  return totalContribution * matchCountBonus * diversityBonus;
};

interface Play {
  playCount: number;
  daysElapsed: number;
}

const calculateInviteScore = (plays: Play[]): number => {
  const maxDays = 14; // 最大経過日数
  const decayRate = 0.1; // 減衰率定数

  function decay(daysElapsed: number): number {
    if (daysElapsed > maxDays) {
      return 0;
    }
    return Math.exp(-decayRate * daysElapsed);
  }

  function playCountBonus(playCount: number): number {
    if (playCount <= 20) {
      return 1 + (playCount / 20) * 0.25;
    } else {
      return 1.25 + 1.75 * (1 - Math.exp(-0.1 * (playCount - 20)));
    }
  }

  const totalDecayScore = plays.reduce((total, play) => {
    const decayScore = play.playCount * decay(play.daysElapsed);
    return total + decayScore;
  }, 0);

  const totalPlayCount = plays.reduce(
    (total, play) => total + play.playCount,
    0,
  );

  const bonus = playCountBonus(totalPlayCount);

  return totalDecayScore * bonus;
};

const main = () => {
  const matches: Match[] = [
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x1',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x2',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x3',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x4',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x5',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x6',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x7',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x8',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x9',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x10',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x11',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x12',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x13',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x14',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x15',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x16',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x17',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x18',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x19',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x20',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x21',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x22',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x23',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x24',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x25',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x26',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x27',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x28',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x29',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x30',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x31',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x32',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x33',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x34',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x35',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x36',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x37',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x38',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x39',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x40',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x41',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x42',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x43',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x44',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x45',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x46',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x47',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x48',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x49',
    },
    {
      role: 'Maker',
      daysElapsed: 0,
      result: 'lose',
      winCard: 1,
      opponent: '0x50',
    },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x51',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x52',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x53',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x54',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x55',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x56',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x57',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x58',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x59',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x60',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x61',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x62',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x63',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x64',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x65',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x66',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x67',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x68',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x69',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x70',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x71',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x72',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x73',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x74',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x75',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x76',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x77',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x78',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x79',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x80',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x81',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x82',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x83',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x84',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x85',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x86',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x87',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x88',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x89',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x90',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x91',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x92',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x93',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x94',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x95',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x96',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x97',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x98',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x99',
    // },
    // {
    //   role: 'Maker',
    //   daysElapsed: 0,
    //   result: 'lose',
    //   winCard: 1,
    //   opponent: '0x100',
    // },
  ];

  const plays: Play[] = [
    {
      playCount: 50,
      daysElapsed: 0,
    },
    {
      playCount: 50,
      daysElapsed: 0,
    },
  ];

  const contribution = calculateContribution(matches);
  const inviteScore = calculateInviteScore(plays);

  console.log(contribution + inviteScore);
};

main();
