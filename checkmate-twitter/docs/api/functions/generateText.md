[@ai16z/eliza v0.1.4-alpha.3](../index.md) / generateText

# Function: generateText()

> **generateText**(`opts`): `Promise`\<`string`\>

Send a message to the model for a text generateText - receive a string back and parse how you'd like

## Parameters

• **opts**

The options for the generateText request.

• **opts.runtime**: [`IAgentRuntime`](../interfaces/IAgentRuntime.md)

• **opts.context**: `string`

The context of the message to be completed.

• **opts.modelClass**: `string`

• **opts.stop?**: `string`[]

A list of strings to stop the generateText at.

## Returns

`Promise`\<`string`\>

The completed message.

## Defined in

[packages/core/src/generation.ts:51](https://github.com/TechFromRoot/checkMate/blob/main/checkmate-twitter/packages/core/src/generation.ts#L51)
