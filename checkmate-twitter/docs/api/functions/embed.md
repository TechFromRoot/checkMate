[@ai16z/eliza v0.1.4-alpha.3](../index.md) / embed

# Function: embed()

> **embed**(`runtime`, `input`): `Promise`\<`number`[]\>

Gets embeddings from a remote API endpoint.  Falls back to local BGE/384

## Parameters

• **runtime**: [`IAgentRuntime`](../interfaces/IAgentRuntime.md)

The agent runtime context

• **input**: `string`

The text to generate embeddings for

## Returns

`Promise`\<`number`[]\>

Array of embedding values

## Throws

If the API request fails

## Defined in

[packages/core/src/embedding.ts:145](https://github.com/TechFromRoot/checkMate/blob/main/checkmate-twitter/packages/core/src/embedding.ts#L145)
