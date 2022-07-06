import { getGasPrice, getGasLimit, logger } from '@api3/airnode-utilities';
import * as fulfillments from '../fulfillments';
import * as nonces from '../../requests/nonces';
import * as state from '../../providers/state';
// import * as utils from '../utils';
import { EVMProviderSponsorState, ProviderState } from '../../types';

export async function processTransactions(
  initialState: ProviderState<EVMProviderSponsorState>
): Promise<ProviderState<EVMProviderSponsorState>> {
  const { chainOptions, chainId, chainType, name: providerName } = initialState.settings;
  const { coordinatorId } = initialState;

  const baseLogOptions = {
    format: initialState.settings.logFormat,
    level: initialState.settings.logLevel,
    meta: { coordinatorId, providerName, chainType, chainId },
  };

  // =================================================================
  // STEP 1: Re-instantiate any classes
  // =================================================================

  // TODO: Improve TS for refresh function
  const state1 = state.refresh(initialState) as ProviderState<EVMProviderSponsorState>;

  // =================================================================
  // STEP 2: Assign nonces to processable requests
  // =================================================================
  const requestsWithNonces = nonces.assign(initialState);
  const state2 = state.update(state1, { requests: requestsWithNonces });

  // =================================================================
  // STEP 3: Get the latest gas price
  // =================================================================
  const [logs, gasPrice] = await getGasPrice(state2.provider, chainOptions.gasPriceOracle);
  logger.logPending(logs, baseLogOptions);

  const gasPriceWithType =
    chainOptions.txType === 'eip1559'
      ? { type: 2, maxFeePerGas: gasPrice, maxPriorityFeePerGas: gasPrice }
      : { type: 0, gasPrice };
  const gasTarget = {
    ...gasPriceWithType,
    ...getGasLimit(chainOptions.fulfillmentGasLimit),
  };
  const state3 = state.update(state2, { gasTarget });

  // =================================================================
  // STEP 4: Submit transactions for each wallet
  // =================================================================
  const requestsWithFulfillments = await fulfillments.submit(state3);
  const state4 = state.update(state3, { requests: requestsWithFulfillments });

  return state4;
}
