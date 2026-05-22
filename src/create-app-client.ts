import { FetchClient } from './core/fetch-client';
import type { FetchClientConfig } from './core/types';
import { createAuthPlugin, type AuthPlugin } from './plugins/auth/auth-plugin';
import type { AuthConfig } from './plugins/auth/types';
import {
    createSSLErrorPlugin,
    type SSLErrorPluginConfig,
} from './plugins/ssl/ssl-plugin';
import { createUploadPlugin, type UploadPlugin } from './plugins/upload/upload-plugin';

/** `true` registers the plugin with default options */
export type AppClientSslOption = SSLErrorPluginConfig | boolean;
export type AppClientUploadOption = boolean;

export interface CreateAppClientOptions extends FetchClientConfig {
    /** Register SSL error interceptor via `client.use()` */
    ssl?: AppClientSslOption;
    /** Register auth plugin (async init, singleton per client) */
    auth?: AuthConfig;
    /** Register upload plugin */
    upload?: AppClientUploadOption;
}

export interface AppClient {
    client: FetchClient;
    auth?: AuthPlugin;
    upload?: UploadPlugin;
}

/**
 * Creates a FetchClient and optionally wires plugins in the recommended order:
 * SSL → auth → upload. Sugar only — same behavior as manual setup.
 */
export async function createAppClient(
    options: CreateAppClientOptions
): Promise<AppClient> {
    const { ssl, auth, upload, ...clientConfig } = options;

    const client = new FetchClient(clientConfig);

    if (ssl) {
        const sslConfig = ssl === true ? {} : ssl;
        await client.use(createSSLErrorPlugin(sslConfig));
    }

    let authPlugin: AuthPlugin | undefined;
    if (auth) {
        authPlugin = await createAuthPlugin(client, auth);
    }

    let uploadPlugin: UploadPlugin | undefined;
    if (upload) {
        uploadPlugin = createUploadPlugin(client);
    }

    return {
        client,
        ...(authPlugin && { auth: authPlugin }),
        ...(uploadPlugin && { upload: uploadPlugin }),
    };
}
