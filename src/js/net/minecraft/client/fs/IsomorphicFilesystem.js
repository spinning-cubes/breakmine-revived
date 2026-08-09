import BrowserFS from './Filesystem.js';

const isNode = typeof window === 'undefined' && typeof process !== 'undefined';

let nodeFs = null;
let nodeFsSync = null;
let nodePath = null;
if (isNode) {
    try {
        if (typeof process.getBuiltinModule === 'function') {
            nodeFs = process.getBuiltinModule('node:fs/promises');
            nodeFsSync = process.getBuiltinModule('node:fs');
            nodePath = process.getBuiltinModule('node:path');
        }
    } catch {
        nodeFs = null;
        nodeFsSync = null;
        nodePath = null;
    }
}

function nodeFsUnavailable(methodName) {
    return new Error(`IsomorphicFilesystem.${methodName} is only supported in Node.js mode`);
}

export class IsomorphicFilesystem {
    #browserFS = null;

    constructor(dbName = 'BrowserFileStoreDB', storeName = 'text_files') {
        if (!isNode) {
            this.#browserFS = new BrowserFS(dbName, storeName);
        }
    }

    // In Node.js mode every relative path is resolved against the project root
    // ('.'), matching how the in-browser virtual filesystem treats its keys.
    // Absolute paths are passed through unchanged.
    #resolvePath(filePath) {
        if (isNode && nodePath) {
            const p = filePath == null || filePath === '' ? '.' : String(filePath);
            return nodePath.isAbsolute(p) ? p : nodePath.join('.', p);
        }
        return filePath;
    }

    async #getNodeFs() {
        if (isNode && !nodeFs) {
            try {
                nodeFs = await import('node:fs/promises');
            } catch {
                nodeFs = null;
            }
        }
        return nodeFs;
    }

    async readFile(filePath, encoding = 'utf-8') {
        const nfs = await this.#getNodeFs();
        if (nfs) {
            return await nfs.readFile(this.#resolvePath(filePath), encoding);
        }
        if (encoding === 'binary' || encoding === null) {
            return await this.#browserFS.loadBinaryFile(filePath);
        }
        return await this.#browserFS.loadFile(filePath);
    }

    async writeFile(filePath, data) {
        const nfs = await this.#getNodeFs();
        if (nfs) {
            return await nfs.writeFile(this.#resolvePath(filePath), data);
        }
        if (typeof data === 'string') {
            return await this.#browserFS.saveFile(data, filePath);
        }
        return await this.#browserFS.saveBinaryFile(data, filePath);
    }

    async unlink(filePath) {
        const nfs = await this.#getNodeFs();
        if (nfs) {
            return await nfs.unlink(this.#resolvePath(filePath));
        }
        return await this.#browserFS.deleteFile(filePath);
    }

    async exists(filePath) {
        const nfs = await this.#getNodeFs();
        if (nfs) {
            try {
                await nfs.access(this.#resolvePath(filePath));
                return true;
            } catch {
                return false;
            }
        }
        return await this.#browserFS.fileExists(filePath);
    }

    async stat(filePath) {
        const nfs = await this.#getNodeFs();
        if (nfs) {
            const stats = await nfs.stat(this.#resolvePath(filePath));
            return {
                size: stats.size,
                isFile: () => stats.isFile(),
                isDirectory: () => stats.isDirectory()
            };
        }
        const size = await this.#browserFS.getFileSize(filePath);
        if (size === null) {
            throw new Error(`ENOENT: no such file or directory, stat '${filePath}'`);
        }
        return {
            size,
            isFile: () => true,
            isDirectory: () => false
        };
    }

    async readdir(dirPath = '') {
        const nfs = await this.#getNodeFs();
        if (nfs) {
            return await nfs.readdir(this.#resolvePath(dirPath));
        }
        return await this.#browserFS.listDir(dirPath);
    }

    existsSync(filePath) {
        if (isNode && nodeFsSync) {
            return nodeFsSync.existsSync(this.#resolvePath(filePath));
        }
        throw nodeFsUnavailable('existsSync');
    }

    readFileSync(filePath, encoding) {
        if (isNode && nodeFsSync) {
            return nodeFsSync.readFileSync(this.#resolvePath(filePath), encoding);
        }
        throw nodeFsUnavailable('readFileSync');
    }

    writeFileSync(filePath, data, options) {
        if (isNode && nodeFsSync) {
            return nodeFsSync.writeFileSync(this.#resolvePath(filePath), data, options);
        }
        throw nodeFsUnavailable('writeFileSync');
    }

    mkdirSync(dirPath, options) {
        if (isNode && nodeFsSync) {
            return nodeFsSync.mkdirSync(this.#resolvePath(dirPath), options);
        }
        throw nodeFsUnavailable('mkdirSync');
    }

    readdirSync(dirPath = '', options) {
        if (isNode && nodeFsSync) {
            return nodeFsSync.readdirSync(this.#resolvePath(dirPath), options);
        }
        throw nodeFsUnavailable('readdirSync');
    }

    unlinkSync(filePath) {
        if (isNode && nodeFsSync) {
            return nodeFsSync.unlinkSync(this.#resolvePath(filePath));
        }
        throw nodeFsUnavailable('unlinkSync');
    }

    renameSync(oldPath, newPath) {
        if (isNode && nodeFsSync) {
            return nodeFsSync.renameSync(this.#resolvePath(oldPath), this.#resolvePath(newPath));
        }
        throw nodeFsUnavailable('renameSync');
    }
}

export default IsomorphicFilesystem;
