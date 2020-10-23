"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForAuthorizationCode = exports.OAuth2 = void 0;
const fs_1 = __importDefault(require("fs"));
const querystring_1 = __importDefault(require("querystring"));
const https_1 = __importDefault(require("https"));
const axios_1 = __importDefault(require("axios"));
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const http_shutdown_1 = __importDefault(require("http-shutdown"));
class OAuth2 {
    constructor(options) {
        this.scopes = [];
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.redirectUri = options.redirectUri;
        this.authorizationUrl = options.authorizationUrl;
        this.tokenUrl = options.tokenUrl;
        this.scopes = options.scopes;
        this.additionalParams = options.additionalParams;
        this.client = axios_1.default.create();
        this.client.interceptors.response.use(undefined, (error) => {
            const data = JSON.stringify(error.response.data, null, 2);
            const message = [error.message, data].join("\n");
            throw new Error(message + "\n\n");
        });
    }
    getAuthorizationUrl() {
        const url = new URL(this.authorizationUrl);
        url.searchParams.set("client_id", this.clientId);
        url.searchParams.set("redirect_uri", this.redirectUri);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", this.scopes.join(" "));
        for (const param in this.additionalParams) {
            url.searchParams.set(param, this.additionalParams[param]);
        }
        return url.toString();
    }
    async getAccessToken(code) {
        return this.tokenRequest({
            grant_type: "authorization_code",
            redirect_uri: this.redirectUri,
            code,
        });
    }
    async refreshAccessToken(refreshToken, options = {}) {
        const payload = {
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        };
        if (options.includeRedirectUri) {
            payload["redirect_uri"] = this.redirectUri;
        }
        return this.tokenRequest(payload);
    }
    async tokenRequest(options) {
        const payload = {
            ...options,
        };
        const response = await this.client({
            method: "POST",
            url: this.tokenUrl,
            auth: {
                username: this.clientId,
                password: this.clientSecret,
            },
            data: querystring_1.default.stringify(payload),
        });
        return response.data;
    }
}
exports.OAuth2 = OAuth2;
async function waitForAuthorizationCode(options) {
    return new Promise((resolve, reject) => {
        let server;
        const app = express_1.default();
        app.use(body_parser_1.default.json());
        app.use(body_parser_1.default.urlencoded({ extended: true }));
        app.get("/oauth/callback", (req, res) => {
            try {
                const code = req.query.code;
                if (!code) {
                    reject(`Did not receive an authorization code: ${code}`);
                }
                res.send({ status: "ok" });
                resolve({ code });
            }
            catch (error) {
                reject(error);
            }
            finally {
                server.shutdown();
            }
        });
        server = http_shutdown_1.default(https_1.default
            .createServer({
            key: fs_1.default.readFileSync(options.key),
            cert: fs_1.default.readFileSync(options.cert),
        }, app)
            .listen(options.port, () => {
            console.log("Server is listening on port", options.port);
        }));
    });
}
exports.waitForAuthorizationCode = waitForAuthorizationCode;
//# sourceMappingURL=oauth2.js.map