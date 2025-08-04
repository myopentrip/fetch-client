import type { RetryConfig, FetchError } from '../types';

export class RetryManager {
    private config: RetryConfig;
    private debugMode: boolean;

    constructor(config: Partial<RetryConfig> = {}, debugMode: boolean = false) {
        this.config = {
            maxRetries: config.maxRetries || 0,
            baseDelay: config.baseDelay || 1000,
            maxDelay: config.maxDelay || 30000, // 30 seconds max
            backoffFactor: config.backoffFactor || 2,
            jitter: config.jitter !== false, // Default to true
            retryCondition: config.retryCondition || this.defaultRetryCondition,
        };
        this.debugMode = debugMode;
    }

    /**
     * Update retry configuration
     */
    updateConfig(config: Partial<RetryConfig>): void {
        this.config = { ...this.config, ...config };
        if (this.debugMode) {
            this.log('Retry configuration updated', this.config);
        }
    }

    /**
     * Get current retry configuration
     */
    getConfig(): RetryConfig {
        return { ...this.config };
    }

    /**
     * Calculate delay for a specific retry attempt
     */
    calculateRetryDelay(attempt: number): number {
        let delay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt);

        if (this.config.jitter) {
            // Add ±10% jitter to prevent thundering herd
            const jitterRange = delay * 0.1;
            const jitter = (Math.random() - 0.5) * 2 * jitterRange;
            delay += jitter;
        }

        const finalDelay = Math.min(delay, this.config.maxDelay);
        if (this.debugMode) {
            this.log(`Calculated retry delay for attempt ${attempt + 1}: ${Math.round(finalDelay)}ms`);
        }

        return finalDelay;
    }

    /**
     * Check if an error should trigger a retry
     */
    shouldRetry(error: FetchError, attempt: number): boolean {
        const shouldRetry = attempt < this.config.maxRetries &&
            !!this.config.retryCondition &&
            this.config.retryCondition(error, attempt);

        if (this.debugMode) {
            this.log(`Should retry attempt ${attempt + 1}/${this.config.maxRetries + 1}: ${shouldRetry}`, {
                error: error.message,
                status: error.status
            });
        }

        return shouldRetry;
    }

    /**
     * Sleep for specified milliseconds
     */
    async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Execute a function with retry logic
     */
    async executeWithRetry<T>(
        fn: () => Promise<T>,
        context?: string
    ): Promise<T> {
        let lastError: FetchError | undefined;
        const startTime = Date.now();

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const result = await fn();

                if (attempt > 0) {
                    const totalTime = Date.now() - startTime;
                    if (this.debugMode) {
                        this.log(`${context || 'Operation'} succeeded after ${attempt} retries in ${totalTime}ms`);
                    }
                }

                return result;
            } catch (error) {
                const fetchError = error as FetchError;
                lastError = fetchError;

                const shouldRetry = this.shouldRetry(fetchError, attempt);

                if (shouldRetry) {
                    const delay = this.calculateRetryDelay(attempt);
                    if (this.debugMode) {
                        this.log(`${context || 'Operation'} failed, retrying in ${Math.round(delay)}ms`, {
                            attempt: attempt + 1,
                            error: fetchError.message
                        });
                    }
                    await this.sleep(delay);
                } else {
                    if (this.debugMode) {
                        this.log(`${context || 'Operation'} failed, no more retries`, {
                            attempt: attempt + 1,
                            finalError: fetchError.message
                        });
                    }
                    break;
                }
            }
        }

        throw lastError || new Error('Request failed with unknown error');
    }

    /**
     * Create a retry configuration for specific scenarios
     */
    static createConfig(scenario: 'aggressive' | 'conservative' | 'network-only' | 'custom', custom?: Partial<RetryConfig>): RetryConfig {
        switch (scenario) {
            case 'aggressive':
                return {
                    maxRetries: 5,
                    baseDelay: 500,
                    maxDelay: 10000,
                    backoffFactor: 1.5,
                    jitter: true,
                    retryCondition: (error: FetchError) => {
                        // Retry on network errors or 5xx/429 status codes
                        return !error.status ||
                            error.status >= 500 ||
                            error.status === 429 ||
                            error.status === 408; // Request timeout
                    }
                };

            case 'conservative':
                return {
                    maxRetries: 2,
                    baseDelay: 2000,
                    maxDelay: 30000,
                    backoffFactor: 3,
                    jitter: true,
                    retryCondition: (error: FetchError) => {
                        // Only retry on network errors or 503/504
                        return !error.status ||
                            error.status === 503 ||
                            error.status === 504;
                    }
                };

            case 'network-only':
                return {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 15000,
                    backoffFactor: 2,
                    jitter: true,
                    retryCondition: (error: FetchError) => {
                        // Only retry on network errors (no status code)
                        return !error.status;
                    }
                };

            case 'custom':
                return {
                    maxRetries: 0,
                    baseDelay: 1000,
                    maxDelay: 30000,
                    backoffFactor: 2,
                    jitter: true,
                    retryCondition: () => false,
                    ...custom
                };

            default:
                throw new Error(`Unknown retry scenario: ${scenario}`);
        }
    }

    /**
     * Default retry condition - retry on network errors or 5xx status codes
     */
    private defaultRetryCondition = (error: FetchError, attempt: number): boolean => {
        // Retry on network errors or 5xx status codes
        return !error.status || (error.status >= 500 && error.status < 600);
    };

    private log(message: string, data?: any): void {
        if (this.debugMode) {
            console.log(`[RetryManager] ${message}`, data || '');
        }
    }
}