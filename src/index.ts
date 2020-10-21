import path from "path";
import open from "open";
import dotenv from "dotenv";
import globby from "globby";
import inquirer from "inquirer";
import { Command } from "commander";

import { OAuth2, waitForAuthorizationCode } from "./oauth2";
import { Storage } from "./storage";

dotenv.config();

async function loadOAuth2Config() {
  const configFiles = await globby("./*.oauth2.json");
  // if multiple configs
  if (!configFiles.length) {
    throw new Error("Could not find any oauth2 config");
  }

  let configFile: string;
  if (configFiles.length > 1) {
    const answers = await inquirer.prompt([
      {
        name: "configFile",
        type: "list",
        message: "Found multiple OAuth2 config files. Which one should we use?",
        choices: configFiles.map((config: string) => {
          return {
            name: path.basename(config).split(".")[0],
            value: config,
          };
        }),
      },
    ]);

    configFile = answers.configFile;
  } else {
    configFile = configFiles[0];
  }

  let config;
  try {
    config = require(`${process.cwd()}/${configFile}`);
  } catch (error) {
    throw new Error(
      `Failed to load OAuth2 config file: ${configFile}\n\n${error.message}`,
    );
  }

  return config;
}

async function main() {
  const storage = new Storage();

  const program = new Command();
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
    const oauth = new OAuth2({
      clientId: options.clientId || process.env.CLIENT_ID || config.clientId,
      clientSecret:
        options.clientSecret ||
        process.env.CLIENT_SECRET ||
        config.clientSecret,
      redirectUri: `https://localhost:${options.port}/oauth/callback`,
      authorizationUrl: options.authorizationUrl || config.authorizationUrl,
      tokenUrl: options.tokenUrl || config.tokenUrl,
      scopes: config.scopes,
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
      const url = oauth.getauthorizationUrl();
      console.log("Opening:", url);
      open(url);
      const { code } = await waitForAuthorizationCode({
        port: options.port,
        oauth,
        key: options["key"] || path.resolve(__dirname, "../certs/server.key"),
        cert:
          options["cert"] || path.resolve(__dirname, "../certs/server.cert"),
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
      const newAuthData = await oauth.refreshAccessToken(refreshToken);
      console.log("New Auth Data: ", newAuthData);
      await storage.save(newAuthData);
    });

  program.parse(process.argv);
}

main();
