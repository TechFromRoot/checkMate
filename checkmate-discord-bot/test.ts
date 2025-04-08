import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  Client,
  Message,
} from 'discord.js';

// Type definition for token data
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
  freezeAuthority?: string | null;
  mintAuthority?: string | null;
  fileMeta?: { image?: string };
}

// Main message handler
export const handleRecievedMessages = async (
  message: Message,
  client: Client,
  httpService,
  logger,
) => {
  console.log('Received message:', message.content);

  if (message.author.id === process.env.DISCORD_BOT_ID) return;

  const regex = /\b[1-9A-HJ-NP-Za-km-z]{43,44}\b/;
  const match = message.content.match(regex);
  if (!match) return;

  const tokenAddress = match[0];
  console.log('Found address:', tokenAddress);

  try {
    const response = await httpService.axiosRef.get(
      `https://api.rugcheck.xyz/v1/tokens/${tokenAddress}/report`,
    );
    if (response.data.error) return;

    const tokenDetail: TokenData = response.data;
    console.log('Token data:', tokenDetail);

    const channel = client.channels.cache.get(message.channelId);
    if (!channel?.isTextBased()) return;

    await (channel as TextChannel).sendTyping();

    const embed = buildTokenEmbed(tokenDetail);
    const components = buildButtonComponents(tokenAddress);
    await message.reply({ embeds: [embed], components });
  } catch (error) {
    console.error('Error processing token data:', error);
    logger.warn(error);
  }
};

// Build the Discord embed with token details
const buildTokenEmbed = (token: TokenData): EmbedBuilder => {
  const normalizedScore =
    token.score_normalised !== undefined
      ? token.score_normalised
      : token.score
        ? Math.min(Math.round((token.score / 118101) * 100), 100)
        : undefined;

  let riskLevel = '';
  let riskEmoji = '';
  let embedColor = '#00FF00';
  if (normalizedScore !== undefined) {
    if (normalizedScore >= 70) {
      riskLevel = 'Good';
      riskEmoji = '🟢';
      embedColor = '#00FF00';
    } else if (normalizedScore >= 30) {
      riskLevel = 'Medium';
      riskEmoji = '🟡';
      embedColor = '#FFFF00';
    } else {
      riskLevel = 'Bad';
      riskEmoji = '🔴';
      embedColor = '#FF0000';
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`${token.tokenMeta.name} (${token.tokenMeta.symbol})`)
    .setDescription(`**Contract Address:** \`${token.mint}\``)
    .setColor(embedColor)
    .setTimestamp();

  if (token.fileMeta?.image) {
    embed.setThumbnail(token.fileMeta.image);
  }

  // Token Overview
  const overviewFields: string[] = [];
  if (token.token.supply)
    overviewFields.push(
      `**Supply:** ${formatNumber(token.token.supply / 10 ** token.token.decimals)}`,
    );
  if (token.creator)
    overviewFields.push(`**Creator:** \`${shortenAddress(token.creator)}\``);
  if (token.price) overviewFields.push(`**Price:** $${token.price.toFixed(8)}`);
  if (token.price && token.token.supply)
    overviewFields.push(
      `**Market Cap:** $${formatNumber(token.price * (token.token.supply / 10 ** token.token.decimals))}`,
    );
  if (token.totalHolders)
    overviewFields.push(`**Holders:** ${token.totalHolders}`);
  if (token.totalMarketLiquidity)
    overviewFields.push(
      `**Liquidity:** $${formatNumber(token.totalMarketLiquidity)}`,
    );
  if (typeof token.rugged === 'boolean')
    overviewFields.push(`**Rugged:** ${token.rugged ? 'Yes' : 'No'}`);
  if (overviewFields.length > 0) {
    embed.addFields({
      name: 'Token Overview',
      value: overviewFields.join('\n'),
      inline: false,
    });
  }

  // Risk Analysis
  if (normalizedScore !== undefined || token.risks?.length) {
    const riskFields: string[] = [];
    if (normalizedScore !== undefined) {
      riskFields.push(
        `**Score:** ${normalizedScore}/100 (${riskEmoji} ${riskLevel})`,
      );
    }
    if (token.risks?.length) {
      riskFields.push('**Risks Detected:**');
      riskFields.push(
        ...token.risks.map((r) => `- ${r.name}: ${r.description} (${r.level})`),
      );
    }
    embed.addFields({
      name: 'Risk Analysis',
      value: riskFields.join('\n'),
      inline: false,
    });
  }

  // Holder Concentration (Top 3 with amount, pct, and insider status)
  if (token.topHolders?.length) {
    const topHoldersText = token.topHolders
      .slice(0, 3)
      .map((h) => {
        const amount = formatNumber(h.amount / 10 ** token.token.decimals);
        const insiderTag = h.insider ? ' (Insider)' : '';
        return `- \`${shortenAddress(h.owner)}\`: ${amount} (${h.pct.toFixed(2)}%)${insiderTag}`;
      })
      .join('\n');
    embed.addFields({
      name: 'Holder Concentration',
      value: `**Top 3 Holders:**\n${topHoldersText}`,
      inline: false,
    });
  }

  // Insider Analysis
  if (token.insiderNetworks?.length) {
    const insider = token.insiderNetworks[0];
    const insiderPct = (
      (insider.tokenAmount / token.token.supply) *
      100
    ).toFixed(2);
    const networkId = insider.id ? ` (${insider.id})` : '';
    embed.addFields({
      name: 'Insider Analysis',
      value: `Network sent ${insiderPct}% of the supply to ${insider.size} wallets${networkId}`,
      inline: false,
    });
  }

  // Authorities
  const authorityFields = [];
  if (token.freezeAuthority !== undefined) {
    authorityFields.push({
      name: 'Freeze Authority',
      value: token.freezeAuthority ? 'Enabled' : 'Disabled',
      inline: true,
    });
  }
  if (token.mintAuthority !== undefined) {
    authorityFields.push({
      name: 'Mint Authority',
      value: token.mintAuthority ? 'Enabled' : 'Disabled',
      inline: true,
    });
  }
  if (authorityFields.length > 0) {
    embed.addFields(...authorityFields);
  }

  return embed;
};

// Build interactive buttons
const buildButtonComponents = (
  tokenAddress: string,
): ActionRowBuilder<ButtonBuilder>[] => {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('upvote')
      .setEmoji('🚀')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('downvote')
      .setEmoji('💩')
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('track_insiders')
      .setLabel('Track Insiders')
      .setEmoji('🕵️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('track_holders')
      .setLabel('Track Holders')
      .setEmoji('👥')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('track_creator')
      .setLabel('Track Creator')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setURL(`https://rugcheck.xyz/tokens/${tokenAddress}`)
      .setLabel('rugcheck.xyz')
      .setStyle(ButtonStyle.Link),
  );

  return [row1, row2, row3];
};

// Utility to format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

// Utility to shorten addresses
const shortenAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Example interaction handler for button clicks (add this to your bot setup)
export const setupButtonInteractions = (client: Client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const user = interaction.user;

    if (interaction.customId === 'track_insiders') {
      const message = interaction.message as Message;
      const embed = message.embeds[0];
      const tokenData = JSON.parse(embed.footer?.text || '{}'); // Store token data in footer if needed
      const insiderWallets = tokenData.insiderNetworks?.[0]?.wallets || [];

      if (insiderWallets.length === 0) {
        await interaction.reply({
          content: 'No insider wallets available.',
          ephemeral: true,
        });
        return;
      }

      const dmEmbed = new EmbedBuilder()
        .setTitle('Insider Wallets Tracking')
        .setDescription(
          'Here are the insider wallets. Reply with the number to track one, or "all" to track all.',
        )
        .addFields({
          name: 'Wallets',
          value: insiderWallets.map((w, i) => `${i + 1}. \`${w}\``).join('\n'),
          inline: false,
        })
        .setColor('#00FF00');

      await user.send({ embeds: [dmEmbed] });
      await interaction.reply({
        content: 'Check your DMs for insider wallet details!',
        ephemeral: true,
      });
    }

    // Add similar handlers for 'track_holders' and 'track_creator' as needed
  });
};
