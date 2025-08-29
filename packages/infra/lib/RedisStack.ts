import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cache from "aws-cdk-lib/aws-elasticache";
import { CfnDBInstance, DatabaseInstance } from "aws-cdk-lib/aws-rds";
import { ISecurityGroup, IVpc, Peer, Port, Vpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class RedisStack extends cdk.Stack {
  cluster: cache.CfnCacheCluster;
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      db: DatabaseInstance;
      vpc: IVpc;
      securityGroup: ISecurityGroup;
    }
  ) {
    super(scope, id, props);
    // The code that defines your stack goes here
    const subnet = new cache.CfnSubnetGroup(this, "CacheSubnet", {
      description: "subnet for production redis cache",
      subnetIds: props.vpc.privateSubnets.map((s: any) => s.subnetId),
    });
    // @ts-ignore
    this.cluster = new cache.CfnCacheCluster(this, `RedisCluster`, {
      engine: "redis",
      cacheNodeType: "cache.t3.micro",
      numCacheNodes: 1,
      clusterName: "redis-sviluppo",
      vpcSecurityGroupIds: [props.securityGroup.securityGroupId],
      cacheSubnetGroupName: subnet.ref,
    });

    props.securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(6379));

    // redis.addDependsOn(props.vpc);
  }
}
