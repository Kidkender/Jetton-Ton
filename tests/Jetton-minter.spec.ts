import { compile } from '@ton/blueprint';
import { Address, Cell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';
import { jettonContentToCell, JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { EError } from '../wrappers/errors.constant';

describe('JettonMinter', () => {
    let minterCode: Cell;
    let walletCode: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let recipient: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<JettonMinter>;
    let defaultContent: Cell;

    beforeAll(async () => {
        minterCode = await compile('JettonMinter');

        walletCode = await compile('JettonWallet');
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        recipient = await blockchain.treasury('recipient');
        defaultContent = jettonContentToCell({
            name: 'example',
            symbol: 'example',
            decimals: 4,
            uri: 'originalData.github.com',
            image: null,
            description: null,
        });
        const config = {
            totalSupply: toNano('0'),
            adminAddress: deployer.address,
            content: defaultContent,
            jettonWalletCode: walletCode,
        };

        jettonMinter = blockchain.openContract(JettonMinter.createFromConfig(config, minterCode));

        const deployResult = await jettonMinter.sendDeploy(deployer.getSender(), toNano(0.05));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: true,
            success: true,
        });
    });

    async function getUserWallet(address: Address): Promise<SandboxContract<JettonWallet>> {
        const walletAddress = await jettonMinter.getWalletAddress(address);
        return blockchain.openContract(JettonWallet.createFromAddress(walletAddress));
    }

    it('Should match initialized data', async () => {
        const totalSupply = await jettonMinter.getTotalSupply();
        const adminAddress = await jettonMinter.getAdminAddress();
        const adminJettonWallet = await getUserWallet(adminAddress);
        console.log('admin amount: ' + (await adminJettonWallet.getBalance()));

        expect(totalSupply).toEqual(toNano('1000'));
        expect(adminAddress).toEqualAddress(deployer.address);
    });

    it('Only admin can mint', async () => {
        const initialTotalSupply = await jettonMinter.getTotalSupply();
        const amountToMint = toNano('1123');
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

        const totalSupplyAfterMint = await jettonMinter.getTotalSupply();

        expect(totalSupplyAfterMint).toEqual(initialTotalSupply + amountToMint);
    });

    it('Non-admin cannot mint', async () => {
        const amountToMint = toNano('100');

        const mintResult = await jettonMinter.sendMint(
            recipient.getSender(),
            deployer.address,
            amountToMint,
            toNano('0.05'),
            toNano('1'),
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: recipient.address,
            to: jettonMinter.address,
            aborted: true,
            exitCode: EError.not_admin,
        });
    });

    it('Admin can change address', async () => {
        const initialAdmin = await jettonMinter.getAdminAddress();
        expect(initialAdmin).toEqualAddress(deployer.address);
        const changeAdminResult = await jettonMinter.sendChangeAdmin(deployer.getSender(), recipient.address);

        expect(changeAdminResult.transactions).toHaveTransaction({
            from: deployer.address,
            on: jettonMinter.address,
            success: true,
        });

        const updatedAdmin = await jettonMinter.getAdminAddress();
        expect(updatedAdmin).toEqualAddress(recipient.address);

        await jettonMinter.sendChangeAdmin(recipient.getSender(), deployer.address);
    });

    it('Admin can change content', async () => {
        const newContent = jettonContentToCell({
            name: 'example',
            symbol: 'example',
            decimals: 9,
            description: null,
            image: null,
            uri: null,
        });
        expect((await jettonMinter.getContent()).equals(defaultContent)).toBe(true);

        const changeContentResult = await jettonMinter.sendChangeContent(deployer.getSender(), newContent);
        expect(changeContentResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            success: true,
        });

        const updatedContent = (await jettonMinter.getContent()).beginParse().loadStringTail().toString();
        expect(updatedContent).toEqual('example.github.com');
    });

    it('Wallet owner can burn jettons', async () => {
        const deployerWallet = await getUserWallet(deployer.address);
        const initialBalance = await deployerWallet.getBalance();
        const initialSupply = await jettonMinter.getTotalSupply();
        const burnAmount = toNano('23');

        const burnResult = await deployerWallet.sendBurn(
            deployer.getSender(),
            toNano('0.1'),
            burnAmount,
            deployer.address,
            null,
        );

        expect(burnResult.transactions).toHaveTransaction({
            from: deployerWallet.address,
            to: jettonMinter.address,
        });

        expect(await deployerWallet.getBalance()).toEqual(initialBalance - burnAmount);
        expect(await jettonMinter.getTotalSupply()).toEqual(initialSupply - burnAmount);
    });

    it('Non-owner cannot burn jettons', async () => {
        const deployerWallet = await getUserWallet(deployer.address);
        const burnAmount = toNano('10');

        const burnResult = await deployerWallet.sendBurn(
            recipient.getSender(),
            toNano('0.1'),
            burnAmount,
            deployer.address,
            null,
        );

        expect(burnResult.transactions).toHaveTransaction({
            from: recipient.address,
            to: deployerWallet.address,
            aborted: true,
            exitCode: EError.not_owner,
        });
    });

    it('Wallet has sufficient balance for transfer', async () => {
        const deployerWallet = await getUserWallet(deployer.address);
        const recipientWallet = await getUserWallet(recipient.address);

        const initialSenderBalance = await deployerWallet.getBalance();
        const initialRecipientBalance = await recipientWallet.getBalance();
        const transferAmount = toNano('10');

        const transferResult = await deployerWallet.sendTransfer(
            deployer.getSender(),
            toNano('0.2'),
            transferAmount,
            recipient.address,
            deployer.address,
            null,
            toNano('0.1'),
            null,
        );

        const finalSenderBalance = await deployerWallet.getBalance();
        const finalRecipientBalance = await recipientWallet.getBalance();

        expect(transferResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: deployerWallet.address,
            success: true,
        });

        expect(finalSenderBalance).toEqual(initialSenderBalance - transferAmount);
        expect(finalRecipientBalance).toEqual(initialRecipientBalance + transferAmount);
    });
});
