import { Sha256 } from '@aws-crypto/sha256-js';
import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode,
    Slice,
    toNano,
} from '@ton/core';
import { Opcodes } from './opCode';

const ONCHAIN_CONTENT_PREFIX = 0x00;
const OFFCHAIN_CONTENT_PREFIX = 0x01;
const SNAKE_PREFIX = 0x00;
const MAX_CELL_SIZE = 1024;

export type JettonMinterConfig = {
    totalSupply: bigint;
    adminAddress: Address;
    content: Cell;
    jettonWalletCode: Cell;
};

export type JettonMinterContent = {
    type: 0 | 1;
    uri: string;
};

export function buildJettonOffChainMetadata(contentUri: string): Cell {
    return beginCell().storeInt(OFFCHAIN_CONTENT_PREFIX, 8).storeBuffer(Buffer.from(contentUri, 'ascii')).endCell();
}

export function parseJettonContent(cell: Cell): JettonMinterContent {
    const slice = cell.beginParse();
    const type = slice.loadUint(8) as 0 | 1;
    const uri = slice.loadStringTail();
    return { type, uri };
}

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
    return beginCell()
        .storeCoins(config.totalSupply)
        .storeAddress(config.adminAddress)
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

    static mintMessage(
        from: Address,
        to: Address,
        jetton_amount: bigint,
        forward_ton_amount: bigint,
        total_ton_amount: bigint,
        query_id: number | bigint = 0,
    ) {
        const mintMsg = beginCell()
            .storeUint(Opcodes.internal_transfer, 32)
            .storeUint(0, 64)
            .storeCoins(jetton_amount)
            .storeAddress(null)
            .storeAddress(from)
            .storeCoins(forward_ton_amount)
            .storeMaybeRef(null)
            .endCell();

        return beginCell()
            .storeUint(Opcodes.mint, 32)
            .storeUint(query_id, 64)
            .storeAddress(to)
            .storeCoins(total_ton_amount)
            .storeCoins(jetton_amount)
            .storeRef(mintMsg)
            .endCell();
    }

    async sendMint(
        provider: ContractProvider,
        via: Sender,
        toAddress: Address,
        jetton_amount: bigint,
        forward_ton_amount: bigint,
        total_ton_amount: bigint,
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinter.mintMessage(
                this.address,
                toAddress,
                jetton_amount,
                forward_ton_amount,
                total_ton_amount,
            ),
            value: total_ton_amount + toNano('0.015'),
        });
    }

    static discoveryMessage(owner_address: Address, include_address: boolean) {
        return beginCell()
            .storeUint(Opcodes.provide_wallet_address, 32)
            .storeUint(0, 64)
            .storeAddress(owner_address)
            .storeBit(include_address)
            .endCell();
    }

    async sendDiscovery(
        provider: ContractProvider,
        via: Sender,
        owner_address: Address,
        include_address: boolean,
        value: bigint = toNano('0.1'),
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinter.discoveryMessage(owner_address, include_address),
            value: value,
        });
    }

    async getJsonData(provider: ContractProvider): Promise<{
        totalSupply: bigint;
        mintable: number;
        adminAddress: Address;
        content: Cell;
        jettonWalletCode: Cell;
    }> {
        const result = await provider.get('get_json_data', []);
        return {
            totalSupply: result.stack.readBigNumber(),
            mintable: result.stack.readNumber(),
            adminAddress: result.stack.readAddress(),
            content: result.stack.readCell(),
            jettonWalletCode: result.stack.readCell(),
        };
    }

    async getTotalSupply(provider: ContractProvider): Promise<bigint> {
        const result = await this.getJsonData(provider);
        return result.totalSupply;
    }

    async getAdminAddress(provider: ContractProvider): Promise<Address> {
        const result = await this.getJsonData(provider);
        return result.adminAddress;
    }

    async getWalletAddress(provider: ContractProvider, ownerAddress: Address): Promise<Address> {
        const ownerAddressCell = beginCell().storeAddress(ownerAddress).endCell();
        const result = await provider.get('get_wallet_address', [{ type: 'slice', cell: ownerAddressCell }]);
        return result.stack.readAddress();
    }

    async getContent(provider: ContractProvider): Promise<Cell> {
        const result = await this.getJsonData(provider);
        return result.content;
    }

    static changeAdminMessage(newAdmin: Address) {
        return beginCell().storeUint(Opcodes.change_admin, 32).storeUint(0, 64).storeAddress(newAdmin).endCell();
    }

    async sendChangeAdmin(provider: ContractProvider, via: Sender, newAdmin: Address) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinter.changeAdminMessage(newAdmin),
            value: toNano('0.05'),
        });
    }

    static changeContentMessage(content: Cell) {
        return beginCell().storeUint(Opcodes.change_content, 32).storeUint(0, 64).storeRef(content).endCell();
    }

    async sendChangeContent(provider: ContractProvider, via: Sender, newContent: Cell) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinter.changeContentMessage(newContent),
            value: toNano('0.05'),
        });
    }
}
