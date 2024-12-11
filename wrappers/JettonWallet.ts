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

    static transferMessage(
        to_address: Address,
        jetton_amount: bigint,
        response_address: Address,
        custom_payload: Cell | null,
        forward_ton_amount: bigint,
        forward_payload: Cell | null,
    ) {
        return beginCell()
            .storeUint(Opcodes.transfer, 32)
            .storeUint(0, 64)
            .storeCoins(jetton_amount)
            .storeAddress(to_address)
            .storeAddress(response_address)
            .storeMaybeRef(custom_payload)
            .storeCoins(forward_ton_amount)
            .storeMaybeRef(forward_payload)
            .endCell();
    }

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        jetton_amount: bigint,
        to_address: Address,
        response_address: Address,
        custom_payload: Cell | null,
        forward_ton_amount: bigint,
        forward_payload: Cell | null,
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.transferMessage(
                to_address,
                jetton_amount,
                response_address,
                custom_payload,
                forward_ton_amount,
                forward_payload,
            ),
            value,
        });
    }

    static burnMessage(jetton_amount: bigint, response_address: Address, custom_payload: Cell | null) {
        return beginCell()
            .storeUint(Opcodes.burn, 32)
            .storeUint(0, 64) // op, queryId
            .storeCoins(jetton_amount)
            .storeAddress(response_address)
            .storeMaybeRef(custom_payload)
            .endCell();
    }

    async sendBurn(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        jetton_amount: bigint,
        response_address: Address,
        custom_payload: Cell | null,
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.burnMessage(jetton_amount, response_address, custom_payload),
            value: value,
        });
    }
    async getDataWallet(provider: ContractProvider): Promise<{
        balance: bigint;
        owner_address: Address;
        jetton_master_address: Address;
        jetton_wallet_code: Cell;
    }> {
        const result = await provider.get('get_wallet_data', []);
        return {
            balance: result.stack.readBigNumber(),
            owner_address: result.stack.readAddress(),
            jetton_master_address: result.stack.readAddress(),
            jetton_wallet_code: result.stack.readCell(),
        };
    }

    async getBalance(provider: ContractProvider): Promise<bigint> {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            return 0n;
        }
        const result = await this.getDataWallet(provider);
        return result.balance;
    }

    async getOwnerAddress(provider: ContractProvider): Promise<Address> {
        const result = await this.getDataWallet(provider);
        return result.owner_address;
    }

    async getJettonMasterAddress(provider: ContractProvider): Promise<Address> {
        const result = await this.getDataWallet(provider);
        return result.jetton_master_address;
    }
}
