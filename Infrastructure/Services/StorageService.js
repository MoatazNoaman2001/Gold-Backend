import path from 'path';
import fs from 'fs/promises';

export class LocalStorageService {
    async save(filePath, buffer) {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Save file
        await fs.writeFile(filePath, buffer);

        return filePath;
    }

    async get(filePath) {
        return await fs.readFile(filePath);
    }

    async delete(filePath) {
        try {
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error('Delete failed:', error);
            return false;
        }
    }

    async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
