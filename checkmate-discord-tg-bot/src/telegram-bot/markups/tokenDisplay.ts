interface VoteData {
  up: number;
  down: number;
  userVoted: boolean;
}
interface TokenData {
  mint: string;
  tokenMeta: { name: string; symbol: string; uri?: string };
  token: { supply: number; decimals: number };
  creator: string;
  price?: number;
  totalHolders?: number;
  totalMarketLiquidity?: number;
  rugged?: boolean;
  score?: number;
  score_normalised?: number;
  risks?: { name: string; description: string; level: string }[];
  topHolders?: {
    pct: number;
    owner: string;
    amount: number;
    insider: boolean;
  }[];
  insiderNetworks?: {
    tokenAmount: number;
    size: number;
    id?: string;
    wallets?: string[];
  }[];
  graphInsidersDetected?: number;
  verification?: {
    mint: string;
    payer: string;
    name: string;
    symbol: string;
    description: string;
    jup_verified: boolean;
    jup_strict: boolean;
    links: string[];
  };
  freezeAuthority?: string | null;
  mintAuthority?: string | null;
  fileMeta?: { image?: string };
}

const shortenAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

export const tokenDisplayMarkup = async (
  token: TokenData,
  tokenVote: VoteData,
) => {
  const lines: string[] = [];

  // Title
  lines.push(`*${token.tokenMeta.name} (${token.tokenMeta.symbol})*`);

  // Description
  lines.push(`*Mint:* \`${token.mint}\``);

  // Token Overview
  const overviewFields: string[] = [];
  if (token.token.supply) {
    overviewFields.push(
      `*Supply:* ${formatNumber(token.token.supply / 10 ** token.token.decimals)}`,
    );
  }
  if (token.creator) {
    overviewFields.push(`*Creator:* \`${token.creator}\``);
  }
  if (token.price) {
    overviewFields.push(`*Price:* $${token.price.toFixed(8)}`);
  }
  if (token.price && token.token.supply) {
    overviewFields.push(
      `*Market Cap:* $${formatNumber(token.price * (token.token.supply / 10 ** token.token.decimals))}`,
    );
  }
  if (token.totalHolders) {
    overviewFields.push(`*Holders:* ${token.totalHolders}`);
  }
  if (token.totalMarketLiquidity) {
    overviewFields.push(
      `*Liquidity:* $${formatNumber(token.totalMarketLiquidity)}`,
    );
  }
  if (typeof token.rugged === 'boolean') {
    overviewFields.push(`*Rugged:* ${token.rugged ? 'Yes' : 'No'}`);
  }
  if (overviewFields.length > 0) {
    lines.push(`\n*Token Overview*`);
    lines.push(overviewFields.join('\n'));
  }

  // Risk Analysis
  const normalizedScore =
    token.score_normalised !== undefined
      ? token.score_normalised
      : token.score
        ? Math.min(Math.round((token.score / 118101) * 100), 100)
        : undefined;
  let riskLevel = '';
  let riskEmoji = '';
  if (normalizedScore !== undefined) {
    if (normalizedScore >= 70) {
      riskLevel = 'Bad';
      riskEmoji = '🔴';
    } else if (normalizedScore >= 30) {
      riskLevel = 'Medium';
      riskEmoji = '🟡';
    } else {
      riskLevel = 'Good';
      riskEmoji = '🟢';
    }
  }
  if (normalizedScore !== undefined || token.risks?.length) {
    const riskFields: string[] = [];
    if (normalizedScore !== undefined) {
      riskFields.push(
        `*Score:* ${normalizedScore}/100 (${riskEmoji} ${riskLevel})`,
      );
    }
    if (token.risks?.length) {
      riskFields.push('*Risks Detected:*');
      const risksText = token.risks
        .map((r) => `- ${r.name}: ${r.description} (${r.level})`)
        .join('\n');
      riskFields.push(
        risksText.length > 900
          ? risksText.substring(0, 897) + '...'
          : risksText,
      );
    }
    lines.push(`\n*Risk Analysis*`);
    lines.push(riskFields.join('\n'));
  }

  // Holder Concentration
  if (token.topHolders?.length) {
    const topHoldersText = token.topHolders
      .slice(0, 3)
      .map((h) => {
        const amount = formatNumber(h.amount / 10 ** token.token.decimals);
        const insiderTag = h.insider ? ' (Insider)' : '';
        return `- \`${shortenAddress(h.owner)}\`: ${amount} (${h.pct.toFixed(2)}%)${insiderTag}`;
      })
      .join('\n');
    lines.push(`\n*Holder Concentration*`);
    lines.push(`*Top 3 Holders:*`);
    lines.push(topHoldersText);
  }

  // Insider Analysis
  if (token.insiderNetworks?.length) {
    const { insiderPct, totalWallet } = token.insiderNetworks.reduce(
      (acc, insider) => {
        if (insider['type'] === 'transfer') {
          // Assuming 'type' might be present; adjust if not
          acc.totalWallet += insider.size;
          acc.insiderPct += (insider.tokenAmount / token.token.supply) * 100;
        }
        return acc;
      },
      { insiderPct: 0, totalWallet: 0 },
    );
    const insiderText = `${insiderPct.toFixed(2)}% of supply sent to ${totalWallet} wallets`;
    lines.push(`\n*Insider Analysis*`);
    lines.push(insiderText);
  }
  if (token.graphInsidersDetected !== undefined) {
    lines.push(`*Graph Insiders Detected:* ${token.graphInsidersDetected}`);
  }

  // Verification
  if (token.verification) {
    const verificationFields: string[] = [];
    if (token.verification.description) {
      verificationFields.push(
        `*Description:* ${token.verification.description}`,
      );
    }
    verificationFields.push(
      `*Jupiter Verified:* ${token.verification.jup_verified ? 'Yes' : 'No'}`,
    );
    verificationFields.push(
      `*Jupiter Strict:* ${token.verification.jup_strict ? 'Yes' : 'No'}`,
    );
    if (token.verification.links?.length) {
      verificationFields.push(
        `*Links:* ${token.verification.links.join(', ')}`,
      );
    }
    lines.push(`\n*Verification*`);
    lines.push(verificationFields.join('\n'));
  }

  // Authorities
  const authorityFields: string[] = [];
  if (token.freezeAuthority !== undefined) {
    authorityFields.push(
      `*Freeze Authority:* ${token.freezeAuthority ? 'Enabled' : 'Disabled'}`,
    );
  }
  if (token.mintAuthority !== undefined) {
    authorityFields.push(
      `*Mint Authority:* ${token.mintAuthority ? 'Enabled' : 'Disabled'}`,
    );
  }
  if (authorityFields.length > 0) {
    lines.push(`\n*Authorities*`);
    lines.push(authorityFields.join('\n'));
  }

  // Community Sentiment
  if (tokenVote) {
    lines.push(`\n*Community Sentiment*`);
    lines.push(`Upvote - ${tokenVote.up} 🚀`);
    lines.push(`Downvote - ${tokenVote.down} 💩`);
  }

  // Truncate to Telegram’s 4096-character limit
  const fullMessage = lines.join('\n');

  return {
    message:
      fullMessage.length > 4096
        ? fullMessage.substring(0, 4093) + '...'
        : fullMessage,
    keyboard: [
      [
        {
          text: `Upvote (${tokenVote.up}) 🚀`,
          callback_data: JSON.stringify({
            c: `/upvote|${token.mint}`,
          }),
        },
        {
          text: `Downvote (${tokenVote.down}) 💩`,
          callback_data: JSON.stringify({
            c: `/downvote|${token.mint}`,
          }),
        },
      ],
      [
        {
          text: 'Trade 🤖',
          url: `https://t.me/fluxbeam_bot?start=ca-${token.mint}`,
        },
        {
          text: 'Track Creator 🕵️',
          url: `${process.env.BOT_URL}?start=ca-${token.mint}`,
        },
      ],
      [
        {
          text: 'Chart 📈',
          url: `https://fluxbeam.xyz/${token.mint}?chain=solana&utm_source=rugcheck`,
        },
        {
          text: 'Explorer 🔎',
          url: `https://solana.fm/address/${token.mint}?cluster=mainnet-alpha`,
        },
      ],
      [
        {
          text: 'Refresh 🔄',
          callback_data: JSON.stringify({
            c: `/refresh|${token.mint}`,
          }),
        },
      ],
    ],
  };
};
