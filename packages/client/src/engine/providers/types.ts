import {
  ExternalProvider,
  JsonRpcBatchProvider,
  JsonRpcProvider,
  Network,
  Networkish,
} from '@ethersproject/providers';
import { ConnectionInfo } from 'ethers/lib/utils';

import { create } from './create';

export enum ConnectionState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
}

export type Providers = ReturnType<typeof create>;

export interface ProviderConfig {
  chainId: number;
  jsonRpcUrl: string;
  wsRpcUrl?: string;
  externalProvider?: ExternalProvider;
  options?: { batch?: boolean; pollingInterval?: number; skipNetworkCheck?: boolean };
}

export class MUDJsonRpcProvider extends JsonRpcProvider {
  constructor(url: string | ConnectionInfo | undefined, network: Networkish) {
    super(url, network);
  }

  // Yominet does not support ENS, so this short-circuits resolver requests to avoid noisy errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _getResolver(_name: string): Promise<any> {
    return null;
  }
  async detectNetwork(): Promise<Network> {
    const network = this.network;
    if (network == null) {
      throw new Error('No network');
    }
    return network;
  }
}

export class MUDJsonRpcBatchProvider extends JsonRpcBatchProvider {
  constructor(url?: string | ConnectionInfo | undefined, network?: Networkish | undefined) {
    super(url, network);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _getResolver(_name: string): Promise<any> {
    return null;
  }
  async detectNetwork(): Promise<Network> {
    const network = this.network;
    if (network == null) {
      throw new Error('No network');
    }
    return network;
  }
}
