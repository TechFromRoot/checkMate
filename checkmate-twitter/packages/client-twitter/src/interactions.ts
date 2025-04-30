import { SearchMode, Tweet } from "agent-twitter-client";
import {
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    stringToUuid,
    elizaLogger,
    getEmbeddingZeroVector,
} from "@ai16z/eliza";
import { ClientBase } from "./base";
import { buildConversationThread, sendTweet, wait } from "./utils.ts";

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

interface TweetData {
    text: string;
    media?: string; // URL to image (e.g., token logo)
}

export class TwitterInteractionClient {
    client: ClientBase;
    runtime: IAgentRuntime;

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
    }

    async start() {
        const handleTwitterInteractionsLoop = () => {
            this.handleTwitterInteractions();
            setTimeout(
                handleTwitterInteractionsLoop,
                Number(this.runtime.getSetting("TWITTER_POLL_INTERVAL") || 30) *
                    1000 // Default to 2 minutes
            );
        };
        handleTwitterInteractionsLoop();
    }

    async handleTwitterInteractions() {
        elizaLogger.log("Checking Twitter interactions");

        const twitterUsername = this.client.profile.username;
        try {
            // Check for mentions
            const tweetCandidates = (
                await this.client.fetchSearchTweets(
                    `@${twitterUsername}`,
                    20,
                    SearchMode.Latest
                )
            ).tweets;

            // de-duplicate tweetCandidates with a set
            const uniqueTweetCandidates = [...new Set(tweetCandidates)];
            // Sort tweet candidates by ID in ascending order
            uniqueTweetCandidates
                .sort((a, b) => a.id.localeCompare(b.id))
                .filter((tweet) => tweet.userId !== this.client.profile.id);

            // for each tweet candidate, handle the tweet
            for (const tweet of uniqueTweetCandidates) {
                if (
                    !this.client.lastCheckedTweetId ||
                    BigInt(tweet.id) > this.client.lastCheckedTweetId
                ) {
                    // Generate the tweetId UUID the same way it's done in handleTweet
                    const tweetId = stringToUuid(
                        tweet.id + "-" + this.runtime.agentId
                    );

                    // Check if we've already processed this tweet
                    const existingResponse =
                        await this.runtime.messageManager.getMemoryById(
                            tweetId
                        );

                    if (existingResponse) {
                        elizaLogger.log(
                            `Already responded to tweet ${tweet.id}, skipping`
                        );
                        continue;
                    }
                    elizaLogger.log("New Tweet found", tweet.permanentUrl);

                    const roomId = stringToUuid(
                        tweet.conversationId + "-" + this.runtime.agentId
                    );

                    const userIdUUID =
                        tweet.userId === this.client.profile.id
                            ? this.runtime.agentId
                            : stringToUuid(tweet.userId!);

                    await this.runtime.ensureConnection(
                        userIdUUID,
                        roomId,
                        tweet.username,
                        tweet.name,
                        "twitter"
                    );

                    const thread = await buildConversationThread(
                        tweet,
                        this.client
                    );

                    // console.log("this is the user tweet  :", tweet.text);

                    const message = {
                        content: { text: tweet.text },
                        agentId: this.runtime.agentId,
                        userId: userIdUUID,
                        roomId,
                    };

                    await this.handleTweet({
                        tweet,
                        message,
                        thread,
                    });

                    // Update the last checked tweet ID after processing each tweet
                    this.client.lastCheckedTweetId = BigInt(tweet.id);
                }
            }

            // Save the latest checked tweet ID to the file
            await this.client.cacheLatestCheckedTweetId();

            elizaLogger.log("Finished checking Twitter interactions");
        } catch (error) {
            elizaLogger.error("Error handling Twitter interactions:", error);
        }
    }

    private async handleTweet({
        tweet,
        message,
        thread,
    }: {
        tweet: Tweet;
        message: Memory;
        thread: Tweet[];
    }) {
        if (tweet.userId === this.client.profile.id) {
            // console.log("skipping tweet from bot itself", tweet.id);
            // Skip processing if the tweet is from the bot itself
            return;
        }

        if (!message.content.text) {
            elizaLogger.log("Skipping Tweet with no text", tweet.id);
            return { text: "", action: "IGNORE" };
        }

        elizaLogger.log("Processing Tweet: ", tweet.id);
        const formatTweet = (tweet: Tweet) => {
            return `  ID: ${tweet.id}
  From: ${tweet.name} (@${tweet.username})
  Text: ${tweet.text}`;
        };
        const currentPost = formatTweet(tweet);

        elizaLogger.debug("Thread: ", thread);
        const formattedConversation = thread
            .map(
                (tweet) => `@${tweet.username} (${new Date(
                    tweet.timestamp * 1000
                ).toLocaleString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric",
                })}):
        ${tweet.text}`
            )
            .join("\n\n");

        elizaLogger.debug("formattedConversation: ", formattedConversation);

        let state = await this.runtime.composeState(message, {
            twitterClient: this.client.twitterClient,
            twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
            currentPost,
            formattedConversation,
        });

        // check if the tweet exists, save if it doesn't
        const tweetId = stringToUuid(tweet.id + "-" + this.runtime.agentId);
        const tweetExists =
            await this.runtime.messageManager.getMemoryById(tweetId);

        if (!tweetExists) {
            elizaLogger.log("tweet does not exist, saving");
            const userIdUUID = stringToUuid(tweet.userId as string);
            const roomId = stringToUuid(tweet.conversationId);

            const message = {
                id: tweetId,
                agentId: this.runtime.agentId,
                content: {
                    text: tweet.text,
                    url: tweet.permanentUrl,
                    inReplyTo: tweet.inReplyToStatusId
                        ? stringToUuid(
                              tweet.inReplyToStatusId +
                                  "-" +
                                  this.runtime.agentId
                          )
                        : undefined,
                },
                userId: userIdUUID,
                roomId,
                createdAt: tweet.timestamp * 1000,
            };
            this.client.saveRequestMessage(message, state);
        }

        const regex =
            /^@(TestBots28|CheckM8_Bot).*?\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/;
        const match = tweet.text.match(regex);

        if (!match) {
            return;
        }

        const response1 = await this.getTokenReport$Vote(match[2]);
        if (!response1.tokenDetail && !response1.tokenVotes) {
            return;
        }

        const generatedTweet = await this.getTokenDisplayTweet(
            response1.tokenDetail,
            response1.tokenVotes
        );

        const response: Content = {
            text: generatedTweet.text,
            url: tweet.permanentUrl,
            inReplyTo: tweet.inReplyToStatusId
                ? stringToUuid(
                      tweet.inReplyToStatusId + "-" + this.runtime.agentId
                  )
                : undefined,
        };

        const stringId = stringToUuid(tweet.id + "-" + this.runtime.agentId);

        response.inReplyTo = stringId;
        response.action = "REPLY";

        if (response.text) {
            try {
                const callback: HandlerCallback = async (response: Content) => {
                    const memories = await sendTweet(
                        this.client,
                        response,
                        message.roomId,
                        this.runtime.getSetting("TWITTER_USERNAME"),
                        tweet.id
                    );
                    return memories;
                };

                const responseMessages = await callback(response);

                state = (await this.runtime.updateRecentMessageState(
                    state
                )) as State;

                for (const responseMessage of responseMessages) {
                    if (
                        responseMessage ===
                        responseMessages[responseMessages.length - 1]
                    ) {
                        responseMessage.content.action = response.action;
                    } else {
                        responseMessage.content.action = "CONTINUE";
                    }
                    await this.runtime.messageManager.createMemory(
                        responseMessage
                    );
                }

                await this.runtime.evaluate(message, state);

                await this.runtime.processActions(
                    message,
                    responseMessages,
                    state
                );

                const responseInfo = `Selected Post: ${tweet.id} - ${tweet.username}: ${tweet.text}\nAgent's Output:\n${response.text}`;

                await this.runtime.cacheManager.set(
                    `twitter/tweet_generation_${tweet.id}.txt`,
                    responseInfo
                );
                await wait();
            } catch (error) {
                elizaLogger.error(`Error sending response tweet: ${error}`);
            }
        }
    }

    async buildConversationThread(
        tweet: Tweet,
        maxReplies: number = 10
    ): Promise<Tweet[]> {
        const thread: Tweet[] = [];
        const visited: Set<string> = new Set();

        async function processThread(currentTweet: Tweet, depth: number = 0) {
            elizaLogger.log("Processing tweet:", {
                id: currentTweet.id,
                inReplyToStatusId: currentTweet.inReplyToStatusId,
                depth: depth,
            });

            if (!currentTweet) {
                elizaLogger.log("No current tweet found for thread building");
                return;
            }

            if (depth >= maxReplies) {
                elizaLogger.log("Reached maximum reply depth", depth);
                return;
            }

            // Handle memory storage
            const memory = await this.runtime.messageManager.getMemoryById(
                stringToUuid(currentTweet.id + "-" + this.runtime.agentId)
            );
            if (!memory) {
                const roomId = stringToUuid(
                    currentTweet.conversationId + "-" + this.runtime.agentId
                );
                const userId = stringToUuid(currentTweet.userId);

                await this.runtime.ensureConnection(
                    userId,
                    roomId,
                    currentTweet.username,
                    currentTweet.name,
                    "twitter"
                );

                this.runtime.messageManager.createMemory({
                    id: stringToUuid(
                        currentTweet.id + "-" + this.runtime.agentId
                    ),
                    agentId: this.runtime.agentId,
                    content: {
                        text: currentTweet.text,
                        source: "twitter",
                        url: currentTweet.permanentUrl,
                        inReplyTo: currentTweet.inReplyToStatusId
                            ? stringToUuid(
                                  currentTweet.inReplyToStatusId +
                                      "-" +
                                      this.runtime.agentId
                              )
                            : undefined,
                    },
                    createdAt: currentTweet.timestamp * 1000,
                    roomId,
                    userId:
                        currentTweet.userId === this.twitterUserId
                            ? this.runtime.agentId
                            : stringToUuid(currentTweet.userId),
                    embedding: getEmbeddingZeroVector(),
                });
            }

            if (visited.has(currentTweet.id)) {
                elizaLogger.log("Already visited tweet:", currentTweet.id);
                return;
            }

            visited.add(currentTweet.id);
            thread.unshift(currentTweet);

            elizaLogger.debug("Current thread state:", {
                length: thread.length,
                currentDepth: depth,
                tweetId: currentTweet.id,
            });

            if (currentTweet.inReplyToStatusId) {
                elizaLogger.log(
                    "Fetching parent tweet:",
                    currentTweet.inReplyToStatusId
                );
                try {
                    const parentTweet = await this.twitterClient.getTweet(
                        currentTweet.inReplyToStatusId
                    );

                    if (parentTweet) {
                        elizaLogger.log("Found parent tweet:", {
                            id: parentTweet.id,
                            text: parentTweet.text?.slice(0, 50),
                        });
                        await processThread(parentTweet, depth + 1);
                    } else {
                        elizaLogger.log(
                            "No parent tweet found for:",
                            currentTweet.inReplyToStatusId
                        );
                    }
                } catch (error) {
                    elizaLogger.log("Error fetching parent tweet:", {
                        tweetId: currentTweet.inReplyToStatusId,
                        error,
                    });
                }
            } else {
                elizaLogger.log(
                    "Reached end of reply chain at:",
                    currentTweet.id
                );
            }
        }

        // Need to bind this context for the inner function
        await processThread.bind(this)(tweet, 0);

        elizaLogger.debug("Final thread built:", {
            totalTweets: thread.length,
            tweetIds: thread.map((t) => ({
                id: t.id,
                text: t.text?.slice(0, 50),
            })),
        });

        return thread;
    }

    getTokenReport$Vote = async (mint: string) => {
        try {
            const [reportResponse, votesResponse] = await Promise.all([
                fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`),
                fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/votes`),
            ]);

            const reportResult = await reportResponse.json();
            const votesResult = await votesResponse.json();

            const tokenDetail: TokenData =
                reportResult && !reportResult.error ? reportResult : null;
            const tokenVotes: VoteData = votesResult || null;

            if (!tokenDetail && !tokenVotes) {
                console.error(
                    `No data retrieved for mint ${mint}: both report and votes failed.`
                );
                return null;
            }

            return { tokenDetail, tokenVotes };
        } catch (error) {
            console.error(`Error fetching token data for mint ${mint}:`, error);
            return null;
        }
    };

    getTokenDisplayTweet = async (
        token: TokenData,
        tokenVote: VoteData
    ): Promise<TweetData> => {
        const lines: string[] = [];

        // Token Header
        lines.push(`${token.tokenMeta.name} (${token.tokenMeta.symbol}) 📊`);

        // Key Metrics
        const metrics: string[] = [];
        if (token.price) {
            metrics.push(`💰 Price: $${this.formatPrice(token.price)}`);
        }
        if (token.price && token.token.supply) {
            const marketCap =
                token.price * (token.token.supply / 10 ** token.token.decimals);
            metrics.push(`📈 MCap: $${this.formatNumber(marketCap)}`);
        }
        if (token.totalHolders) {
            metrics.push(
                `👥 Holders: ${this.formatNumber(token.totalHolders)}`
            );
        }

        // Risk Score
        const normalizedScore =
            token.score_normalised !== undefined
                ? token.score_normalised
                : token.score
                  ? Math.min(Math.round((token.score / 118101) * 100), 100)
                  : undefined;
        if (normalizedScore !== undefined) {
            const riskEmoji = normalizedScore >= 50 ? "🔴" : "🟢";
            metrics.push(`🚨 Risk: ${normalizedScore}/100 ${riskEmoji}`);
        }

        if (typeof token.rugged === "boolean") {
            metrics.push(`🔻 Rugged: ${token.rugged ? "Yes" : "No"}`);
        }

        // Insider Analysis
        if (token.insiderNetworks?.length) {
            const { insiderPct, totalWallet } = token.insiderNetworks.reduce(
                (acc, insider) => {
                    if (insider["type"] === "transfer") {
                        // Assuming 'type' might be present; adjust if not
                        acc.totalWallet += insider.size;
                        acc.insiderPct +=
                            (insider.tokenAmount / token.token.supply) * 100;
                    }
                    return acc;
                },
                { insiderPct: 0, totalWallet: 0 }
            );
            const insiderText = `${insiderPct.toFixed(2)}% of supply sent to ${totalWallet} wallets`;
            metrics.push(`🕵️‍♀️ Insider Analysis: ${insiderText}`);
        }

        // Community Sentiment
        if (tokenVote) {
            metrics.push(
                `👥 Community Sentiment : 🚀 Up: ${tokenVote.up} | 💩 Down: ${tokenVote.down}`
            );
        }

        // Add metrics to lines (limit to 9 for brevity)
        if (metrics.length > 0) {
            lines.push(...metrics.slice(0, 12));
        }

        // Call-to-Action
        lines.push(`🔎 Details: ${process.env.BOT_URL}?start=x-${token.mint}`);

        // Build text
        const text = lines.join("\n").substring(0, 280); // Ensure < 280 chars

        // Prepare output
        const tweet: TweetData = { text };

        // Add media if available
        if (token.fileMeta?.image) {
            tweet.media = token.fileMeta.image;
        }

        return tweet;
    };

    shortenAddress = (address: string): string => {
        if (!address || address.length < 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    formatNumber = (num: number): string => {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
        if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
        if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
        return num.toFixed(2);
    };

    formatPrice = (price: number): string => {
        if (price === 0) return "0";
        if (price < 0.00000001) return `${price.toFixed(8)}(~< 0.00000001)`;
        return price.toFixed(8);
    };
}
