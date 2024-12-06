import { compile } from '@ton/blueprint';
import { Cell, beginCell, comment, toNano, Address, ContractState, ContractProvider } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { JettonMinter } from '../wrappers/JettonMinter';
import '@ton/test-utils';
import { BigNumber } from 'tronweb';
import { JettonWallet } from '../wrappers/JettonWallet';

describe('JettonMinter', () => {
    let minterCode: Cell;
    let walletCode: Cell;

    beforeAll(async () => {
        minterCode = await compile('JettonMinter');
        walletCode = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let recipient: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<JettonMinter>;
    let jettonWallet: SandboxContract<JettonWallet>;
    let userWallet: any;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        recipient = await blockchain.treasury('recipient');

        const config = {
            totalSupply: toNano('1000'),
            adminAddress: deployer.address,
            content: new Cell(),
            jettonWalletCode: walletCode,
        };
        jettonMinter = blockchain.openContract(JettonMinter.createFromConfig(config, minterCode));

        const deployResult = await jettonMinter.sendDeploy(deployer.getSender(), toNano(0.05));

        userWallet = async (address: Address) =>
            blockchain.openContract(JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(address)));
        console.log('address of contract when deployed: ', jettonMinter.address);
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: true,
            success: true,
        });
    });

    it('Should original data must be equal with initialize', async () => {
        const totalSupply = await jettonMinter.getTotalSupply();
        const adminAddress = await jettonMinter.getAdminAddress();

        expect(totalSupply).toEqual(toNano('1000'));
        expect(adminAddress).toEqualAddress(deployer.address);
    });

    it('Should mint tokens correctly', async () => {
        console.log('contract address in function: ', jettonMinter.address);
        const adminAddress = await jettonMinter.getAdminAddress();
        const addressDeployer = deployer.address;

        console.log('admin address: ' + adminAddress);
        console.log('addressDeployer: ' + addressDeployer);

        const initialTotalSupply = await jettonMinter.getTotalSupply();
        console.log('initial totalSupply: ' + initialTotalSupply);
        const amountToMint = toNano('100');

        const mintResult = await jettonMinter.sendMint(
            recipient.getSender(),
            deployer.address,
            amountToMint,
            toNano('0.05'),
            toNano('1'),
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: recipient.address,
            success: true,
        });

        let totalSupplyAfterMint = await jettonMinter.getTotalSupply();
        console.log('Total Supply After Mint: ', totalSupplyAfterMint.toString());

        await new Promise((resolve) => setTimeout(resolve, 1000));

        totalSupplyAfterMint = await jettonMinter.getTotalSupply();
        console.log('Total Supply After Delay: ', totalSupplyAfterMint.toString());

        // expect(totalSupplyAfterMint).toBeGreaterThanOrEqual(initialTotalSupply + amountToMint);
    });
});
