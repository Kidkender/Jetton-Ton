import { compile, NetworkProvider } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { Address, toNano } from '@ton/core';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const addressMinter = Address.parse('EQC3oiXXrE8hYBAQi5GzNudG_RJMkiURSFEphl5-VlrlWWs6');
    const jettonMinterCode = await compile('JettonMinter');
    const jettonWalletCode = await compile('JettonWallet');

    const sender = provider.sender();
    if (!sender.address) {
        throw new Error(`Sender address not found`);
    }
    const addressToMint = await ui.inputAddress('Please enter address to mint: ');

    const amountToMint = await ui.input('Please enter amount to mint (integer): ');
    const parsedAmount = parseInt(amountToMint, 10);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Invalid amount entered. Please enter a positive integer.');
    }

    const minterContract = provider.open(JettonMinter.createFromAddress(addressMinter));

    const adminAddress = await minterContract.getAdminAddress();

    if (sender.address !== adminAddress) {
        throw new Error('Only admin addresses are allowed');
    }

    const result = await minterContract.sendMint(
        sender,
        addressToMint,
        toNano(amountToMint),
        toNano('0.05'),
        toNano('0.1'),
    );

    await provider.waitForDeploy(minterContract.address);
}
