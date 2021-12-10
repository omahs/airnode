import { mockEthers } from '../../test/mock-utils';

const checkAuthorizationStatusesMock = jest.fn();
const getTemplatesMock = jest.fn();
const estimateGasWithdrawalMock = jest.fn();
const failMock = jest.fn();
const fulfillMock = jest.fn();
const fulfillWithdrawalMock = jest.fn();
const staticFulfillMock = jest.fn();
mockEthers({
  airnodeRrpMocks: {
    callStatic: {
      fulfill: staticFulfillMock,
    },
    estimateGas: {
      fulfillWithdrawal: estimateGasWithdrawalMock,
    },
    checkAuthorizationStatuses: checkAuthorizationStatusesMock,
    fail: failMock,
    fulfill: fulfillMock,
    fulfillWithdrawal: fulfillWithdrawalMock,
    getTemplates: getTemplatesMock,
  },
});

import fs from 'fs';
import { BigNumber, ethers } from 'ethers';
import * as adapter from '@api3/airnode-adapter';
import * as validator from '@api3/airnode-validator';
import { startCoordinator } from './start-coordinator';
import * as fixtures from '../../test/fixtures';
import { BASE_FEE_MULTIPLIER, PRIORITY_FEE } from '../constants';
import { Config, GasTarget } from '../types';

describe('startCoordinator', () => {
  test.each(['1', '2'])(`fetches and processes requests - txType: %d`, async (txType) => {
    jest.setTimeout(30000);
    const initialConfig = fixtures.buildConfig();
    const config = {
      ...initialConfig,
      chains: initialConfig.chains.map((chain) => ({
        ...chain,
        chainOptions: {
          txType,
        },
      })),
    } as Config;
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));
    jest.spyOn(validator, 'validateJsonWithTemplate').mockReturnValue({ valid: true, messages: [] });

    const getBlockNumberSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBlockNumber');
    getBlockNumberSpy.mockResolvedValueOnce(12);

    const templateRequest = fixtures.evm.logs.buildMadeTemplateRequest();
    const getLogsSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getLogs');
    getLogsSpy.mockResolvedValueOnce([templateRequest]);

    const executeSpy = jest.spyOn(adapter, 'buildAndExecuteRequest') as jest.SpyInstance;
    executeSpy.mockResolvedValue({
      data: { result: '443.76381' },
      status: 200,
    });

    getTemplatesMock.mockResolvedValueOnce(fixtures.evm.airnodeRrp.getTemplates());
    checkAuthorizationStatusesMock.mockResolvedValueOnce([true]);

    const gasPriceSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getGasPrice');
    const blockSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBlock');

    const gasTarget = (() => {
      gasPriceSpy.mockReset();
      blockSpy.mockReset();
      if (txType === '1') {
        const gasPrice = ethers.BigNumber.from(1000);
        gasPriceSpy.mockResolvedValue(gasPrice);
        return { gasPrice };
      }

      const baseFeePerGas = ethers.BigNumber.from(1000);
      blockSpy.mockResolvedValue({ baseFeePerGas } as ethers.providers.Block);
      const maxPriorityFeePerGas = BigNumber.from(PRIORITY_FEE);
      const maxFeePerGas = baseFeePerGas.mul(BASE_FEE_MULTIPLIER).add(maxPriorityFeePerGas);

      return { maxPriorityFeePerGas, maxFeePerGas } as GasTarget;
    })();

    const txCountSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getTransactionCount');
    txCountSpy.mockResolvedValueOnce(212);

    const balanceSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBalance');
    balanceSpy.mockResolvedValueOnce(ethers.BigNumber.from(250_000_000));

    estimateGasWithdrawalMock.mockResolvedValueOnce(ethers.BigNumber.from(50_000));
    staticFulfillMock.mockResolvedValueOnce({ callSuccess: true });
    fulfillMock.mockResolvedValueOnce({
      hash: '0xad33fe94de7294c6ab461325828276185dff6fed92c54b15ac039c6160d2bac3',
    });

    await startCoordinator(config);

    // API call was submitted
    expect(fulfillMock).toHaveBeenCalledTimes(1);
    expect(fulfillMock).toHaveBeenCalledWith(
      '0x2b31642d1177b2f9f03c7df66ff707fb85fd129aa6fa2b95964530e74a86839c',
      '0xA30CA71Ba54E83127214D3271aEA8F5D6bD4Dace',
      '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      '0x7c1de7e1',
      '0x0000000000000000000000000000000000000000000000000000000002a5213d',
      '0x1e84aa4b6cae3e6c4e7132d47034db4fa3613ecf96b795c2cbb3676ddc77460d7be268236312701ccc1f2a0408171c9cfaf62606b8cfa2e5441caa991e4d49aa1b',
      { gasLimit: 500_000, ...gasTarget, nonce: 212 }
    );
  });

  it('returns early if there are no processable requests', async () => {
    const config = fixtures.buildConfig();
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));

    const getBlockNumberSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBlockNumber');
    getBlockNumberSpy.mockResolvedValueOnce(12);

    const getLogsSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getLogs');
    getLogsSpy.mockResolvedValueOnce([]);

    getTemplatesMock.mockResolvedValueOnce(fixtures.evm.airnodeRrp.getTemplates());
    checkAuthorizationStatusesMock.mockResolvedValueOnce([true]);

    const gasPriceSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getGasPrice');
    const executeSpy = jest.spyOn(adapter, 'buildAndExecuteRequest') as jest.SpyInstance;
    const txCountSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getTransactionCount');
    const balanceSpy = jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBalance');

    const contract = new ethers.Contract('address', ['ABI']);

    await startCoordinator(config);

    expect(gasPriceSpy).not.toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();
    expect(txCountSpy).not.toHaveBeenCalled();
    expect(balanceSpy).not.toHaveBeenCalled();
    expect(contract.fulfill).not.toHaveBeenCalled();
  });
});
