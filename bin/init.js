#!/usr/bin/env node
/* eslint-disable no-console */

import { execSync } from "child_process";
import { basename, join, dirname } from "path";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { fileURLToPath } from "url";
// eslint-disable-next-line import-x/no-unresolved
import enquirer from "enquirer";

const { prompt } = enquirer;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Generate random alphanumeric string
function generateNonce(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

async function init() {
  try {
    const defaultName = basename(process.cwd());

    // First get the project name
    const { projectName } = await prompt({
      type: "input",
      name: "projectName",
      message: "Project name?",
      initial: defaultName,
    });

    // Then use it for the remaining prompts
    const responses = await prompt([
      {
        type: "input",
        name: "projectKey",
        message: "Project key?",
        initial: projectName,
      },
      {
        type: "input",
        name: "hostedZone",
        message: "Hosted zone?",
        initial: "initzero.xyz",
      },
      {
        type: "input",
        name: "webSubdomain",
        message: "Web subdomain?",
        initial: "@",
      },
      {
        type: "input",
        name: "apiSubdomain",
        message: "API subdomain?",
        initial: "api",
      },
      {
        type: "select",
        name: "accountType",
        message: "AWS account type?",
        choices: [
          { name: "single", message: "Single Account" },
          { name: "multi", message: "Multi Account" },
        ],
        initial: 0,
      },
      {
        type: "confirm",
        name: "useNuxtUiPro",
        message: "Use Nuxt UI Pro?",
        initial: false,
      },
      {
        type: "input",
        name: "deployMainSubdomain",
        message: "Development build subdomain?",
        initial: "dev",
      },
      {
        type: "input",
        name: "deploySandboxSubdomain",
        message: "Sandbox build subdomain?",
        initial: "sandbox",
      },
      {
        type: "input",
        name: "developmentBuildBranch",
        message: "Development build branch?",
        initial: "main",
      },
      {
        type: "input",
        name: "productionBuildTag",
        message: "Production build tag?",
        initial: "v1.**",
      },
      {
        type: "input",
        name: "sandboxBuildBranch",
        message: "Sandbox build branch?",
        initial: "feat/*",
      },
      {
        type: "confirm",
        name: "sandboxFollowsDevelopment",
        message: "Build sandbox with development?",
        initial: true,
      },
      {
        type: "input",
        name: "projectSponsor",
        message: "Project sponsor?",
        initial: "none",
      },
      {
        type: "input",
        name: "projectService",
        message: "Project service?",
        initial: "none",
      },
      {
        type: "input",
        name: "serviceTeam",
        message: "Service team?",
        initial: "development",
      },
      {
        type: "input",
        name: "serviceEmail",
        message: "Service email?",
        initial: "none",
      },
    ]);

    // Combine the responses
    const allResponses = { projectName, ...responses };

    const projectPath = join(dirname(__dirname));
    console.log(
      `Running one-time init for ${allResponses.projectName} in ${projectPath}`,
    );

    // Replace project name in package.json files
    const updatePackageJson = (filePath) => {
      try {
        const content = readFileSync(filePath, "utf8");
        const updated = content.replace(
          /initzero-project/g,
          allResponses.projectName,
        );
        writeFileSync(filePath, updated);
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.warn(`Warning: Could not update ${filePath}`);
      }
    };

    // Update root package.json
    updatePackageJson(join(projectPath, "package.json"));

    // Update workspace package.json files
    ["cdk", "express", "lambda", "nuxt"].forEach((pkg) => {
      updatePackageJson(join(projectPath, "packages", pkg, "package.json"));
    });

    // Update workflow files
    const updateWorkflowFile = (filePath, env) => {
      let content = readFileSync(filePath, "utf8");
      const nonce = generateNonce();

      // Replace AWS role ARN based on account mode
      if (allResponses.accountType === "single") {
        content = content.replace(
          /AWS_ROLE_ARN: \${{ vars\.ACCOUNT_.*?_AWS_ROLE_ARN }}/,
          "AWS_ROLE_ARN: ${{ vars.ACCOUNT_AWS_ROLE_ARN }}",
        );
      }

      // Define subdomain values based on environment and account type
      let apiSubdomainValue, webSubdomainValue, apiHostedZone, webHostedZone;

      if (allResponses.accountType === "single") {
        // Single account mode - original structure
        apiSubdomainValue =
          env === "production"
            ? allResponses.apiSubdomain
            : env === "development"
              ? `${allResponses.apiSubdomain}.${allResponses.deployMainSubdomain}`
              : `${allResponses.apiSubdomain}.${allResponses.deploySandboxSubdomain}`;

        webSubdomainValue =
          env === "production"
            ? allResponses.webSubdomain === "@"
              ? '"@"'
              : allResponses.webSubdomain
            : env === "development"
              ? allResponses.deployMainSubdomain
              : allResponses.deploySandboxSubdomain;

        apiHostedZone = allResponses.hostedZone;
        webHostedZone = allResponses.hostedZone;
      } else {
        // Multi account mode - new structure
        // Set hosted zones based on environment
        apiHostedZone = webHostedZone =
          env === "production"
            ? allResponses.hostedZone
            : env === "development"
              ? `${allResponses.deployMainSubdomain}.${allResponses.hostedZone}`
              : `${allResponses.deploySandboxSubdomain}.${allResponses.hostedZone}`;

        // Set subdomains
        apiSubdomainValue = `${allResponses.apiSubdomain}.${allResponses.webSubdomain === "@" ? "" : allResponses.webSubdomain
          }`.replace(/\.$/, ""); // Remove trailing dot if webSubdomain was "@"

        webSubdomainValue =
          allResponses.webSubdomain === "@" ? '"@"' : allResponses.webSubdomain;
      }

      // Update branch/tag triggers based on environment
      if (env === "production") {
        content = content.replace(
          /tags:\n\s*- v1\.\*\*/,
          `tags:\n      - ${allResponses.productionBuildTag}`,
        );
      } else if (env === "development") {
        content = content.replace(
          /branches:\n\s*- develop/,
          `branches:\n      - ${allResponses.developmentBuildBranch}`,
        );
      } else if (env === "sandbox") {
        const branchConfig = allResponses.sandboxFollowsDevelopment
          ? `branches:\n      - ${allResponses.sandboxBuildBranch}\n      - ${allResponses.developmentBuildBranch}`
          : `branches:\n      - ${allResponses.sandboxBuildBranch}`;
        content = content.replace(/branches:\n\s*- feat\/\*/, branchConfig);
      }

      // Also update the name if it's the development workflow
      if (env === "development") {
        content = content.replace(
          /PROJECT_ENV: main/,
          "PROJECT_ENV: development",
        );
      }

      const replacements = {
        "PROJECT_KEY: .*?(?=\\n)": `PROJECT_KEY: ${allResponses.projectKey}`,
        "PROJECT_NONCE: .*?(?=\\n)": `PROJECT_NONCE: ${nonce}`,
        "CDK_ENV_API_HOSTED_ZONE: .*?(?=\\n)": `CDK_ENV_API_HOSTED_ZONE: ${apiHostedZone}`,
        "CDK_ENV_WEB_HOSTED_ZONE: .*?(?=\\n)": `CDK_ENV_WEB_HOSTED_ZONE: ${webHostedZone}`,
        "CDK_ENV_API_SUBDOMAIN: .*?(?=\\n)": `CDK_ENV_API_SUBDOMAIN: ${apiSubdomainValue}`,
        "CDK_ENV_WEB_SUBDOMAIN: .*?(?=\\n)": `CDK_ENV_WEB_SUBDOMAIN: ${webSubdomainValue}`,
        "PROJECT_SPONSOR: .*?(?=\\n)": `PROJECT_SPONSOR: ${allResponses.projectSponsor}`,
        "PROJECT_SERVICE: .*?(?=\\n)": `PROJECT_SERVICE: ${allResponses.projectService}`,
        "SERVICE_TEAM: .*?(?=\\n)": `SERVICE_TEAM: ${allResponses.serviceTeam}`,
        "SERVICE_EMAIL: .*?(?=\\n)": `SERVICE_EMAIL: ${allResponses.serviceEmail}`,
      };

      Object.entries(replacements).forEach(([pattern, replacement]) => {
        content = content.replace(new RegExp(pattern, "g"), replacement);
      });

      writeFileSync(filePath, content);
    };

    // Update each workflow file
    console.log("\nUpdating workflow files...");
    const workflowsDir = join(projectPath, ".github", "workflows");
    updateWorkflowFile(
      join(workflowsDir, "deploy-production.yml"),
      "production",
    );
    updateWorkflowFile(
      join(workflowsDir, "deploy-development.yml"),
      "development",
    );
    updateWorkflowFile(join(workflowsDir, "deploy-sandbox.yml"), "sandbox");

    // Install root project dependencies
    console.log("\nInstalling root project dependencies...");
    execSync(
      "npm install --save-dev @jaypie/eslint @jaypie/testkit @vitejs/plugin-vue eslint eslint-plugin-prettier jest-extended lerna rimraf sort-package-json supertest vitest",
      { stdio: "inherit", cwd: projectPath },
    );

    // Install workspace dependencies
    const workspaces = {
      cdk: {
        deps: ["@jaypie/cdk", "aws-cdk-lib", "constructs"],
        devDeps: ["aws-cdk"],
      },
      express: {
        deps: [
          "@knowtrace/express",
          "jaypie",
          "body-parser",
          "express",
          "source-map-support",
        ],
      },
      lambda: {
        deps: ["jaypie"],
      },
      nuxt: {
        devDeps: [
          "@nuxt/devtools",
          "@nuxt/eslint",
          "@nuxt/test-utils",
          "@vue/test-utils",
          "happy-dom",
          "nuxt",
          "vue",
        ],
      },
    };

    if (allResponses.useNuxtUiPro) {
      workspaces.nuxt.devDeps.push("@nuxt/ui-pro");
    } else {
      workspaces.nuxt.devDeps.push("@nuxt/ui");
    }

    for (const [workspace, { deps = [], devDeps = [] }] of Object.entries(
      workspaces,
    )) {
      const workspacePath = join(projectPath, "packages", workspace);
      console.log(`\nInstalling ${workspace} dependencies...`);

      if (deps.length) {
        execSync(`npm install ${deps.join(" ")}`, {
          stdio: "inherit",
          cwd: workspacePath,
        });
      }

      if (devDeps.length) {
        execSync(`npm install --save-dev ${devDeps.join(" ")}`, {
          stdio: "inherit",
          cwd: workspacePath,
        });
      }

      // Special handling for Nuxt
      if (workspace === "nuxt") {
        console.log("Preparing Nuxt...");
        execSync("npm run nuxt:prepare", {
          stdio: "inherit",
          cwd: workspacePath,
        });
      }
    }

    // Remove init script from package.json
    console.log("\nCleaning up initialization script...");
    const packageJsonPath = join(projectPath, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    delete packageJson.scripts.init;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

    // Remove this script
    unlinkSync(__filename);

    // Uninstall enquirer
    console.log("\nRemoving enquirer package...");
    execSync("npm uninstall enquirer", { stdio: "inherit", cwd: projectPath });

    // Format package.json files
    console.log("\nFormatting package.json files...");
    execSync("npm run format:package", { stdio: "inherit", cwd: projectPath });

    console.log("\nInitialization complete!");
  } catch (error) {
    console.error("Error during initialization:", error);
    process.exit(1);
  }
}

init();
