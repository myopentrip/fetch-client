import type { FetchClientLike, FetchResponse } from '../../core/types';
import { UploadManager } from './upload-manager';
import type { FileUploadConfig, FileUploadData, MultipartFormData } from './types';

export class UploadPlugin {
    readonly name = 'upload';
    private readonly manager = new UploadManager();

    constructor(private readonly client: FetchClientLike) {}

    uploadFile<T = unknown>(
        path: string,
        fileData: FileUploadData,
        config?: FileUploadConfig
    ): Promise<FetchResponse<T>> {
        return this.manager.uploadFile(this.client, path, fileData, config);
    }

    uploadFiles<T = unknown>(
        path: string,
        files: File[],
        config?: FileUploadConfig & { fieldName?: string }
    ): Promise<FetchResponse<T>> {
        return this.manager.uploadFiles(this.client, path, files, config);
    }

    uploadFormData<T = unknown>(
        path: string,
        formData: FormData | MultipartFormData,
        config?: FileUploadConfig
    ): Promise<FetchResponse<T>> {
        return this.manager.uploadFormData(this.client, path, formData, config);
    }
}

export function createUploadPlugin(client: FetchClientLike): UploadPlugin {
    return new UploadPlugin(client);
}
