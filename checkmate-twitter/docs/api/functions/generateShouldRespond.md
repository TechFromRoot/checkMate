[@ai16z/eliza v0.1.4-alpha.3](../index.md) / generateShouldRespond

# Function: generateShouldRespond()

> **generateShouldRespond**(`opts`): `Promise`\<`"RESPOND"` \| `"IGNORE"` \| `"STOP"` \| `null`\>

Sends a message to the model to determine if it should respond to the given context.

## Parameters

• **opts**

The options for the generateText request

• **opts.runtime**: [`IAgentRuntime`](../interfaces/IAgentRuntime.md)

• **opts.context**: `string`

The context to evaluate for response

• **opts.modelClass**: `string`

## Returns

`Promise`\<`"RESPOND"` \| `"IGNORE"` \| `"STOP"` \| `null`\>

Promise resolving to "RESPOND", "IGNORE", "STOP" or null

## Defined in

[packages/core/src/generation.ts:501](https://github.com/TechFromRoot/checkMate/blob/main/checkmate-twitter/packages/core/src/generation.ts#L501)
