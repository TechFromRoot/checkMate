import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { Keypair } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

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

@Injectable()
export class RugcheckService {
  constructor(private readonly httpService: HttpService) {}

  getTokenReport$Vote = async (mint: string) => {
    const [reportResult, votesResult] = await Promise.allSettled([
      this.httpService.axiosRef.get(
        `https://api.rugcheck.xyz/v1/tokens/${mint}/report`,
      ),
      this.httpService.axiosRef.get(
        `https://api.rugcheck.xyz/v1/tokens/${mint}/votes`,
      ),
    ]);

    const reportData =
      reportResult.status === 'fulfilled' && !reportResult.value.data.error
        ? reportResult.value.data
        : null;

    const votesData =
      votesResult.status === 'fulfilled' ? votesResult.value.data : null;

    if (!reportData && !votesData) {
      return;
    }
    const tokenDetail: TokenData = reportData;
    const tokenVotes: VoteData = votesData;

    return { tokenDetail, tokenVotes };
  };

  getTokenDetails = async (mint: string) => {
    const [reportResult] = await Promise.allSettled([
      this.httpService.axiosRef.get(
        `https://api.rugcheck.xyz/v1/tokens/${mint}/report`,
      ),
    ]);

    const reportData =
      reportResult.status === 'fulfilled' && !reportResult.value.data.error
        ? reportResult.value.data
        : null;

    if (!reportData) {
      return;
    }
    const tokenDetail: TokenData = reportData;

    return { tokenDetail };
  };

  async signLoginPayload(base58PrivateKey: string): Promise<any> {
    // Decode private key
    const secretKey = bs58.decode(base58PrivateKey);
    const keypair = Keypair.fromSecretKey(secretKey);
    const publicKey = keypair.publicKey.toBase58();

    // Construct message
    const timestamp = Date.now();
    const messageObject = {
      message: 'Sign-in to Rugcheck.xyz',
      timestamp,
      publicKey,
    };

    const messageJson = JSON.stringify(messageObject);
    const encodedMessage = new TextEncoder().encode(messageJson);

    // Sign the message
    const signature = nacl.sign.detached(encodedMessage, keypair.secretKey);

    // Final payload
    const payload = {
      message: messageObject,
      signature: {
        data: Array.from(signature),
        type: 'ed25519',
      },
      wallet: publicKey,
    };

    try {
      const token = await this.httpService.axiosRef.post(
        `https://api.rugcheck.xyz/auth/login/solana`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return token.data;
    } catch (error) {
      console.log(error);
    }
  }

  voteOnToken = async (
    authToken: string,
    mint: string,
    vote: boolean,
  ): Promise<any> => {
    try {
      const payload = {
        mint,
        side: vote,
      };
      const response = await this.httpService.axiosRef.post(
        `https://api.rugcheck.xyz/v1/tokens/${mint}/vote`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      if (response.status === 200) {
        console.log('response :', response.data);
        return { vote: response.data };
      } else {
        return null;
      }
    } catch (error) {
      console.log(error.response.data);
      if (error.response.data.error === `vote failed`) {
        return { hasVote: true };
      }
      return null;
    }
  };
}
