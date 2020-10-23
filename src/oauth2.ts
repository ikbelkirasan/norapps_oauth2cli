import fs from "fs";
import qs from "querystring";
import https from "https";
import axios, { AxiosInstance } from "axios";
import express from "express";
import bodyParser from "body-parser";
import shutdown from "http-shutdown";

export class OAuth2 {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  public authorizationUrl: string;
  public tokenUrl: string;
  public scopes: string[] = [];
  public additionalParams: {
    [key: string]: string;
  };

  private client: AxiosInstance;

  constructor(options: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
    authorizationUrl: string;
    tokenUrl: string;
    additionalParams: { [key: string]: string };
  }) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    this.authorizationUrl = options.authorizationUrl;
    this.tokenUrl = options.tokenUrl;
    this.scopes = options.scopes;
    this.additionalParams = options.additionalParams;

    this.client = axios.create();
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

  async getAccessToken(code: string) {
    return this.tokenRequest({
      grant_type: "authorization_code",
      redirect_uri: this.redirectUri,
      code,
    });
  }

  async refreshAccessToken(
    refreshToken: string,
    options: { includeRedirectUri?: boolean } = {},
  ) {
    const payload: any = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };
    if (options.includeRedirectUri) {
      payload["redirect_uri"] = this.redirectUri;
    }

    return this.tokenRequest(payload);
  }

  private async tokenRequest(options: {
    grant_type: "authorization_code" | "refresh_token";
    code?: string;
    refresh_token?: string;
    redirect_uri?: string;
  }) {
    const payload: any = {
      ...options,
    };

    const response = await this.client({
      method: "POST",
      url: this.tokenUrl,
      auth: {
        username: this.clientId,
        password: this.clientSecret,
      },
      data: qs.stringify(payload),
    });
    return response.data;
  }
}

export async function waitForAuthorizationCode(options: {
  port: number;
  oauth: OAuth2;
  key: string;
  cert: string;
}): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    let server: any;

    const app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.get("/oauth/callback", (req, res) => {
      try {
        const code = req.query.code as string;
        if (!code) {
          reject(`Did not receive an authorization code: ${code}`);
        }
        res.send({ status: "ok" });
        resolve({ code });
      } catch (error) {
        reject(error);
      } finally {
        server.shutdown();
      }
    });

    server = shutdown(
      https
        .createServer(
          {
            key: fs.readFileSync(options.key),
            cert: fs.readFileSync(options.cert),
          },
          app,
        )
        .listen(options.port, () => {
          console.log("Server is listening on port", options.port);
        }),
    );
  });
}
