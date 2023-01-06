import { AccountId } from 'near-sdk-js/lib/types'
import { NearBindgen, call } from 'near-sdk-js'

type TokenId = string
type MintParams = {
	token_id: TokenId
	token_owner_id: AccountId
}

// This is the main contract class
@NearBindgen({})
export class Token {
	token_id: TokenId // The account ID / address wallet of the owner
	owner_id: AccountId // A map of account ID to owner ID

	constructor(token_id: TokenId, owner_id: AccountId) {
		this.token_id = token_id
		this.owner_id = owner_id
	}

	// This function is called when minting a new token
	@call({})
	mint_nft({ token_id, token_owner_id }: MintParams): void {
		this.token_id = token_id
		this.owner_id = token_owner_id
	}
}
