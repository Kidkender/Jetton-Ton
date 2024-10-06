import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    Slice,
} from '@ton/core';

export type JettonMinterConfig = {
    totalSupply: bigint;
    adminAddress: Slice;
    content: Cell;
    jettonWalletCode: Cell;
};

export const Opcodes = {
    transfer: 0xf8a7ea5,
    transfer_notification: 0x7362d09c,
    internal_transfer: 0x178d4519,
    excesses: 0xd53276db,
    burn: 0x595f07bc,
    burn_notification: 0x7bdd97de,
    mint: 0x21,
    burnNotification: 0x7bdd97de,
};

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
    return beginCell()
        .storeCoins(config.totalSupply)
        .storeSlice(config.adminAddress)
        .storeRef(config.content)
        .storeRef(config.jettonWalletCode)
        .endCell();
}

export class JettonMinter implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: {
            code: Cell;
            data: Cell;
        },
    ) {}

    static createFromAddress(address: Address) {
        return new JettonMinter(address);
    }

    static createFromConfig(config: JettonMinterConfig, code: Cell, workchain = 0) {
        const data = jettonMinterConfigToCell(config);
        const init = { code, data };
        return new JettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    // Mint tokens
    async mint(
        provider: ContractProvider,
        via: Sender,
        opts: {
            toAddress: Address;
            amount: bigint;
            value: bigint;
            queryId?: number;
            masterMsg?: Cell;
        },
    ) {
        const body = beginCell()
            .storeUint(Opcodes.mint, 32)
            .storeUint(opts.queryId ?? 0, 64)
            .storeAddress(opts.toAddress)
            .storeCoins(opts.amount)
            .storeRef(opts.masterMsg ?? beginCell().endCell())
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body,
        });
    }

    async getTotalSupply(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_json_data', []);
        return result.stack.readBigNumber();
    }

    async getAdminAddress(provider: ContractProvider): Promise<Address> {
        const result = await provider.get('get_json_data', []);
        return result.stack.readAddress();
    }

    async getWalletAddress(provider: ContractProvider, ownerAddress: Address): Promise<Address> {
        const ownerAddressCell = beginCell().storeAddress(ownerAddress).endCell();
        const result = await provider.get('get_wallet_address', [{ type: 'slice', cell: ownerAddressCell }]);
        return result.stack.readAddress();
    }
}
