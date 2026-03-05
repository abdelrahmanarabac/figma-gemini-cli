import { mkdir, readFile, writeFile, copyFile, rename, rm, stat } from 'fs/promises';
import { dirname, join, relative, resolve } from 'path';
import { existsSync } from 'fs';

export class SafeFileWriter {
    /**
     * @param {string} rootDir - Base directory for all file operations
     */
    constructor(rootDir) {
        this.rootDir = resolve(rootDir);
        this.tmpDir = join(this.rootDir, '.tmp');
        this.backupDir = join(this.rootDir, '.backup');
        this.staged = new Map(); // filePath → content
        this.backedUp = [];      // files that were backed up
    }

    /**
     * Stage a file for writing. Nothing written to disk yet.
     * @param {string} filePath - Relative or absolute path (resolved against rootDir)
     * @param {string|Buffer} content
     */
    add(filePath, content) {
        const resolved = resolve(this.rootDir, filePath);
        this.staged.set(resolved, content);
    }

    /**
     * Write all staged files atomically.
     * temp → validate → move to final. Rollback on any error.
     */
    async commit() {
        if (this.staged.size === 0) return;

        try {
            await mkdir(this.tmpDir, { recursive: true });
            await mkdir(this.backupDir, { recursive: true });

            // Phase 1: Backup existing files
            for (const filePath of this.staged.keys()) {
                if (existsSync(filePath)) {
                    const rel = relative(this.rootDir, filePath);
                    const backupPath = join(this.backupDir, rel);
                    await mkdir(dirname(backupPath), { recursive: true });
                    await copyFile(filePath, backupPath);
                    this.backedUp.push({ original: filePath, backup: backupPath });
                }
            }

            // Phase 2: Write to temp
            const tmpFiles = [];
            for (const [filePath, content] of this.staged) {
                const rel = relative(this.rootDir, filePath);
                const tmpPath = join(this.tmpDir, rel);
                await mkdir(dirname(tmpPath), { recursive: true });
                await writeFile(tmpPath, content, typeof content === 'string' ? 'utf8' : undefined);
                tmpFiles.push({ tmpPath, finalPath: filePath });
            }

            // Phase 3: Validate temp files
            for (const { tmpPath } of tmpFiles) {
                const s = await stat(tmpPath);
                if (s.size === 0) {
                    throw new Error(`Validation failed: ${tmpPath} is empty`);
                }
            }

            // Phase 4: Move temp → final
            for (const { tmpPath, finalPath } of tmpFiles) {
                await mkdir(dirname(finalPath), { recursive: true });
                // rename can fail across drives on Windows, fall back to copy+delete
                try {
                    await rename(tmpPath, finalPath);
                } catch {
                    await copyFile(tmpPath, finalPath);
                    await rm(tmpPath);
                }
            }

            // Phase 5: Cleanup
            await rm(this.tmpDir, { recursive: true, force: true });

            this.staged.clear();
        } catch (err) {
            await this.rollback();
            throw err;
        }
    }

    /**
     * Restore all backed-up files and clean temp directory.
     */
    async rollback() {
        // Restore backups
        for (const { original, backup } of this.backedUp) {
            try {
                await mkdir(dirname(original), { recursive: true });
                await copyFile(backup, original);
            } catch { /* best effort */ }
        }

        // Cleanup temp and backup dirs
        await rm(this.tmpDir, { recursive: true, force: true }).catch(() => { });
        await rm(this.backupDir, { recursive: true, force: true }).catch(() => { });

        this.backedUp = [];
        this.staged.clear();
    }
}
