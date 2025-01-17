// Framework
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AWS CDK
import cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import lambda from "aws-cdk-lib/aws-lambda";

// Subject
import { CdkBackendStack } from "../lib/cdk-backend.js";
import { CdkInfrastructureStack } from "../lib/cdk-infrastructure.js";

//
//
// Mock modules
//

vi.mock("aws-cdk-lib/aws-route53");

vi.spyOn(lambda.Code, "asset").mockReturnValue(
  lambda.Code.fromInline("MOCK_CODE"),
);

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  process.env.CDK_ENV_API_SUBDOMAIN = "mock-api-subdomain";
  process.env.CDK_ENV_API_HOSTED_ZONE = "mock.hosted.zone";
  process.env.PROJECT_ENV = "MOCK_PROJECT_ENV";
  process.env.PROJECT_KEY = "MOCK_PROJECT_KEY";
  process.env.PROJECT_NONCE = "MOCK_PROJECT_NONCE";
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("CDK Stack", () => {
  describe("Baselines", () => {
    it("CdkBackendStack Loads", () => {
      const app = new cdk.App();
      const stack = new CdkBackendStack(app, "MyTestStack");
      const template = Template.fromStack(stack);
      expect(template).not.toBe(undefined);
    });
    it("CdkInfrastructureStack Loads", () => {
      const app = new cdk.App();
      const stack = new CdkInfrastructureStack(app, "MyTestStack");
      const template = Template.fromStack(stack);
      expect(template).not.toBe(undefined);
    });
  });
});
