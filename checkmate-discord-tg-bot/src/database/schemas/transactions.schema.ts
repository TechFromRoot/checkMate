import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type TransactionDocument = mongoose.HydratedDocument<Transaction>;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: mongoose.Schema.Types.String, ref: 'User' })
  wallet: string;

  @Prop()
  type: string;

  @Prop()
  txHash: string;

  @Prop()
  txIndex: number;

  @Prop()
  blockTimestamp: string;

  @Prop()
  tokenOutSymbol: string;

  @Prop()
  tokenOutName: string;

  @Prop()
  tokenOutLogo: string;

  @Prop()
  tokenOutAddress: string;

  @Prop()
  tokenOutAmount: string;

  @Prop()
  tokenOutAmountUsd: string;

  @Prop()
  tokenInSymbol: string;

  @Prop()
  tokenInName: string;

  @Prop()
  tokenInLogo: string;

  @Prop()
  tokenInAddress: string;

  @Prop()
  tokenInAmount: string;

  @Prop()
  tokenInAmountUsd: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
// Compound unique index for txHash + txIndex
TransactionSchema.index({ txHash: 1, txIndex: 1 }, { unique: true });
