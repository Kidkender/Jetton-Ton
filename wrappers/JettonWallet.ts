import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Opcodes } from './opCode';

export type JettonWalletConfig = {
    balance: bigint;
    ownerAddress: Address;
    jettonMasterAddress: Address;
    jettonWalletCode: Cell;
};

export function jettonWalletConfigToCell(config: JettonWalletConfig): Cell {
    return beginCell()
        .storeCoins(config.balance)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.jettonMasterAddress)
        .storeRef(config.jettonWalletCode)
        .endCell();
}

export class JettonWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: {
            code: Cell;
            data: Cell;
        },
    ) {}

    static createFromAddress(address: Address) {
        return new JettonWallet(address);
    }

    static createFromConfig(config: JettonWalletConfig, code: Cell, workchain = 0) {
        const data = jettonWalletConfigToCell(config);
        const init = { code, data };
        return new JettonWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async transfer(
        provider: ContractProvider,
        via: Sender,
        opts: {
            toAddress: Address;
            jettonAmount: bigint;
            forwardTonAmount: bigint;
            value: bigint;
            responseAddress?: Address;
            queryId?: number;
            masterMsg?: Cell; // forward payload
        },
    ) {
        const body = beginCell()
            .storeUint(Opcodes.internal_transfer, 32)
            .storeUint(opts.queryId ?? 0, 64)
            .storeCoins(opts.jettonAmount)
            .storeAddress(opts.toAddress)
            .storeAddress(opts.responseAddress ?? null)
            .storeCoins(opts.forwardTonAmount)
            .storeRef(opts.masterMsg ?? beginCell().endCell())
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body,
        });
    }

    async getBalance(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_wallet_data', []);
        return result.stack.readBigNumber();
    }

    async getOwnerAddress(provider: ContractProvider): Promise<Address> {
        const result = await provider.get('get_wallet_data', []);
        return result.stack.readAddress();
    }

    async getJettonMasterAddress(provider: ContractProvider): Promise<Address> {
        const result = await provider.get('get_wallet_data', []);
        return result.stack.readAddress();
    }
}
