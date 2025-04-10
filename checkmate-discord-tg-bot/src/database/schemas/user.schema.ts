import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type UserDocument = mongoose.HydratedDocument<User>;

enum Platform {
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
}

@Schema()
export class User {
  @Prop()
  chatId: number;

  @Prop()
  userId: number;

  @Prop({ enum: Platform, required: true })
  platform: Platform;

  @Prop()
  svmWalletAddress: string;

  @Prop()
  svmWalletDetails: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
