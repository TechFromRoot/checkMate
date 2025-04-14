import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type CreatorDocument = mongoose.HydratedDocument<Creator>;

@Schema()
export class Creator {
  @Prop({ unique: true })
  tokenMint: string;

  @Prop()
  chatId: number[];

  @Prop()
  creatorAddress: string;

  @Prop()
  tokenSymbol: string;
}

export const CreatorSchema = SchemaFactory.createForClass(Creator);
