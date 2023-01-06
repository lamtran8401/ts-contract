import { AccountId } from 'near-sdk-js/lib/types'
import { NearBindgen, call, view } from 'near-sdk-js'
import { TokenId, TokenMetadata } from './type'

const metadata: TokenMetadata = {
	title: 'Tet Holiday 2023 NFT',
	description: 'Tet Holiday 2023 NFT',
	media: '',
	media_hash: '',
	copies: 1,
	issued_at: 0,
	expires_at: 0,
	starts_at: 0,
	updated_at: 0,
	extra: '',
	reference: '',
	reference_hash: '',
}

// This is the main contract class
@NearBindgen({})
export default class Token {
	token_id: TokenId
	owner_id: AccountId
	metadata: TokenMetadata

	constructor(token_id: TokenId, owner_id: AccountId) {
		this.token_id = token_id
		this.owner_id = owner_id
		this.metadata = metadata
	}

	@view({})
	nft_metadata(): TokenMetadata {
		return this.metadata
	}
}
