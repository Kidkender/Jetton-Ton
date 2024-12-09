import { compile } from '@ton/blueprint';
import { Cell, beginCell, comment, toNano, Address, ContractState, ContractProvider } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { JettonMinter } from '../wrappers/JettonMinter';
import '@ton/test-utils';
import { BigNumber } from 'tronweb';
import { JettonWallet } from '../wrappers/JettonWallet';
import { EError } from '../wrappers/errors.constant';
import { Opcodes } from './../wrappers/opCode';

describe('JettonMinter', () => {
    let minterCode: Cell;
    let walletCode: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let recipient: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<JettonMinter>;
    let userWallet: any;

    beforeAll(async () => {
        minterCode = await compile('JettonMinter');
        walletCode = await compile('JettonWallet');

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

    it('Only admin can mint', async () => {
        const initialTotalSupply = await jettonMinter.getTotalSupply();
        const amountToMint = toNano('100');

        const mintResult = await jettonMinter.sendMint(
            deployer.getSender(),
            deployer.address,
            amountToMint,
            toNano('0.05'),
            toNano('1'),
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: await jettonMinter.getWalletAddress(deployer.address),
            success: true,
        });

        const mintResultDifferent = await jettonMinter.sendMint(
            deployer.getSender(),
            recipient.address,
            amountToMint,
            toNano('0.05'),
            toNano('1'),
        );

        expect(mintResultDifferent.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            success: true,
        });

        const recipientBalance = await userWallet(recipient.address);
        expect(amountToMint).toEqual(await recipientBalance.getBalance());

        const totalSupplyAfterMint = await jettonMinter.getTotalSupply();

        expect(totalSupplyAfterMint).toEqual(initialTotalSupply + amountToMint * BigInt(2));
    });

    it('Not admin can not mint', async () => {
        const amountToMint = toNano('100');

        const mintResult = await jettonMinter.sendMint(
            recipient.getSender(),
            deployer.address,
            amountToMint,
            toNano('0.05'),
            toNano('1'),
        );

        console.log('original address recipient: ' + recipient.address);
        console.log('original address owner: ' + deployer.address);
        console.log('address wallet recipient: ', await jettonMinter.getWalletAddress(recipient.address));
        console.log('address wallet owner: ', await jettonMinter.getWalletAddress(deployer.address));
        console.log('address jetton: ', jettonMinter.address);

        expect(mintResult.transactions).toHaveTransaction({
            from: recipient.address,
            to: jettonMinter.address,
            aborted: true,
            exitCode: EError.not_admin,
        });
    });

    // it('', () => {});
});
