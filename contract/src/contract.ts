// Find all our documentation at https://docs.near.org
import { NearBindgen, near, call, view, LookupMap, initialize } from 'near-sdk-js'
import { AccountId } from 'near-sdk-js/lib/types'

type InitParams = {
	owner_id: AccountId
	owner_by_id_prefix: string
}

// This is the main contract class
@NearBindgen({})
class Contract {
	owner_id: AccountId // The account ID / address wallet of the owner
	owner_by_id: LookupMap<string> // A map of account ID to owner ID

	constructor() {
		this.owner_id = ''
		this.owner_by_id = new LookupMap('')
	}

	// This function is called when the contract is initialized
	@initialize({})
	init({ owner_id, owner_by_id_prefix }: InitParams): void {
		this.owner_id = owner_id
		this.owner_by_id = new LookupMap(owner_by_id_prefix)
	}
}
