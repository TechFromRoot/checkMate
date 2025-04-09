// import { HttpService } from '@nestjs/axios';
// import { Injectable, Logger } from '@nestjs/common';
// import {
//   TextChannel,
//   Client,
//   EmbedBuilder,
//   ActionRowBuilder,
//   ButtonBuilder,
//   ButtonStyle,
//   Message,
// } from 'discord.js';
// import * as dotenv from 'dotenv';
// import { console } from 'node:inspector';
// dotenv.config();

// // https://x.com/search?q=DD1Nxg9KZ9C2rBk96iMLkfJryttzK9U4wV936C4Qpump
// // https://rugcheck.xyz/tokens/DD1Nxg9KZ9C2rBk96iMLkfJryttzK9U4wV936C4Qpump

// // Type definition for token data
// interface TokenData {
//   mint: string;
//   tokenMeta: { name: string; symbol: string; uri?: string };
//   token: { supply: number; decimals: number };
//   creator: string;
//   price?: number;
//   totalHolders?: number;
//   totalMarketLiquidity?: number;
//   rugged?: boolean;
//   score?: number;
//   score_normalised?: number;
//   risks?: { name: string; description: string; level: string }[];
//   topHolders?: {
//     pct: number;
//     owner: string;
//     amount: number;
//     insider: boolean;
//   }[];
//   insiderNetworks?: {
//     tokenAmount: number;
//     size: number;
//     id?: string;
//     wallets?: string[];
//   }[];
//   freezeAuthority?: string | null;
//   mintAuthority?: string | null;
//   fileMeta?: { image?: string };
// }

// const token = process.env.DISCORD_TOKEN;
// @Injectable()
// export class DiscordBotService {
//   private readonly logger = new Logger(DiscordBotService.name);
//   private readonly client: Client;

//   constructor(private readonly httpService: HttpService) {
//     this.client = new Client({
//       intents: ['Guilds', 'GuildMessages', 'DirectMessages', 'MessageContent'],
//     });
//     // Login to Discord with your bot's token
//     this.client.login(token);
//     this.client.once('ready', this.onReady);
//     this.client.on('warn', this.onWarn);
//     this.client.on('messageCreate', this.handleRecievedMessages);
//     this.client.on('interactionCreate', this.handleInteraction);
//   }

//   onReady = async (client) => {
//     this.logger.log(`Bot logged in as ${client.user.username}`);
//   };

//   onWarn = async (message) => {
//     this.logger.warn(message);
//   };

//   handleRecievedMessages = async (message) => {
//     // this.logger.log(message);
//     console.log(message);
//     if (message.author.id === process.env.DISCORD_BOT_ID) {
//       return;
//     }
//     const regex = /\b[1-9A-HJ-NP-Za-km-z]{43,44}\b/;
//     console.log('message content :', message.content);
//     const match = message.content.match(regex);
//     if (!match) {
//       return;
//     }

//     console.log('Found address:', match[0]);
//     const response = await this.httpService.axiosRef.get(
//       `https://api.rugcheck.xyz/v1/tokens/${match[0]}/report`,
//     );

//     if (response.data.error) {
//       return;
//     }
//     try {
//       const tokenDetail = response.data;
//       console.log(tokenDetail);
//       const channel = this.client.channels.cache.get(message.channelId);
//       const tokenData = {
//         name: `${tokenDetail.tokenMeta.name}`,
//         symbol: `${tokenDetail.tokenMeta.symbol}`,
//         address: `${tokenDetail.mint}`,
//         supply: `${tokenDetail.token.supply}`,
//         creator: `${tokenDetail.creator}`,
//         marketCap: `${tokenDetail.price * tokenDetail.token.supply}`,
//         price: `$${tokenDetail.price}`,
//         holders: `${tokenDetail.totalHolders}`,
//         totalMarketLiquidity: `$${tokenDetail.totalHolders}`,
//         rugged: `${tokenDetail.rugged}`,
//         riskScore: `${tokenDetail.score}`,
//         insiderNetwork:
//           '26% of the supply to 12 wallets (gentle-sapphire-locust)',
//         insiderWallets: ['0x9abc...1234', '0xdef0...5678', '0x1111...9999'],
//         topHoldersCount: '10',
//         freezeAuthority: 'Enabled', // Optional
//         mintAuthority: 'Disabled', // Optional
//         sentiment: { balance: 2, rocket: 1, poop: 1 },
//         imageUrl: `${tokenDetail.fileMeta.image}`,
//       };
//       if (channel?.isTextBased()) {
//         await (<TextChannel>channel).sendTyping();
//         // Create the embed
//         const embed = new EmbedBuilder()
//           .setTitle(`${tokenData.name} (${tokenData.symbol})`)
//           .setDescription(`**Address:** \`${tokenData.address}\``)
//           .setThumbnail(tokenData.imageUrl) // Set token image as thumbnail
//           .addFields(
//             {
//               name: 'Token Overview',
//               value: [
//                 `**Supply:** ${tokenData.supply}`,
//                 `**Creator:** \`${tokenData.creator}\``,
//                 `**Market Cap:** ${tokenData.marketCap}`,
//                 `**Price:** ${tokenData.price}`,
//                 `**Holders:** ${tokenData.holders}`,
//                 `**Total Market Liquidity:** ${tokenData.totalMarketLiquidity}`,
//                 `**Rugged:** ${tokenData.rugged}`,
//               ].join('\n'),
//               inline: false,
//             },
//             {
//               name: 'Risk Analysis',
//               value: `**Score:** ${tokenData.riskScore}`,
//               inline: false,
//             },
//             {
//               name: 'Insider Analysis',
//               value: [
//                 tokenData.insiderNetwork,
//                 '**Insider Wallets (Top Holders):**',
//                 tokenData.insiderWallets
//                   .map((wallet) => `- \`${wallet}\``)
//                   .join('\n'),
//               ].join('\n'),
//               inline: false,
//             },
//             {
//               name: 'Top Holders (% Token)',
//               value: `**Number of Top Holders:** ${tokenData.topHoldersCount}`,
//               inline: false,
//             },
//             ...(tokenData.freezeAuthority
//               ? [
//                   {
//                     name: 'Freeze Authority',
//                     value: tokenData.freezeAuthority,
//                     inline: true,
//                   },
//                 ]
//               : []),
//             ...(tokenData.mintAuthority
//               ? [
//                   {
//                     name: 'Mint Authority',
//                     value: tokenData.mintAuthority,
//                     inline: true,
//                   },
//                 ]
//               : []),
//             {
//               name: 'Community Sentiment',
//               value: [
//                 `⚖️ **${tokenData.sentiment.balance}**`,
//                 `🚀 **${tokenData.sentiment.rocket}**`,
//                 `💩 **${tokenData.sentiment.poop}**`,
//               ].join('\n'),
//               inline: false,
//             },
//           )
//           .setColor('#00FF00') // Optional: Set embed color (e.g., green for good risk score)
//           .setTimestamp(); // Optional: Add current timestamp

//         // Create buttons
//         const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
//           new ButtonBuilder()
//             .setCustomId('upvote')
//             .setEmoji('🚀')
//             .setStyle(ButtonStyle.Primary),
//           new ButtonBuilder()
//             .setCustomId('downvote')
//             .setEmoji('💩')
//             .setStyle(ButtonStyle.Danger),
//         );

//         const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
//           new ButtonBuilder()
//             .setCustomId('chart')
//             .setEmoji('📈')
//             .setStyle(ButtonStyle.Primary),
//           new ButtonBuilder()
//             .setCustomId('inspect')
//             .setEmoji('🔎')
//             .setStyle(ButtonStyle.Primary),
//           new ButtonBuilder()
//             .setCustomId('bot_info')
//             .setEmoji('🤖')
//             .setStyle(ButtonStyle.Primary),
//         );

//         const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
//           new ButtonBuilder()
//             .setCustomId('refresh')
//             .setLabel('Refresh')
//             .setEmoji('🔄')
//             .setStyle(ButtonStyle.Secondary),
//           new ButtonBuilder()
//             // .setCustomId('view_more')
//             .setURL(`https://rugcheck.xyz/tokens/${tokenDetail.mint}`)
//             .setLabel('rugcheck.xyz')
//             .setStyle(ButtonStyle.Link),
//         );

//         // Send the embed with buttons
//         await message.reply({
//           embeds: [embed],
//           components: [row1, row2, row3],
//         });
//       }
//     } catch (error) {
//       console.log(error);
//       this.logger.warn(error);
//     }
//   };

//   handleInteraction = async (interaction) => {
//     if (!interaction.isButton()) return;

//     switch (interaction.customId) {
//       case 'upvote':
//         await interaction.reply({
//           content: 'You upvoted the token!',
//           ephemeral: true,
//         });
//         break;
//       case 'downvote':
//         await interaction.reply({
//           content: 'You downvoted the token!',
//           ephemeral: true,
//         });
//         break;
//       case 'refresh':
//         await interaction.update({
//           content: 'Refreshing...',
//           embeds: [],
//           components: [],
//         });
//         // Add logic to refresh data and resend embed
//         break;
//       // Add cases for other buttons...
//       default:
//         await interaction.reply({
//           content: 'Button clicked!',
//           ephemeral: true,
//         });
//     }
//   };
// }

// (async () => {
//     // Generate a new Keypair or use your existing secret key
//     const secretKey = Uint8Array.from([your secret key array here]);
//     const keypair = solanaWeb3.Keypair.fromSecretKey(secretKey);

//     // Create the message object to sign
//     const messageObj = {
//         message: "Sign-in to Rugcheck.xyz",
//         timestamp: 1723077205939,  // Replace this with your specific timestamp
//         publicKey: keypair.publicKey.toString()
//     };

//     // Convert message object to bytes (UTF-8 encoding)
//     const encodedMessage = new TextEncoder().encode(JSON.stringify(messageObj));
//     console.log("Message bytes in JavaScript:", Array.from(encodedMessage));

//     // Sign the message using TweetNacl
//     const signedMessage = nacl.sign.detached(encodedMessage, keypair.secretKey);

//     console.log("Signed message:", Array.from(signedMessage));
//     console.log("Public Key:", keypair.publicKey.toString());
//     console.log("Message to sign:", JSON.stringify(messageObj));
// })();
