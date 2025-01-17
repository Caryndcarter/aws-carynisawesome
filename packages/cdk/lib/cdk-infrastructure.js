import {
  CDK,
  cfnOutput,
  ConfigurationError,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
} from "@jaypie/cdk";

import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  Tags,
} from "aws-cdk-lib";
import acm from "aws-cdk-lib/aws-certificatemanager";
import cloudfront from "aws-cdk-lib/aws-cloudfront";
import origins from "aws-cdk-lib/aws-cloudfront-origins";
import {
  Effect,
  FederatedPrincipal,
  Role,
  PolicyStatement,
} from "aws-cdk-lib/aws-iam";
import route53 from "aws-cdk-lib/aws-route53";
import route53Targets from "aws-cdk-lib/aws-route53-targets";
import s3 from "aws-cdk-lib/aws-s3";

//
//
// Stack Class
//

/**
 * This stack includes a reference to the folder where the web site will be built
 *
 * Project root:
 *  cdk/
 *    lib/
 *      cdk-stack.js - this file
 *    test/
 *      cdk.test.js - unit tests
 *    bin/
 *      cdk.js - cdk entry point
 *  dist/ - web site build output (peer to CDK)
 *
 * The cdk command is initiated from the project root with a `--prefix` option:
 * `npm --prefix cdk run cdk deploy`
 *
 * CDK is running from the `cdk/` folder. Relative to that folder, the web site
 * folder is `../dist`. This will not be compatible with tests that run from
 * the project root. Tests should mock the web site folder.
 */
class CdkInfrastructureStack extends Stack {
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

    // Throw an error if CDK_ENV_WEB_HOSTED_ZONE is an invalid hostname
    if (
      process.env.CDK_ENV_WEB_HOSTED_ZONE &&
      !isValidHostname(process.env.CDK_ENV_WEB_HOSTED_ZONE)
    ) {
      throw new ConfigurationError(
        "CDK_ENV_WEB_HOSTED_ZONE is not a valid hostname",
      );
    }

    // Throw an error if CDK_ENV_WEB_SUBDOMAIN is not a valid hostname
    if (
      process.env.CDK_ENV_WEB_SUBDOMAIN &&
      !isValidSubdomain(process.env.CDK_ENV_WEB_SUBDOMAIN)
    ) {
      throw new ConfigurationError(
        "CDK_ENV_WEB_SUBDOMAIN is not a valid hostname",
      );
    }

    if (
      (process.env.CDK_ENV_WEB_HOSTED_ZONE &&
        !process.env.CDK_ENV_WEB_SUBDOMAIN) ||
      (!process.env.CDK_ENV_WEB_HOSTED_ZONE &&
        process.env.CDK_ENV_WEB_SUBDOMAIN)
    ) {
      throw new ConfigurationError(
        "CDK_ENV_WEB_HOSTED_ZONE and CDK_ENV_WEB_SUBDOMAIN must both be present or both be absent",
      );
    }

    //
    //
    // Setup
    //

    const output = {};

    // * Convert all CDK_ENV vars to local instances
    // * Do not use CDK_ENV vars past this section

    /**
     * @type {object} config
     * @property {object} build
     * @property {boolean} build.static - true if a static build with a cert and distribution
     * @property {boolean} build.ephemeral - true if an ephemeral build
     *
     * In theory these can both be true or both be false
     * In practice, one or the other will be true
     */
    const config = {
      bucket: {},
      build: {
        ephemeral:
          !process.env.CDK_ENV_WEB_HOSTED_ZONE &&
          !process.env.CDK_ENV_WEB_SUBDOMAIN,
        production: process.env.PROJECT_ENV === CDK.ENV.PRODUCTION,
        static:
          process.env.CDK_ENV_WEB_HOSTED_ZONE &&
          process.env.CDK_ENV_WEB_SUBDOMAIN,
      },
    };
    if (config.build.ephemeral) {
      Tags.of(this).add(CDK.TAG.BUILD_TYPE, CDK.BUILD.EPHEMERAL);
    }
    if (config.build.static) {
      Tags.of(this).add(CDK.TAG.BUILD_TYPE, CDK.BUILD.STATIC);
      config.host = {
        name: mergeDomain(
          process.env.CDK_ENV_WEB_SUBDOMAIN,
          process.env.CDK_ENV_WEB_HOSTED_ZONE,
        ),
        zone: process.env.CDK_ENV_WEB_HOSTED_ZONE,
      };
    }

    if (process.env.CDK_ENV_LOGGING_BUCKET_IMPORT) {
      const bucketName = Fn.importValue(
        process.env.CDK_ENV_LOGGING_BUCKET_IMPORT,
      );
      config.bucket.serverAccessLogsBucket = s3.Bucket.fromBucketName(
        this,
        "AccountServerAccessLogsBucket",
        bucketName,
      );
      if (props.stackName) {
        config.bucket.serverAccessLogsPrefix = `${props.stackName}/`;
      }
      output.ServerAccessLogsBucket =
        config.bucket.serverAccessLogsBucket.bucketName;
    }

    if (process.env.CDK_ENV_REPO) {
      config.repo = `repo:${process.env.CDK_ENV_REPO}:*`;
    }

    if (process.env.CDK_ENV_INFRASTRUCTURE_STACK_SHA) {
      Tags.of(this).add(
        CDK.TAG.STACK_SHA,
        process.env.CDK_ENV_INFRASTRUCTURE_STACK_SHA,
      );
    }

    // * Do not use CDK_ENV vars past this point

    //
    //
    // S3 bucket for web site
    //

    const destinationBucket = new s3.Bucket(this, "DestinationBucket", {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: false,
      websiteErrorDocument: "index.html",
      websiteIndexDocument: "index.html",
      // Being last, these de-structured values override the above
      ...config.bucket,
    });
    output.DestinationBucketName = destinationBucket.bucketName;
    output.DestinationBucketUrl = destinationBucket.bucketWebsiteUrl;
    Tags.of(destinationBucket).add(CDK.TAG.ROLE, CDK.ROLE.HOSTING);

    if (config.repo) {
      // Create an IAM role for GitHub Actions to assume
      const bucketDeployRole = new Role(this, "DestinationBucketDeployRole", {
        assumedBy: new FederatedPrincipal(
          Fn.importValue(CDK.IMPORT.OIDC_PROVIDER),
          {
            StringLike: {
              "token.actions.githubusercontent.com:sub": config.repo,
            },
          },
          "sts:AssumeRoleWithWebIdentity", // sts:AssumeRoleWithWebIdentity
        ),
        maxSessionDuration: Duration.hours(1),
      });
      output.DestinationBucketDeployRoleArn = bucketDeployRole.roleArn;
      Tags.of(bucketDeployRole).add(CDK.TAG.ROLE, CDK.ROLE.DEPLOY);

      // Allow the role to write to the bucket
      bucketDeployRole.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "s3:DeleteObject",
            "s3:GetObject",
            "s3:ListObjectsV2",
            "s3:PutObject",
          ],
          resources: [`${destinationBucket.bucketArn}/*`],
        }),
      );
      bucketDeployRole.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["s3:ListBucket"],
          resources: [`${destinationBucket.bucketArn}`],
        }),
      );

      // Allow the role to deploy CDK apps
      bucketDeployRole.addToPolicy(
        new PolicyStatement({
          actions: ["cloudformation:DescribeStacks"],
          effect: Effect.ALLOW,
          resources: ["*"], // TODO: restrict to this stack
        }),
      );
    }

    //
    //
    // Static Builds
    //

    let certificate;
    let distribution;

    if (config.build.static) {
      const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
        domainName: config.host.zone,
      });

      certificate = new acm.Certificate(this, "Certificate", {
        domainName: config.host.name,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
      output.CertificateArn = certificate.certificateArn;
      Tags.of(certificate).add(CDK.TAG.ROLE, CDK.ROLE.HOSTING);

      distribution = new cloudfront.Distribution(this, "Distribution", {
        defaultBehavior: {
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          origin: new origins.S3Origin(destinationBucket),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        certificate,
        domainNames: [config.host.name],
      });
      output.DistributionUrl = distribution.distributionDomainName;
      Tags.of(distribution).add(CDK.TAG.ROLE, CDK.ROLE.HOSTING);

      // If this is production, enable caching on everything but index.html
      if (config.build.production) {
        // Add behavior for all other paths
        distribution.addBehavior(
          "/*",
          new origins.S3Origin(destinationBucket),
          {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          },
        );
      }

      const record = new route53.ARecord(this, "AliasRecord", {
        recordName: config.host.name,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(distribution),
        ),
        zone: hostedZone,
      });
      output.AppStaticUrl = `https://${config.host.name}`;
      Tags.of(record).add(CDK.TAG.ROLE, CDK.ROLE.NETWORKING);
    }

    //
    //
    // Output
    //

    cfnOutput({ CfnOutput, output, stack: this });
  }
}

export { CdkInfrastructureStack };
