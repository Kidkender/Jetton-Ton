import { compile, NetworkProvider } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { Address, toNano } from '@ton/core';
import { JettonWallet } from '../wrappers/JettonWallet';

export async function run(provider: NetworkProvider) {
    const jettonWalletCode = await compile('JettonWallet');
    const senderAddress = provider.sender().address;
    if (!senderAddress) {
        throw new Error(`Sender address not found`);
    }

    const jettonMinter = provider.open(
        JettonMinter.createFromAddress(Address.parse('ENTER JETTON MINTER ADDRESS HERE')),
    );

    const userWallet = provider.open(
        JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(senderAddress)),
    );

    await userWallet.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(userWallet.address);
}
