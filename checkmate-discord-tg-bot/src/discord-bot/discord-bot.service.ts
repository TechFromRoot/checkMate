import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TextChannel,
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  ColorResolvable,
  MessageFlags,
  ButtonComponent,
} from 'discord.js';
import * as dotenv from 'dotenv';
import { User } from 'src/database/schemas/user.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { RugcheckService } from 'src/rugcheck/rugcheck.service';
dotenv.config();

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

interface VoteData {
  up: number;
  down: number;
  userVoted: boolean;
}

const token = process.env.DISCORD_TOKEN;

@Injectable()
export class DiscordBotService {
  private readonly logger = new Logger(DiscordBotService.name);
  private readonly client: Client;

  constructor(
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
    private readonly rugCheckService: RugcheckService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {
    this.client = new Client({
      intents: ['Guilds', 'GuildMessages', 'DirectMessages', 'MessageContent'],
    });
    this.client.login(token);
    this.client.once('ready', this.onReady);
    this.client.on('warn', this.onWarn);
    this.client.on('messageCreate', this.handleRecievedMessages);
    this.client.on('interactionCreate', this.handleInteraction);
  }

  onReady = async () => {
    this.logger.log(`Bot logged in as ${this.client.user?.username}`);
  };

  onWarn = async (message) => {
    this.logger.warn(message);
  };

  handleRecievedMessages = async (message: Message) => {
    // console.log(message);
    if (message.author.id === process.env.DISCORD_BOT_ID) return;

    const regex = /\b[1-9A-HJ-NP-Za-km-z]{43,44}\b/;
    // console.log('message content:', message.content);
    const match = message.content.match(regex);
    if (!match) return;

    // console.log('Found address:', match[0]);
    try {
      const data = await this.rugCheckService.getTokenReport$Vote(match[0]);

      // console.log(data.tokenDetail);
      // console.log(data.tokenVotes);

      const channel = this.client.channels.cache.get(message.channelId);
      if (!channel?.isTextBased()) return;

      await (channel as TextChannel).sendTyping();

      const embed = this.buildTokenEmbed(data.tokenDetail, data.tokenVotes);
      const components = this.buildButtonComponents(
        data.tokenDetail.mint,
        data.tokenVotes,
      );

      await message.reply({ embeds: [embed], components });
    } catch (error) {
      console.error(error);
      this.logger.warn(error);
    }
  };

  buildTokenEmbed = (token: TokenData, tokenVote: VoteData): EmbedBuilder => {
    const normalizedScore =
      token.score_normalised !== undefined
        ? token.score_normalised
        : token.score
          ? Math.min(Math.round((token.score / 118101) * 100), 100)
          : undefined;

    let riskLevel = '';
    let riskEmoji = '';
    let embedColor: ColorResolvable = '#00FF00';
    if (normalizedScore !== undefined) {
      if (normalizedScore >= 70) {
        riskLevel = 'Bad';
        riskEmoji = '🔴';
        embedColor = '#00FF00';
      } else if (normalizedScore >= 30) {
        riskLevel = 'Medium';
        riskEmoji = '🟡';
        embedColor = '#FFFF00';
      } else {
        riskLevel = 'Good';
        riskEmoji = '🟢';
        embedColor = '#FF0000';
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`${token.tokenMeta.name} (${token.tokenMeta.symbol})`)
      .setDescription(`**Mint:** \`${token.mint}\``)
      .setColor(embedColor)
      .setTimestamp();

    if (token.fileMeta?.image) {
      embed.setThumbnail(token.fileMeta.image);
    }

    // Token Overview
    const overviewFields: string[] = [];
    if (token.token.supply)
      overviewFields.push(
        `**Supply:** ${this.formatNumber(token.token.supply / 10 ** token.token.decimals)}`,
      );
    if (token.creator) overviewFields.push(`**Creator:** \`${token.creator}\``);
    if (token.price)
      overviewFields.push(`**Price:** $${this.formatPrice(token.price)}`);
    if (token.price && token.token.supply)
      overviewFields.push(
        `**Market Cap:** $${this.formatNumber(token.price * (token.token.supply / 10 ** token.token.decimals))}`,
      );
    if (token.totalHolders)
      overviewFields.push(`**Holders:** ${token.totalHolders}`);
    if (token.totalMarketLiquidity)
      overviewFields.push(
        `**Liquidity:** $${this.formatNumber(token.totalMarketLiquidity)}`,
      );
    if (typeof token.rugged === 'boolean')
      overviewFields.push(`**Rugged:** ${token.rugged ? 'Yes' : 'No'}`);
    if (overviewFields.length > 0) {
      const overviewValue = overviewFields.join('\n');
      if (overviewValue.length > 1024) {
        embed.addFields({
          name: `***Token Overview***`,
          value: overviewValue.substring(0, 1021) + '...',
          inline: false,
        });
      } else {
        embed.addFields({
          name: 'Token Overview',
          value: overviewValue,
          inline: false,
        });
      }
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
        const risksText = token.risks
          .map((r) => `- ${r.name}: ${r.description} (${r.level})`)
          .join('\n');
        riskFields.push(
          risksText.length > 900
            ? risksText.substring(0, 897) + '...'
            : risksText,
        );
      }
      const riskValue = riskFields.join('\n');
      if (riskValue.length > 1024) {
        embed.addFields({
          name: 'Risk Analysis',
          value: riskValue.substring(0, 1021) + '...',
          inline: false,
        });
      } else {
        embed.addFields({
          name: 'Risk Analysis',
          value: riskValue,
          inline: false,
        });
      }
    }

    // Holder Concentration (Top 3 with amount, pct, and insider status)
    if (token.topHolders?.length) {
      const topHoldersText = token.topHolders
        .slice(0, 3)
        .map((h) => {
          const amount = this.formatNumber(
            h.amount / 10 ** token.token.decimals,
          );
          const insiderTag = h.insider ? ' (Insider)' : '';
          return `- \`${this.shortenAddress(h.owner)}\`: ${amount} (${h.pct.toFixed(2)}%)${insiderTag}`;
        })
        .join('\n');
      if (topHoldersText.length > 1024) {
        embed.addFields({
          name: 'Holder Concentration',
          value: `**Top 3 Holders:**\n${topHoldersText.substring(0, 1021) + '...'}`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: 'Holder Concentration',
          value: `**Top 3 Holders:**\n${topHoldersText}`,
          inline: false,
        });
      }
    }

    // Insider Analysis
    if (token.insiderNetworks?.length) {
      // const insiderPct = token.insiderNetworks
      //   .reduce((sum, insider) => {
      //     return sum + (insider.tokenAmount / token.token.supply) * 100;
      //   }, 0)
      //   .toFixed(2);
      const { insiderPct, totalWallet } = token.insiderNetworks.reduce(
        (acc, insider) => {
          if (insider['type'] === 'transfer') {
            acc.totalWallet += insider.size;
            acc.insiderPct += (insider.tokenAmount / token.token.supply) * 100;
          }
          return acc;
        },
        { insiderPct: 0, totalWallet: 0 },
      );

      // Format the insider percentage
      const formattedInsiderPct = insiderPct.toFixed(2);

      const insiderText = `${formattedInsiderPct}% of supply sent to ${totalWallet} wallets`;
      if (insiderText.length > 1024) {
        embed.addFields({
          name: 'Insider Analysis',
          value: insiderText.substring(0, 1021) + '...',
          inline: false,
        });
      } else {
        embed.addFields({
          name: 'Insider Analysis',
          value: insiderText,
          inline: false,
        });
      }
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

    // Community Sentiment
    if (tokenVote) {
      embed.addFields({
        name: 'Community Sentiment',
        value: `Upvote - ${tokenVote.up} 🚀\nDownVote - ${tokenVote.down} 💩`,
        inline: false,
      });
    }
    // Set footer with only the mint address to keep it small
    embed.setFooter({
      text: `Mint: ${token.mint}`,
    });

    // Check total embed length
    const totalLength = embed.length;
    if (totalLength > 6000) {
      this.logger.warn(
        `Embed for ${token.mint} exceeds 6000 characters (${totalLength}). Truncating fields.`,
      );
      const fields = embed.data.fields || [];
      const riskField = fields.find((f) => f.name === 'Risk Analysis');
      if (riskField && riskField.value.length > 500) {
        riskField.value = riskField.value.substring(0, 497) + '...';
      }
    }

    return embed;
  };

  buildButtonComponents = (
    tokenAddress: string,
    tokenVote: VoteData,
  ): ActionRowBuilder<ButtonBuilder>[] => {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('upvote')
        .setLabel(`${tokenVote.up}`)
        .setEmoji('🚀')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('downvote')
        .setLabel(`${tokenVote.down}`)
        .setEmoji('💩')
        .setStyle(ButtonStyle.Danger),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setURL(
          `https://fluxbeam.xyz/${tokenAddress}?chain=solana&utm_source=rugcheck`,
        )
        .setEmoji('📈')
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setURL(
          `https://solana.fm/address/${tokenAddress}?cluster=mainnet-alpha`,
        )
        .setEmoji('🔎')
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setURL(`https://t.me/fluxbeam_bot?start=ca-${tokenAddress}`)
        .setLabel('Trade')
        .setEmoji('🤖')
        .setStyle(ButtonStyle.Link),
    );

    // const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    //   // new ButtonBuilder()
    //   //   .setCustomId('track_insiders')
    //   //   .setLabel('Track Insiders')
    //   //   .setEmoji('🕵️')
    //   //   .setStyle(ButtonStyle.Primary),
    //   // new ButtonBuilder()
    //   //   .setCustomId('track_holders')
    //   //   .setLabel('Track Holders')
    //   //   .setEmoji('👥')
    //   //   .setStyle(ButtonStyle.Primary),
    //   // new ButtonBuilder()
    //   //   .setCustomId('track_creator')
    //   //   .setLabel('Track Creator')
    //   //   .setEmoji('👤')
    //   //   .setStyle(ButtonStyle.Primary),
    // );

    const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('refresh')
        .setLabel('Refresh')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setURL(`https://rugcheck.xyz/tokens/${tokenAddress}`)
        .setLabel('rugcheck.xyz')
        .setStyle(ButtonStyle.Link),

      new ButtonBuilder()
        .setURL(`${process.env.BOT_URL}?start=ca-${tokenAddress}`)
        .setLabel('Track Creator')
        .setEmoji('👤')
        .setStyle(ButtonStyle.Link),
    );

    return [row1, row2, row4];
  };

  handleInteraction = async (interaction) => {
    // console.log(interaction);
    if (!interaction.isButton()) return;

    const user = interaction.user;

    // console.log('user  :', user.id);

    switch (interaction.customId) {
      case 'upvote':
        try {
          const embed = interaction.message.embeds[0];
          // Defer the interaction to allow more time for the API call
          await interaction.deferUpdate();

          const userExist = await this.findOrCreateUserWallet(
            user.id,
            'discord',
          );

          if (userExist) {
            const encryptedSVMWallet =
              await this.walletService.decryptSVMWallet(
                `${process.env.DEFAULT_WALLET_PIN}`,
                userExist.svmWalletDetails,
              );
            const { token } = await this.rugCheckService.signLoginPayload(
              encryptedSVMWallet.privateKey,
            );
            const address = this.extractAddress(embed);

            if (token && address) {
              const vote = await this.rugCheckService.voteOnToken(
                token,
                address,
                true,
              );
              if (!vote) {
                await interaction.followUp({
                  content: 'there was an error up voting the token',
                  flags: MessageFlags.Ephemeral,
                });
                return;
              } else {
                if (vote.hasVote) {
                  await interaction.followUp({
                    content: 'You already voted this token',
                    flags: MessageFlags.Ephemeral,
                  });
                  return;
                }
                await this.refreshEmbed(interaction, address);
                await interaction.followUp({
                  content: 'You upvoted the token!',
                  flags: MessageFlags.Ephemeral,
                });
                return;
              }
            }
          }

          break;
        } catch (error) {
          console.error('Upvote case error:', error);
          await interaction.followUp({
            content: 'Failed to Upvote  An error occurred.',
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

      case 'downvote':
        try {
          const embed = interaction.message.embeds[0];
          // Defer the interaction to allow more time for the API call
          await interaction.deferUpdate();

          const userExist = await this.findOrCreateUserWallet(
            user.id,
            'discord',
          );

          if (userExist) {
            const encryptedSVMWallet =
              await this.walletService.decryptSVMWallet(
                `${process.env.DEFAULT_WALLET_PIN}`,
                userExist.svmWalletDetails,
              );
            const { token } = await this.rugCheckService.signLoginPayload(
              encryptedSVMWallet.privateKey,
            );
            const address = this.extractAddress(embed);

            if (token && address) {
              const vote = await this.rugCheckService.voteOnToken(
                token,
                address,
                false,
              );
              if (!vote) {
                await interaction.followUp({
                  content: 'there was an error up voting the token',
                  flags: MessageFlags.Ephemeral,
                });
                return;
              } else {
                if (vote.hasVote) {
                  await interaction.followUp({
                    content: 'You already voted this token',
                    flags: MessageFlags.Ephemeral,
                  });
                  return;
                }
                await this.refreshEmbed(interaction, address);
                await interaction.followUp({
                  content: 'You downvoted the token!',
                  flags: MessageFlags.Ephemeral,
                });
                return;
              }
            }
          }

          break;
        } catch (error) {
          console.error('downvote case error:', error);
          await interaction.followUp({
            content: 'Failed to down vote  An error occurred.',
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

      case 'refresh':
        try {
          const embed = interaction.message.embeds[0];
          const tokenAddressMatch = embed.description?.match(
            /\*\*Contract Address:\*\* `([^`]+)`/,
          );

          let tokenAddress: string;
          if (tokenAddressMatch && tokenAddressMatch[1]) {
            tokenAddress = tokenAddressMatch[1];
          } else {
            const footerText = embed.footer?.text || '';
            const mintMatch = footerText.match(/Mint: (.+)/);
            tokenAddress = mintMatch ? mintMatch[1] : '';
            if (!tokenAddress) {
              await interaction.reply({
                content: 'Unable to refresh: Token address not found.',
                flags: MessageFlags.Ephemeral,
              });
              return;
            }
            // Disable the "Refresh" button
            const currentComponents = interaction.message.components;

            const disabledComponents =
              this.disableRefreshButton(currentComponents);

            await interaction.update({
              content: interaction.message.content,
              embeds: [embed],
              components: disabledComponents,
            });

            // Defer the interaction to allow more time for the API call
            // await interaction.deferUpdate();

            await this.refreshEmbed(interaction, tokenAddress);
            return;
          }
          break;
        } catch (error) {
          console.error('Refresh case error:', error);
          await interaction.followUp({
            content: 'Failed to refresh: An error occurred.',
            flags: MessageFlags.Ephemeral,
          });
          break;
        }
      case 'track_creator':
        await interaction.reply({
          content: 'Tracking creator feature coming soon!',
          ephemeral: true,
        });
        break;
      default:
        await interaction.reply({
          content: 'Button clicked!',
          flags: MessageFlags.Ephemeral,
        });
    }
  };

  private async refreshEmbed(
    interaction: any,
    tokenAddress: string,
  ): Promise<void> {
    let data;
    try {
      data = await this.rugCheckService.getTokenReport$Vote(tokenAddress);
      if (!data.tokenDetail || !data.tokenVotes) {
        // Re-enable the button and keep the current embed on API error
        const currentEmbed = interaction.message.embeds[0];

        const reEnabledComponents = this.buildButtonComponents(tokenAddress, {
          up: data?.tokenVotes?.up || 0,
          down: data?.tokenVotes?.down || 0,
          userVoted: false,
        });
        await interaction.editReply({
          content: null,
          embeds: [currentEmbed],
          components: reEnabledComponents,
        });
        await interaction.followUp({
          content: 'Failed to refresh',
          ephemeral: true,
        });
        return;
      }

      const newEmbed = this.buildTokenEmbed(data.tokenDetail, data.tokenVotes);
      const newComponents = this.buildButtonComponents(
        data.tokenDetail.mint,
        data.tokenVotes,
      );

      await interaction.editReply({
        content: null,
        embeds: [newEmbed],
        components: newComponents, // Re-enables the button
      });
    } catch (error) {
      console.error('Refresh error:', error);
      // Re-enable the button and keep the current embed on general error
      const currentEmbed = interaction.message.embeds[0];
      const reEnabledComponents = this.buildButtonComponents(tokenAddress, {
        up: data?.tokenVotes?.up || 0,
        down: data?.tokenVotes?.down || 0,
        userVoted: false,
      });
      await interaction.editReply({
        content: null,
        embeds: [currentEmbed],
        components: reEnabledComponents,
      });
      await interaction.followUp({
        content: 'Failed to refresh: An error occurred.',
        ephemeral: true,
      });
    }
  }

  private disableRefreshButton(
    components: any[],
  ): ActionRowBuilder<ButtonBuilder>[] {
    const newComponents = components.map((row) => {
      const actionRow = ActionRowBuilder.from(
        row,
      ) as ActionRowBuilder<ButtonBuilder>;
      const updatedButtons = actionRow.components.map((component) => {
        const button = ButtonBuilder.from(
          component as unknown as ButtonComponent,
        );
        const customId = (button.data as { customId?: string }).customId;
        if (customId === 'refresh') {
          button.setDisabled(true);
        }
        return button;
      });
      actionRow.setComponents(updatedButtons);
      return actionRow;
    });
    return newComponents as ActionRowBuilder<ButtonBuilder>[];
  }

  async findOrCreateUserWallet(
    userId: number,
    platform: 'discord' | 'telegram',
  ): Promise<{ svmWalletAddress: string; svmWalletDetails: string }> {
    let user = await this.userModel.findOne({ userId, platform });

    if (!user) {
      const newSVMWallet = await this.walletService.createSVMWallet();
      const [encryptedSVMWalletDetails] = await Promise.all([
        this.walletService.encryptSVMWallet(
          process.env.DEFAULT_WALLET_PIN!,
          newSVMWallet.privateKey,
        ),
      ]);
      user = new this.userModel({
        userId,
        platform,
        svmWalletAddress: newSVMWallet.address,
        svmWalletDetails: encryptedSVMWalletDetails.json,
      });

      await user.save();
    }

    return {
      svmWalletAddress: user.svmWalletAddress,
      svmWalletDetails: user.svmWalletDetails,
    };
  }

  private extractAddress = (embed: any): string => {
    const tokenAddressMatch = embed.description?.match(
      /\*\*Contract Address:\*\* `([^`]+)`/,
    );

    let tokenAddress: string;
    if (tokenAddressMatch && tokenAddressMatch[1]) {
      tokenAddress = tokenAddressMatch[1];
      return tokenAddress;
    } else {
      const footerText = embed.footer?.text || '';
      const mintMatch = footerText.match(/Mint: (.+)/);
      tokenAddress = mintMatch ? mintMatch[1] : '';
      if (!tokenAddress) {
        return null;
      }
      return tokenAddress;
    }
  };

  // Utility to format large numbers
  private formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  private formatPrice = (price: number): string => {
    if (price === 0) return '0';
    if (price < 0.00000001) return `${price.toFixed(8)}(~< 0.00000001)`;
    return price.toFixed(8);
  };

  // Utility to shorten addresses
  private shortenAddress = (address: string): string => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
}
