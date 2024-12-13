import { NetworkProvider } from '@ton/blueprint';
import { Address } from '@ton/core';
import { JettonMinter, parseJettonContent } from '../wrappers/JettonMinter';

export async function run(provider: NetworkProvider) {
    const addressContract = 'EQC3oiXXrE8hYBAQi5GzNudG_RJMkiURSFEphl5-VlrlWWs6';
    const ui = provider.ui();
    const address = Address.parse(addressContract);

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    ui.write(`Provider address: ${provider.sender().address}`);

    const jetton = provider.open(new JettonMinter(address));
    const admin = await jetton.getAdminAddress();
    const totalSupply = await jetton.getTotalSupply();
    const cellContent = await jetton.getContent();
    const content = parseJettonContent(cellContent);
    ui.write(`Raw cell content: ${content.uri}`);

    ui.write(`Current admin: ${admin}`);
    ui.write(`Total supply: ${totalSupply}`);
}
