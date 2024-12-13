import { toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { jettonContentToCell, JettonMinter } from '../wrappers/JettonMinter';

export async function run(provider: NetworkProvider) {
    const walletCode = await compile('JettonWallet');
    const senderAddress = provider.sender().address;
    if (!senderAddress) {
        throw new Error(`Sender address not found`);
    }
    const contentUrl =
        'https://gist.githubusercontent.com/Kidkender/433f7a7b70a39b7ab0f72475980ea63f/raw/60c7c10989a94fe8b996a5dd6c5da6f76bc1797e/jetton-minter-metata.json';

    const content = jettonContentToCell({ type: 1, uri: contentUrl });

    const jetton = provider.open(
        JettonMinter.createFromConfig(
            {
                totalSupply: toNano('0'),
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
