import { compile } from '@ton/blueprint';
import { Cell, beginCell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { JettonMinter } from '../wrappers/JettonMinter';
import '@ton/test-utils';

describe('JettonMinter', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('JettonMinter');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<JettonMinter>;

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
                    jettonWalletCode: code,
                },
                code,
            ),
        );

        const deployResult = await jettonMinter.sendDeploy(deployer.getSender(), toNano(0.05));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: true,
            success: true,
        });
    });

    it('Should deploy', async () => {});

    it('should total Supply equal balance of admin', async () => {
        const totalSupply = (await jettonMinter.getTotalSupply()).toString();

        expect(totalSupply).toBe(String(1000000));
    });
});
