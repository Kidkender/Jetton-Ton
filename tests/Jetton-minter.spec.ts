import { compile } from '@ton/blueprint';
import { Cell, beginCell, comment, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { JettonMinter } from '../wrappers/JettonMinter';
import '@ton/test-utils';
import { JettonWallet } from '@ton/ton';

describe('JettonMinter', () => {
    let minterCode: Cell;
    let walletCode: Cell;

    beforeAll(async () => {
        minterCode = await compile('JettonMinter');
        walletCode = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<JettonMinter>;
    let jettonWallet: SandboxContract<JettonWallet>;
    let userWallet: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        const AdminAddressSlice = beginCell().storeAddress(deployer.address).endCell().beginParse();

        jettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    totalSupply: BigInt(1000000),
                    adminAddress: AdminAddressSlice,
                    content: new Cell(),
                    jettonWalletCode: walletCode,
                },
                walletCode,
            ),
        );

        const deployResult = await jettonMinter.sendDeploy(deployer.getSender(), toNano(0.05));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: true,
            success: true,
        });

        // userWallet = blockchain.openContract(JettonWallet.cr)
    });

    it('Should deploy', async () => {});

    it('should total Supply equal balance of admin', async () => {
        const totalSupply = (await jettonMinter.getTotalSupply()).toString();

        expect(totalSupply).toBe(String(1000000));
    });
});
