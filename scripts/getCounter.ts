import { NetworkProvider } from '@ton/blueprint';
import { Token } from '../wrappers/Token';
import { Address } from '@ton/core';

export async function run(provider: NetworkProvider) {
    const addressContract = 'EQBZYTFiPubegj8wXW57_04N2MZ2it4_Y_TMsURVMIZ1vS3L';
    const ui = provider.ui();
    const address = Address.parse(addressContract);

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    ui.write(`Provider address: ${provider.sender().address}`);

    const token = provider.open(new Token(address));
    const currentCounter = await token.getCounter();
    const currentId = await token.getID();

    ui.write(`Current counter: ${currentCounter}`);
    ui.write(`Current Id: ${currentId}`);
}
