import { promises as fs } from "fs";

export class Storage {
  constructor(
    private authDataFile: string = `${process.cwd()}/auth_data.json`,
  ) {}

  async load() {
    const contents = await fs.readFile(this.authDataFile, "utf8");
    const authData = JSON.parse(contents);
    return authData;
  }

  async save(authData: any) {
    await fs.writeFile(
      this.authDataFile,
      JSON.stringify(authData, null, 2),
      "utf8",
    );
  }
}
