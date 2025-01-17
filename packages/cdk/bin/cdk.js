#!/usr/bin/env node

import { projectTagger } from "@jaypie/cdk";
import cdk from "aws-cdk-lib";
import { CdkBackendStack } from "../lib/cdk-backend.js";
import { CdkInfrastructureStack } from "../lib/cdk-infrastructure.js";

const stackName =
  process.env.CDK_ENV_STACK_NAME ||
  `cdk-${process.env.PROJECT_SPONSOR}-${process.env.PROJECT_KEY}-${process.env.PROJECT_ENV}-${process.env.PROJECT_NONCE}`;

const app = new cdk.App();

const infrastructureStack = new CdkInfrastructureStack(
  app,
  "CdkInfrastructureStack",
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    stackName: `${stackName}-infrastructure`,
  },
);
projectTagger({
  cdk,
  stack: infrastructureStack,
  stackName: `${stackName}-infrastructure`,
});

const backendStack = new CdkBackendStack(app, "CdkBackendStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  stackName: `${stackName}-backend`,
});
projectTagger({
  cdk,
  stack: backendStack,
  stackName: `${stackName}-backend`,
});
