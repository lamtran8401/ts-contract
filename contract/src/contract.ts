import { PromiseIndex } from 'near-sdk-js/lib/utils'
// Find all our documentation at https://docs.near.org
import { NearBindgen, near, call, view, LookupMap, initialize, assert } from 'near-sdk-js'
import { AccountId } from 'near-sdk-js/lib/types'
import { NFTContractMetadata, InitContractParams, TokenId } from './type'
import Token from './token'

const metadata = {
	spec: '1.0.0',
	name: 'Tet Holiday 2023 NFT',
	symbol: 'TH23',
	icon: '',
	base_uri: '',
	reference: '',
	reference_hash: '',
}

// This is the main contract class
@NearBindgen({})
class Contract {
	token_id: TokenId
	owner_id: AccountId
	owner_by_id: LookupMap<string>
	token_by_id: LookupMap<Token>
	approval_by_id: LookupMap<string>
	metadata: NFTContractMetadata

	constructor() {
		this.token_id = 0
		this.owner_id = ''
		this.metadata = metadata
		this.owner_by_id = new LookupMap('o')
		this.token_by_id = new LookupMap('t')
		this.approval_by_id = new LookupMap('a')
	}

	@initialize({})
	init({ owner_id, prefix = 'o' }: InitContractParams): void {
		this.token_id = 0
		this.owner_id = owner_id
		this.owner_by_id = new LookupMap(prefix)
		this.token_by_id = new LookupMap('t')
		this.approval_by_id = new LookupMap('a')
		this.metadata = metadata
	}

	@view({})
	nft_metadata(): NFTContractMetadata {
		return this.metadata
	}

	@call({})
	mint_nft({ token_owner_id }: { token_owner_id: AccountId }): Token {
		this.owner_by_id.set(this.token_id.toString(), token_owner_id)

		let token = new Token(this.token_id, token_owner_id)

		this.token_by_id.set(this.token_id.toString(), token)

		this.token_id++

		return token
	}

	internalTransfer({ sender_id, receiver_id, token_id, approval_id, memo }) {
		let owner_id = this.owner_by_id.get(token_id)

		assert(owner_id !== null, 'Token not found')
		assert(sender_id === owner_id, 'Sender must be the current owner')
		assert(owner_id !== receiver_id, 'Current and next owner must differ')

		this.owner_by_id.set(token_id, receiver_id)

		return owner_id
	}

	@call({})
	nft_transfer({
		receiver_id,
		token_id,
		approval_id,
		memo,
	}: {
		receiver_id: AccountId
		token_id: TokenId
		approval_id?: number | null
		memo?: string | null
	}): void {
		let sender_id = near.predecessorAccountId()
		this.internalTransfer({ sender_id, receiver_id, token_id, approval_id, memo })
	}

	@call({})
	nft_transfer_call({ receiver_id, token_id, approval_id, memo, msg }): PromiseIndex {
		near.log(`nft_transfer_call called, receiver_id ${receiver_id}, token_id ${token_id}`)
		let sender_id = near.predecessorAccountId()
		let old_owner_id = this.internalTransfer({
			sender_id,
			receiver_id,
			token_id,
			approval_id,
			memo,
		})

		const promise = near.promiseBatchCreate(receiver_id)
		near.promiseBatchActionFunctionCall(
			promise,
			'nft_on_transfer',
			JSON.stringify({
				sender_id,
				previous_owner_id: old_owner_id,
				token_id,
				msg: msg,
			}),
			0,
			30000000000000
		)
		near.promiseThen(
			promise,
			near.currentAccountId(),
			'nft_resolve_transfer',
			JSON.stringify({ sender_id, receiver_id, token_id }),
			0,
			30000000000000
		)

		return promise
	}

	@call({ privateFunction: true })
	nft_resolve_transfer({
		previous_owner_id,
		receiver_id,
		token_id,
		approved_account_ids,
	}: {
		previous_owner_id: AccountId
		receiver_id: AccountId
		token_id: TokenId
		approved_account_ids: null | Record<string, number>
	}): boolean {
		near.log(
			`nft_resolve_transfer called, sender_id ${previous_owner_id}, receiver_id ${receiver_id}, token_id ${token_id}`
		)

		const isTokenTransfered = JSON.parse(near.promiseResult(0))
		near.log(`${token_id} ${isTokenTransfered ? 'was transfered' : 'was NOT transfered'}`)

		if (!isTokenTransfered) {
			near.log(`Returning ${token_id} to ${receiver_id}`)
			const currentOwner = this.owner_by_id.get(token_id.toString())
			if (currentOwner === receiver_id) {
				this.internalTransfer({
					sender_id: receiver_id,
					receiver_id: previous_owner_id,
					token_id: token_id,
					approval_id: null,
					memo: null,
				})
				near.log(`${token_id} returned to ${previous_owner_id}`)
				return true
			}
			near.log(
				`Failed to return ${token_id}. It was burned or not owned by ${receiver_id} now.`
			)
			return false
		}
		return true
	}

	@call({})
	nft_on_transfer({
		sender_id,
		previous_owner_id,
		token_id,
		msg,
	}: {
		sender_id: AccountId
		previous_owner_id: AccountId
		token_id: TokenId
		msg: string
	}): Promise<boolean> {
		near.log(
			`nft_on_transfer called, sender_id ${sender_id}, previous_owner_id ${previous_owner_id}, token_id ${token_id}, msg ${msg}`
		)

		if (msg === 'return-it-now') {
			near.log(`Returning ${token_id} to ${sender_id}`)
			return Promise.resolve(false)
		} else if (msg === 'keep-it-now') {
			near.log(`Keep ${token_id}`)
			return Promise.resolve(true)
		} else {
			throw Error('unsupported msg')
		}
	}

	@view({})
	nft_token({ token_id }: { token_id: TokenId }): Token | null {
		let token = this.token_by_id.get(token_id.toString())

		return !token ? null : token
	}

	@call({ payableFunction: true })
	nft_approve({
		token_id,
		account_id,
		msg,
	}: {
		token_id: TokenId
		account_id: AccountId
		msg: string
	}): void | Promise<any> {
		near.log(
			`nft_approve called, token_id ${token_id}, account_id ${account_id}, msg ${msg}`
		)
		let sender_id = near.predecessorAccountId()
		if (sender_id != this.owner_by_id.get(token_id.toString())) {
			throw new Error('Only owner can grant approval')
		}

		if (msg === 'return-it-now') {
			near.log(`Approving ${token_id} to ${account_id}`)
			this.approval_by_id.set(token_id.toString(), account_id)
			return
		} else if (msg === 'keep-it-now') {
			near.log(`Keep ${token_id}`)
			return Promise.resolve(true)
		} else throw Error('unsupported msg')
	}

	@call({})
	nft_revoke({
		token_id,
		account_id,
	}: {
		token_id: TokenId
		account_id: AccountId
	}): void {
		near.log(`nft_revoke called, token_id ${token_id}, account_id ${account_id}`)
		let sender_id = near.predecessorAccountId()
		if (sender_id != this.owner_by_id.get(token_id.toString())) {
			throw new Error('Only owner can revoke approval')
		}

		if (this.approval_by_id.get(token_id.toString()) === account_id)
			this.approval_by_id.remove(token_id.toString())
	}

	@call({})
	nft_revoke_all({ token_id }: { token_id: TokenId }): void {
		near.log(`nft_revoke_all called, token_id ${token_id}`)
		let sender_id = near.predecessorAccountId()
		if (sender_id != this.owner_by_id.get(token_id.toString())) {
			throw new Error('Only owner can revoke all approval')
		}

		this.approval_by_id.remove(token_id.toString())
	}

	@view({})
	nft_is_approved({
		token_id,
		approved_account_id,
		approval_id,
	}: {
		token_id: TokenId
		approved_account_id: AccountId
		approval_id: number | null
	}): boolean {
		near.log(
			`nft_is_approved called, token_id ${token_id}, account_id ${approved_account_id}`
		)
		let sender_id = near.predecessorAccountId()
		if (sender_id != this.owner_by_id.get(token_id.toString())) {
			throw new Error('Only owner can check approval')
		}

		if (approval_id) {
			const token = this.token_by_id.get(token_id.toString())
			if (!token) return false
			return token.approved_account_ids[approved_account_id] === approval_id
		}

		return this.approval_by_id.get(token_id.toString()) == approved_account_id
	}

	@call({})
	nft_on_approve({
		token_id,
		account_id,
		msg,
	}: {
		token_id: TokenId
		account_id: AccountId
		msg: string
	}): void {
		near.log(
			`nft_on_approve called, token_id ${token_id}, account_id ${account_id}, msg ${msg}`
		)
		let sender_id = near.predecessorAccountId()
		if (sender_id != this.approval_by_id.get(token_id.toString())) {
			throw new Error('Only approved account can call on_approve')
		}

		if (msg === 'return-it-now') {
			near.log(`Approving ${token_id} to ${account_id}`)
			return
		} else if (msg === 'keep-it-now') {
			near.log(`Keep ${token_id}`)
			return
		} else throw Error('unsupported msg')
	}

	// This function is used to view owner from the contract by token_id
	@view({})
	get_owner_by_id({ token_id }: { token_id: TokenId }): AccountId | null {
		const owner_id = this.owner_by_id.get(token_id.toString())
		if (!owner_id) return null

		return owner_id
	}

	// This function is used to view token from the contract by token_id
	@view({})
	get_token_by_id({ token_id }: { token_id: TokenId }): Token | null {
		let token = this.token_by_id.get(token_id.toString())

		return !token ? null : token
	}

	@view({})
	get_supply_token(): number {
		return this.token_id
	}

	// This function is used to view all tokens from the contract with pagination (optional)
	@view({})
	get_all_tokens({ start = 0, limit }: { start?: number; limit?: number }): Token[] {
		var all_tokens: Token[] = []

		limit = limit || this.token_id - start

		for (let i = start; i < this.token_id; i++) {
			if (i >= start + limit) break
			all_tokens.push(this.token_by_id.get(i.toString()))
		}

		return all_tokens
	}

	// This function is used to view all tokens by owner from the contract
	@view({})
	get_all_tokens_for_owner({ owner_id }: { owner_id: AccountId }): Token[] {
		var all_tokens_for_owner: Token[] = []

		for (var i = 0; i < this.token_id; i++)
			if (this.owner_by_id.get(i.toString()) === owner_id)
				all_tokens_for_owner.push(this.token_by_id.get(i.toString()))

		return all_tokens_for_owner
	}
}
