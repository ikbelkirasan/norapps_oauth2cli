"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const open_1 = __importDefault(require("open"));
const dotenv_1 = __importDefault(require("dotenv"));
const globby_1 = __importDefault(require("globby"));
const inquirer_1 = __importDefault(require("inquirer"));
const lodash_1 = __importDefault(require("lodash"));
const commander_1 = require("commander");
const oauth2_1 = require("./oauth2");
const storage_1 = require("./storage");
dotenv_1.default.config();
async function loadOAuth2Config() {
    const configFiles = await globby_1.default("./*.oauth2.json");
    // if multiple configs
    if (!configFiles.length) {
        throw new Error("Could not find any oauth2 config");
    }
    let configFile;
    if (configFiles.length > 1) {
        const answers = await inquirer_1.default.prompt([
            {
                name: "configFile",
                type: "list",
                message: "Found multiple OAuth2 config files. Which one should we use?",
                choices: configFiles.map((config) => {
                    return {
                        name: path_1.default.basename(config).split(".")[0],
                        value: config,
                    };
                }),
            },
        ]);
        configFile = answers.configFile;
    }
    else {
        configFile = configFiles[0];
    }
    let config;
    try {
        config = require(`${process.cwd()}/${configFile}`);
    }
    catch (error) {
        throw new Error(`Failed to load OAuth2 config file: ${configFile}\n\n${error.message}`);
    }
    return config;
}
async function main() {
    const storage = new storage_1.Storage();
    const program = new commander_1.Command();
    program.option("-p --port <number>", "Open server on this port", "3000");
    program.option("--clientId <string>", "Client ID");
    program.option("--clientSecret <string>", "Client Secret");
    program.option("--authorizeUrl <string>", "Authorization URL");
    program.option("--tokenUrl <string>", "Token URL");
    program.option("--key <file>", "Private keys in PEM format");
    program.option("--cert <file>", "Cert chains in PEM format");
    async function getContext() {
        const config = await loadOAuth2Config();
        const options = program.opts();
        const oauth = new oauth2_1.OAuth2({
            clientId: options.clientId || process.env.CLIENT_ID || config.clientId,
            clientSecret: options.clientSecret ||
                process.env.CLIENT_SECRET ||
                config.clientSecret,
            redirectUri: `https://localhost:${options.port}/oauth/callback`,
            authorizationUrl: options.authorizationUrl || config.authorizationUrl,
            tokenUrl: options.tokenUrl || config.tokenUrl,
            scopes: config.scopes,
            additionalParams: config.additionalParams,
        });
        return {
            options,
            oauth,
            config,
        };
    }
    program
        .command("start")
        .description("Get Access Token")
        .action(async () => {
        const { oauth, options } = await getContext();
        const url = oauth.getAuthorizationUrl();
        console.log("Opening:", url);
        open_1.default(url);
        const { code } = await oauth2_1.waitForAuthorizationCode({
            port: options.port,
            oauth,
            key: options["key"] || path_1.default.resolve(__dirname, "../certs/server.key"),
            cert: options["cert"] || path_1.default.resolve(__dirname, "../certs/server.cert"),
        });
        const authData = await oauth.getAccessToken(code);
        console.log("Auth Data:", authData);
        await storage.save(authData);
    });
    program
        .command("refresh")
        .description("Refresh the access token")
        .action(async () => {
        const { oauth } = await getContext();
        const authData = await storage.load();
        const refreshToken = authData["refresh_token"];
        const newAuthData = await oauth.refreshAccessToken(refreshToken, {
            includeRedirectUri: false,
        });
        console.log("New Auth Data: ", newAuthData);
        const data = lodash_1.default.merge({}, authData, newAuthData);
        await storage.save(data);
    });
    program.parse(process.argv);
}
main();
//# sourceMappingURL=index.js.map