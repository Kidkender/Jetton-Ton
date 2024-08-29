import { toNano } from '@ton/core';
import { Token } from '../wrappers/Token';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const token = provider.open(
        Token.createFromConfig(
            {
                id: Math.floor(Math.random() * 10000),
                counter: 0,
            },
            await compile('Token'),
        ),
    );

    await token.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(token.address);

    console.log('ID', await token.getID());
}
