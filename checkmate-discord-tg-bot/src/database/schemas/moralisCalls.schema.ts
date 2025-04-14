import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type CallDocument = mongoose.HydratedDocument<Call>;

@Schema()
export class Call {
  @Prop()
  call: number;
}

export const CallSchema = SchemaFactory.createForClass(Call);
