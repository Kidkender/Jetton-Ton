import { toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { buildJettonOffChainMetadata, JettonMinter } from '../wrappers/JettonMinter';

export async function run(provider: NetworkProvider) {
    const walletCode = await compile('JettonWallet');
    const senderAddress = provider.sender().address;
    if (!senderAddress) {
        throw new Error(`Sender address not found`);
    }
    const contentUrl = await provider.ui().input('Please enter the content URL: ');

    const content = buildJettonOffChainMetadata(contentUrl);

    const jetton = provider.open(
        JettonMinter.createFromConfig(
            {
                totalSupply: toNano('10'),
                jettonWalletCode: walletCode,
                adminAddress: senderAddress,
                content: content,
            },
            await compile('JettonMinter'),
        ),
    );

    await jetton.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(jetton.address);

    console.log('Deploy address', jetton.address.toString());
    return jetton.address.toString();
}
