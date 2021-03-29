import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as cache from "@aws-cdk/aws-elasticache";
import { CfnDBInstance, DatabaseInstance } from "@aws-cdk/aws-rds";
import { ISecurityGroup, IVpc, Peer, Port, Vpc } from "@aws-cdk/aws-ec2";

export class RedisStack extends cdk.Stack {
  cluster: cache.CfnCacheCluster;
  constructor(
    scope: cdk.Construct,
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
      subnetIds: props.vpc.privateSubnets.map((s) => s.subnetId),
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
