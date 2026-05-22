import type { RetryConfig, FetchError, FetchResponse } from '../types';
import { isRecoveredResponse } from './interceptor-manager';

export class RetryManager {
    private config: RetryConfig;
    private debugMode: boolean;

    constructor(config: Partial<RetryConfig> = {}, debugMode: boolean = false) {
        this.config = {
            maxRetries: config.maxRetries ?? 0,
            baseDelay: config.baseDelay ?? 1000,
            maxDelay: config.maxDelay ?? 30000,
            backoffFactor: config.backoffFactor ?? 2,
            jitter: config.jitter !== false,
            retryCondition: config.retryCondition ?? this.defaultRetryCondition,
        };
        this.debugMode = debugMode;
    }

    updateConfig(config: Partial<RetryConfig>): void {
        this.config = { ...this.config, ...config };
        if (this.debugMode) this.log('Retry configuration updated', this.config);
    }

    getConfig(): RetryConfig {
        return { ...this.config };
    }

    calculateRetryDelay(attempt: number): number {
        let delay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt);

        if (this.config.jitter) {
            const jitterRange = delay * 0.1;
            const jitter = (Math.random() - 0.5) * 2 * jitterRange;
            delay += jitter;
        }

        return Math.min(delay, this.config.maxDelay);
    }

    shouldRetry(error: FetchError, attempt: number): boolean {
        return (
            attempt < this.config.maxRetries &&
            !!this.config.retryCondition &&
            this.config.retryCondition(error, attempt)
        );
    }

    async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async executeWithRetry<T>(
        fn: () => Promise<T>,
        context?: string,
        onFinalError?: (error: FetchError) => Promise<FetchError | FetchResponse<unknown>>
    ): Promise<T> {
        let lastError: FetchError | undefined;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as FetchError;

                if (!this.shouldRetry(lastError, attempt)) {
                    break;
                }

                const delay = this.calculateRetryDelay(attempt);
                if (this.debugMode) {
                    this.log(`${context ?? 'Operation'} failed, retrying in ${Math.round(delay)}ms`, {
                        attempt: attempt + 1,
                        error: lastError.message,
                    });
                }
                await this.sleep(delay);
            }
        }

        if (lastError && onFinalError) {
            const result = await onFinalError(lastError);
            if (isRecoveredResponse(result)) {
                return result as T;
            }
            lastError = result;
        }

        throw lastError ?? new Error('Request failed with unknown error');
    }

    static createConfig(
        scenario: 'aggressive' | 'conservative' | 'network-only' | 'custom',
        custom?: Partial<RetryConfig>
    ): RetryConfig {
        switch (scenario) {
            case 'aggressive':
                return {
                    maxRetries: 5,
                    baseDelay: 500,
                    maxDelay: 10000,
                    backoffFactor: 1.5,
                    jitter: true,
                    retryCondition: (error) =>
                        !error.status ||
                        error.status >= 500 ||
                        error.status === 429 ||
                        error.status === 408,
                };
            case 'conservative':
                return {
                    maxRetries: 2,
                    baseDelay: 2000,
                    maxDelay: 30000,
                    backoffFactor: 3,
                    jitter: true,
                    retryCondition: (error) =>
                        !error.status || error.status === 503 || error.status === 504,
                };
            case 'network-only':
                return {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 15000,
                    backoffFactor: 2,
                    jitter: true,
                    retryCondition: (error) => !error.status,
                };
            case 'custom':
                return {
                    maxRetries: 0,
                    baseDelay: 1000,
                    maxDelay: 30000,
                    backoffFactor: 2,
                    jitter: true,
                    retryCondition: () => false,
                    ...custom,
                };
            default:
                throw new Error(`Unknown retry scenario: ${scenario}`);
        }
    }

    private defaultRetryCondition = (error: FetchError): boolean => {
        return !error.status || (error.status >= 500 && error.status < 600);
    };

    private log(message: string, data?: unknown): void {
        if (this.debugMode) {
            console.log(`[RetryManager] ${message}`, data ?? '');
        }
    }
}
