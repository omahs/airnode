import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Config } from '@api3/airnode-node';
import { logger } from '@api3/airnode-utilities';
import { runCommand, runCommandInBackground } from '../utils';

const integration = 'coingecko-cross-chain-authorizer';

const chooseIntegration = () => {
  // We can't use the interactive script to choose the integration, so we specify the details manually
  const content = JSON.stringify(
    {
      integration: integration,
      airnodeType: 'local',
      network: 'localhost',
      mnemonic: 'test test test test test test test test test test test junk',
      providerUrl: 'http://127.0.0.1:8545/',
      // cross-chain is the same chain in E2E testing
      crossChainNetwork: 'localhost',
      crossChainProviderUrl: 'http://127.0.0.1:8545/',
      crossChainMnemonic: 'test test test test test test test test test test test junk',
    },
    null,
    2
  );
  writeFileSync(join(__dirname, '../../integration-info.json'), content);
};

const removeFulfillmentGasLimit = () => {
  const configPath = join(__dirname, `../../integrations/${integration}/config.json`);
  const config: Config = JSON.parse(readFileSync(configPath, 'utf8'));
  delete config.chains[0].options.fulfillmentGasLimit;
  writeFileSync(configPath, JSON.stringify(config, null, 2));
};

describe('Coingecko integration with containerized Airnode and hardhat', () => {
  it('works', () => {
    chooseIntegration();

    runCommand('yarn deploy-rrp');
    runCommand('yarn deploy-rrp-dry-run');
    runCommand('yarn create-airnode-config');
    runCommand('yarn create-airnode-secrets');
    removeFulfillmentGasLimit();
    runCommand(`yarn ts-node integrations/${integration}/deploy-authorizers-and-update-config`);
    runCommandInBackground('yarn run-airnode-locally');

    // Try running the rest of the commands, but make sure to kill the Airnode running in background process gracefully.
    // We need to do this otherwise Airnode will continue running in the background forever
    try {
      runCommand('yarn deploy-requester');
      runCommand('yarn derive-and-fund-sponsor-wallet');
      runCommand('yarn sponsor-requester');
      const response = runCommand('yarn make-request');

      const pathOfResponseText = 'Ethereum price is';
      expect(response).toContain(pathOfResponseText);

      const priceText = response.split(pathOfResponseText)[1];
      expect(priceText).toContain('USD');

      const price = priceText.split('USD')[0].trim();
      expect(Number(price)).toEqual(expect.any(Number));
      expect(Number(price).toString()).toBe(price);

      logger.log(`The Ethereum price is ${price} USD.`);
    } finally {
      runCommand('yarn stop-local-airnode');
    }
  });
});
