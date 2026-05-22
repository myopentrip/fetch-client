import type { FetchClientLike, FetchClientPlugin } from '../../core/types';
import {
    createSSLErrorInterceptor,
    type SSLErrorConfig,
} from './ssl-error-handler';

export interface SSLErrorPluginConfig extends SSLErrorConfig {
    debug?: boolean;
}

export function createSSLErrorPlugin(
    config: SSLErrorPluginConfig = {}
): FetchClientPlugin {
    const { debug = false, ...sslConfig } = config;

    return {
        name: 'ssl-error',
        setup(client: FetchClientLike) {
            client.addErrorInterceptor(
                createSSLErrorInterceptor(
                    {
                        enableAutoTransform: sslConfig.enableAutoTransform ?? true,
                        includeTechnicalDetails:
                            sslConfig.includeTechnicalDetails ?? debug,
                        includeSuggestions: sslConfig.includeSuggestions ?? true,
                        customTransformer: sslConfig.customTransformer,
                    },
                    debug
                )
            );
        },
    };
}
