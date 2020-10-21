"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Storage = void 0;
const fs_1 = require("fs");
class Storage {
    constructor(authDataFile = `${process.cwd()}/auth_data.json`) {
        this.authDataFile = authDataFile;
    }
    async load() {
        const contents = await fs_1.promises.readFile(this.authDataFile, "utf8");
        const authData = JSON.parse(contents);
        return authData;
    }
    async save(authData) {
        await fs_1.promises.writeFile(this.authDataFile, JSON.stringify(authData, null, 2), "utf8");
    }
}
exports.Storage = Storage;
//# sourceMappingURL=storage.js.map