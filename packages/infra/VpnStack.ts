import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";

export class VpnStack extends cdk.Stack {
  readonly secret: secretsmanager.ISecret;

  // creating server and clients certs is best done by following the AWS page on:
  // https://docs.aws.amazon.com/de_de/vpn/latest/clientvpn-admin/authentication-authorization.html#mutual
  certArn =
    "arn:aws:acm:us-west-2:196230260133:certificate/d9e2ecee-a307-411f-bec4-a21a81aad805";
  clientArn =
    "arn:aws:acm:us-west-2:196230260133:certificate/25a5f45c-25c1-4318-a4e6-1d67702bc57a";

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & { vpc: ec2.Vpc }
  ) {
    super(scope, id, props);

    const clientCert = certificatemanager.Certificate.fromCertificateArn(
      this,
      "ClientCertificate",
      this.clientArn
    );
    const serverCert = certificatemanager.Certificate.fromCertificateArn(
      this,
      "ServerCertificate",
      this.certArn
    );

    const logGroup = new logs.LogGroup(this, "ClientVpnLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const logStream = logGroup.addStream("ClientVpnLogStream");

    const endpoint = new ec2.CfnClientVpnEndpoint(this, "ClientVpnEndpoint2", {
      description: "VPN",
      authenticationOptions: [
        {
          type: "certificate-authentication",
          mutualAuthentication: {
            clientRootCertificateChainArn: clientCert.certificateArn,
          },
        },
      ],
      tagSpecifications: [
        {
          resourceType: "client-vpn-endpoint",
          tags: [
            {
              key: "Name",
              value: "Swyp VPN CDK created",
            },
          ],
        },
      ],
      clientCidrBlock: "10.1.132.0/22",
      connectionLogOptions: {
        enabled: true,
        cloudwatchLogGroup: logGroup.logGroupName,
        cloudwatchLogStream: logStream.logStreamName,
      },
      serverCertificateArn: serverCert.certificateArn,
      // If you need to route all the traffic through the VPN (not only for the resources inside, turn this off)
      splitTunnel: false,
      dnsServers: ["8.8.8.8", "8.8.4.4"],
    });

    let i = 0;
    props?.vpc.privateSubnets.map((subnet) => {
      let networkAsc = new ec2.CfnClientVpnTargetNetworkAssociation(
        this,
        "ClientVpnNetworkAssociation-" + i,
        {
          clientVpnEndpointId: endpoint.ref,
          subnetId: subnet.subnetId,
        }
      );
      i++;
    });

    new ec2.CfnClientVpnAuthorizationRule(this, "ClientVpnAuthRule", {
      clientVpnEndpointId: endpoint.ref,
      targetNetworkCidr: "0.0.0.0/0",
      authorizeAllGroups: true,
      description: "Allow all",
    });

    // add routs for two subnets so that i can surf the internet while in VPN (useful when splitTunnel is off)
    let x = 0;
    props?.vpc.privateSubnets.map((subnet) => {
      new ec2.CfnClientVpnRoute(this, `CfnClientVpnRoute${x}`, {
        clientVpnEndpointId: endpoint.ref,
        destinationCidrBlock: "0.0.0.0/0",
        description: "Route to all",
        targetVpcSubnetId: props?.vpc.privateSubnets[x].subnetId!,
      });
      x++;
    });
  }
}
