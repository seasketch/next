import { Template } from "aws-cdk-lib/assertions";
import * as cdk from "aws-cdk-lib";
import * as Infra from "../lib/ClientStack";

test("Empty Stack", () => {
  const app = new cdk.App();
  // WHEN
  const stack = new Infra.ClientStack(app, "MyTestStack");
  // THEN
  const template = Template.fromStack(stack);
  template.templateMatches({});
});
