import {
  CDK,
  cfnOutput,
  ConfigurationError,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
} from "@jaypie/cdk";

import cdk, { CfnOutput, Stack, Tags } from "aws-cdk-lib";
import apiGateway from "aws-cdk-lib/aws-apigateway";
import lambda from "aws-cdk-lib/aws-lambda";
import acm from "aws-cdk-lib/aws-certificatemanager";
import route53 from "aws-cdk-lib/aws-route53";
import route53Targets from "aws-cdk-lib/aws-route53-targets";

//
//
// Stack Class
//

class CdkBackendStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props = {}) {
    super(scope, id, props);

    //
    //
    // Validate
    //

    // Throw an error if CDK_ENV_API_HOSTED_ZONE is an invalid hostname
    if (
      process.env.CDK_ENV_API_HOSTED_ZONE &&
      !isValidHostname(process.env.CDK_ENV_API_HOSTED_ZONE)
    ) {
      throw new ConfigurationError(
        "CDK_ENV_API_HOSTED_ZONE is not a valid hostname",
      );
    }

    // Throw an error if CDK_ENV_API_SUBDOMAIN is not a valid hostname
    if (
      process.env.CDK_ENV_API_SUBDOMAIN &&
      !isValidSubdomain(process.env.CDK_ENV_API_SUBDOMAIN)
    ) {
      throw new ConfigurationError(
        "CDK_ENV_API_SUBDOMAIN is not a valid hostname",
      );
    }

    if (
      (process.env.CDK_ENV_API_HOSTED_ZONE &&
        !process.env.CDK_ENV_API_SUBDOMAIN) ||
      (!process.env.CDK_ENV_API_HOSTED_ZONE &&
        process.env.CDK_ENV_API_SUBDOMAIN)
    ) {
      throw new ConfigurationError(
        "CDK_ENV_API_HOSTED_ZONE and CDK_ENV_API_SUBDOMAIN must both be present or both be absent",
      );
    }

    //
    //
    // Setup
    //

    const output = {};

    // * Convert all CDK_ENV vars to local instances
    // * Do not use CDK_ENV vars past this section

    const config = {
      build: {
        ephemeral:
          !process.env.CDK_ENV_API_HOSTED_ZONE &&
          !process.env.CDK_ENV_API_SUBDOMAIN,
        production: process.env.PROJECT_ENV === CDK.ENV.PRODUCTION,
        static:
          process.env.CDK_ENV_API_HOSTED_ZONE &&
          process.env.CDK_ENV_API_SUBDOMAIN,
      },
      name: {
        apiGateway: `${process.env.PROJECT_ENV}-${process.env.PROJECT_KEY}-ApiGateway-${process.env.PROJECT_NONCE}`,
        certificate: `${process.env.PROJECT_ENV}-${process.env.PROJECT_KEY}-Certificate-${process.env.PROJECT_NONCE}`,
        domainName: `${process.env.PROJECT_ENV}-${process.env.PROJECT_KEY}-ApiDomainName-${process.env.PROJECT_NONCE}`,
      },
    };
    if (config.build.ephemeral) {
      Tags.of(this).add(CDK.TAG.BUILD_TYPE, CDK.BUILD.EPHEMERAL);
    }
    if (config.build.static) {
      Tags.of(this).add(CDK.TAG.BUILD_TYPE, CDK.BUILD.STATIC);
      config.host = {
        name: mergeDomain(
          process.env.CDK_ENV_API_SUBDOMAIN,
          process.env.CDK_ENV_API_HOSTED_ZONE,
        ),
        zone: process.env.CDK_ENV_API_HOSTED_ZONE,
      };
    }

    // * Do not use CDK_ENV vars past this point

    //
    //
    // Resources
    //

    // Lambda Functions

    const expressLambda = new lambda.Function(this, `FunctionExpress-`, {
      code: lambda.Code.asset("../express"),
      environment: {
        // TODO: should match APP_*, JAYPIE_* PROJECT_*, and SECRET_*
        LOG_LEVEL: process.env.LOG_LEVEL,
        MODULE_LOGGER: process.env.MODULE_LOGGER,
        MODULE_LOG_LEVEL: process.env.MODULE_LOG_LEVEL,
        MONGODB_URI: process.env.MONGODB_URI,
        PROJECT_COMMIT: process.env.PROJECT_COMMIT,
        PROJECT_ENV: process.env.PROJECT_ENV,
        PROJECT_KEY: process.env.PROJECT_KEY,
        PROJECT_SECRET: process.env.PROJECT_SECRET,
        PROJECT_SERVICE: process.env.PROJECT_SERVICE,
        PROJECT_SPONSOR: process.env.PROJECT_SPONSOR,
        SECRET_MONGODB_URI: process.env.SECRET_MONGODB_URI,
      },
      handler: "index.default",
      logRetention: CDK.LAMBDA.LOG_RETENTION,
      memorySize: CDK.LAMBDA.MEMORY_SIZE,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(CDK.DURATION.EXPRESS_API),
    });
    Tags.of(expressLambda).add(CDK.TAG.ROLE, CDK.ROLE.API);

    // Certificate

    let certificate;
    let hostedZone;

    if (config.build.static) {
      hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
        domainName: config.host.zone,
      });
      certificate = new acm.Certificate(this, "Certificate", {
        domainName: config.host.name,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
      output.CertificateArn = certificate.certificateArn;
      Tags.of(certificate).add(CDK.TAG.ROLE, CDK.ROLE.HOSTING);
    }

    // API Gateway

    const api = new apiGateway.LambdaRestApi(this, config.name.apiGateway, {
      handler: expressLambda,
    });
    Tags.of(api).add(CDK.TAG.ROLE, CDK.ROLE.API);
    output.ApiGateway = api.url;

    let domainName;
    if (config.build.static) {
      domainName = api.addDomainName(config.name.domainName, {
        domainName: config.host.name,
        certificate,
      });
      Tags.of(domainName).add(CDK.TAG.ROLE, CDK.ROLE.API);
      output.ApiDomainName = domainName.domainName;

      const record = new route53.ARecord(this, "AliasRecord", {
        recordName: config.host.name,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayDomain(domainName),
        ),
        zone: hostedZone,
      });
      Tags.of(record).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
    }

    //
    //
    // Output
    //

    cfnOutput({ CfnOutput, output, stack: this });
  }
}

export { CdkBackendStack };
