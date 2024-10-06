import { Address, toNano } from '@ton/core';
import { Token } from '../wrappers/Token';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Token address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const token = provider.open(Token.createFromAddress(address));

    const counterBefore = await token.getCounter();

    await token.sendIncrease(provider.sender(), {
        increaseBy: 15,
        value: toNano('0.05'),
        queryID: 125,
    });

    ui.write('Waiting for counter to increase...');

    let counterAfter = await token.getCounter();
    let attempt = 1;
    while (counterAfter === counterBefore) {
        ui.setActionPrompt(`Attempt ${attempt}`);
        await sleep(2000);
        counterAfter = await token.getCounter();
        attempt++;
    }

    ui.clearActionPrompt();
    ui.write('Counter increased successfully!');
}
