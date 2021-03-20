"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeUsers = exports.handler = void 0;
/**
 * initDbUsers handles events from a CloudFormation Custom Resource in order
 * to run after the initial creation of the SeaSketch Database.
 * It does two things:
 *   * Creates a new 'graphile' user for use by postgraphile
 *   * Grants 'rds_iam' permission to both postgres & graphile users
 *     to enable iam authentication
 */
const AWS = require("aws-sdk");
const node_postgres_1 = require("node-postgres");
async function handler(event) {
    switch (event.RequestType) {
        case "Create":
            console.log("initializing users...", event.ResourceProperties);
            return initializeUsers(event);
        case "Update":
            console.log("update: noop");
            return { PhysicalResourceId: event.PhysicalResourceId };
        case "Delete":
            console.log("delete: noop");
            return {};
    }
}
exports.handler = handler;
async function initializeUsers(event) {
    const region = event.ResourceProperties["region"];
    if (!region) {
        throw new Error("'region' not defined in ResourceProperties");
    }
    const client = new AWS.SecretsManager({
        region,
    });
    const secretName = event.ResourceProperties["secret"];
    if (!secretName) {
        throw new Error("'secret' not defined in ResourceProperties");
    }
    const secretValue = await client
        .getSecretValue({ SecretId: secretName })
        .promise();
    // Decrypts secret using the associated KMS CMK.
    // Depending on whether the secret is a string or binary, one of these fields will be populated.
    let secret;
    if (secretValue.SecretString) {
        secret = JSON.parse(secretValue.SecretString);
    }
    else {
        // @ts-ignore
        let buff = new Buffer(secretValue.SecretBinary, "base64");
        secret = JSON.parse(buff.toString("ascii"));
    }
    const dbClient = new node_postgres_1.Client({
        database: secret.dbname,
        host: secret.host,
        port: secret.port,
        password: secret.password,
        user: secret.username,
    });
    await dbClient.connect();
    console.log("creating user...");
    await dbClient.query("CREATE USER graphile WITH LOGIN");
    console.log("granting rds_iam...");
    await dbClient.query("GRANT rds_iam TO postgres");
    const res = await dbClient.query("GRANT rds_iam TO graphile");
    console.log("done", res);
    return {
        PhysicalResourceId: `${secret.dbInstanceIdentifier}/dbUsers`,
        Data: {
            username: "graphile",
        },
    };
}
exports.initializeUsers = initializeUsers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQTs7Ozs7OztHQU9HO0FBQ0gsK0JBQStCO0FBQy9CLGlEQUF1QztBQUVoQyxLQUFLLFVBQVUsT0FBTyxDQUFDLEtBQStDO0lBQzNFLFFBQVEsS0FBSyxDQUFDLFdBQVcsRUFBRTtRQUN6QixLQUFLLFFBQVE7WUFDWCxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixFQUFFLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQy9ELE9BQU8sZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hDLEtBQUssUUFBUTtZQUNYLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDNUIsT0FBTyxFQUFFLGtCQUFrQixFQUFFLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQzFELEtBQUssUUFBUTtZQUNYLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDNUIsT0FBTyxFQUFFLENBQUM7S0FDYjtBQUNILENBQUM7QUFaRCwwQkFZQztBQVlNLEtBQUssVUFBVSxlQUFlLENBQ25DLEtBQStDO0lBRS9DLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNsRCxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQ1gsTUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO0tBQy9EO0lBQ0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDO1FBQ3BDLE1BQU07S0FDUCxDQUFDLENBQUM7SUFDSCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdEQsSUFBSSxDQUFDLFVBQVUsRUFBRTtRQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTRDLENBQUMsQ0FBQztLQUMvRDtJQUNELE1BQU0sV0FBVyxHQUFHLE1BQU0sTUFBTTtTQUM3QixjQUFjLENBQUMsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLENBQUM7U0FDeEMsT0FBTyxFQUFFLENBQUM7SUFDYixnREFBZ0Q7SUFDaEQsZ0dBQWdHO0lBQ2hHLElBQUksTUFBZ0IsQ0FBQztJQUNyQixJQUFJLFdBQVcsQ0FBQyxZQUFZLEVBQUU7UUFDNUIsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO0tBQy9DO1NBQU07UUFDTCxhQUFhO1FBQ2IsSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsV0FBVyxDQUFDLFlBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMzRCxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7S0FDN0M7SUFDRCxNQUFNLFFBQVEsR0FBRyxJQUFJLHNCQUFNLENBQUM7UUFDMUIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3ZCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtRQUNqQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7UUFDakIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1FBQ3pCLElBQUksRUFBRSxNQUFNLENBQUMsUUFBUTtLQUN0QixDQUFDLENBQUM7SUFDSCxNQUFNLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDaEMsTUFBTSxRQUFRLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7SUFDeEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQ25DLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBQ2xELE1BQU0sR0FBRyxHQUFHLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBQzlELE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3pCLE9BQU87UUFDTCxrQkFBa0IsRUFBRSxHQUFHLE1BQU0sQ0FBQyxvQkFBb0IsVUFBVTtRQUM1RCxJQUFJLEVBQUU7WUFDSixRQUFRLEVBQUUsVUFBVTtTQUNyQjtLQUNGLENBQUM7QUFDSixDQUFDO0FBL0NELDBDQStDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogaW5pdERiVXNlcnMgaGFuZGxlcyBldmVudHMgZnJvbSBhIENsb3VkRm9ybWF0aW9uIEN1c3RvbSBSZXNvdXJjZSBpbiBvcmRlclxuICogdG8gcnVuIGFmdGVyIHRoZSBpbml0aWFsIGNyZWF0aW9uIG9mIHRoZSBTZWFTa2V0Y2ggRGF0YWJhc2UuXG4gKiBJdCBkb2VzIHR3byB0aGluZ3M6XG4gKiAgICogQ3JlYXRlcyBhIG5ldyAnZ3JhcGhpbGUnIHVzZXIgZm9yIHVzZSBieSBwb3N0Z3JhcGhpbGVcbiAqICAgKiBHcmFudHMgJ3Jkc19pYW0nIHBlcm1pc3Npb24gdG8gYm90aCBwb3N0Z3JlcyAmIGdyYXBoaWxlIHVzZXJzXG4gKiAgICAgdG8gZW5hYmxlIGlhbSBhdXRoZW50aWNhdGlvblxuICovXG5pbXBvcnQgKiBhcyBBV1MgZnJvbSBcImF3cy1zZGtcIjtcbmltcG9ydCB7IENsaWVudCB9IGZyb20gXCJub2RlLXBvc3RncmVzXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKGV2ZW50OiBBV1NDREtBc3luY0N1c3RvbVJlc291cmNlLk9uRXZlbnRSZXF1ZXN0KSB7XG4gIHN3aXRjaCAoZXZlbnQuUmVxdWVzdFR5cGUpIHtcbiAgICBjYXNlIFwiQ3JlYXRlXCI6XG4gICAgICBjb25zb2xlLmxvZyhcImluaXRpYWxpemluZyB1c2Vycy4uLlwiLCBldmVudC5SZXNvdXJjZVByb3BlcnRpZXMpO1xuICAgICAgcmV0dXJuIGluaXRpYWxpemVVc2VycyhldmVudCk7XG4gICAgY2FzZSBcIlVwZGF0ZVwiOlxuICAgICAgY29uc29sZS5sb2coXCJ1cGRhdGU6IG5vb3BcIik7XG4gICAgICByZXR1cm4geyBQaHlzaWNhbFJlc291cmNlSWQ6IGV2ZW50LlBoeXNpY2FsUmVzb3VyY2VJZCB9O1xuICAgIGNhc2UgXCJEZWxldGVcIjpcbiAgICAgIGNvbnNvbGUubG9nKFwiZGVsZXRlOiBub29wXCIpO1xuICAgICAgcmV0dXJuIHt9O1xuICB9XG59XG5cbmludGVyZmFjZSBEQlNlY3JldCB7XG4gIHBhc3N3b3JkOiBzdHJpbmc7XG4gIGRibmFtZTogc3RyaW5nO1xuICBlbmdpbmU6IHN0cmluZztcbiAgcG9ydDogbnVtYmVyO1xuICBkYkluc3RhbmNlSWRlbnRpZmllcjogc3RyaW5nO1xuICBob3N0OiBzdHJpbmc7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbml0aWFsaXplVXNlcnMoXG4gIGV2ZW50OiBBV1NDREtBc3luY0N1c3RvbVJlc291cmNlLk9uRXZlbnRSZXF1ZXN0XG4pOiBQcm9taXNlPEFXU0NES0FzeW5jQ3VzdG9tUmVzb3VyY2UuT25FdmVudFJlc3BvbnNlPiB7XG4gIGNvbnN0IHJlZ2lvbiA9IGV2ZW50LlJlc291cmNlUHJvcGVydGllc1tcInJlZ2lvblwiXTtcbiAgaWYgKCFyZWdpb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCIncmVnaW9uJyBub3QgZGVmaW5lZCBpbiBSZXNvdXJjZVByb3BlcnRpZXNcIik7XG4gIH1cbiAgY29uc3QgY2xpZW50ID0gbmV3IEFXUy5TZWNyZXRzTWFuYWdlcih7XG4gICAgcmVnaW9uLFxuICB9KTtcbiAgY29uc3Qgc2VjcmV0TmFtZSA9IGV2ZW50LlJlc291cmNlUHJvcGVydGllc1tcInNlY3JldFwiXTtcbiAgaWYgKCFzZWNyZXROYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiJ3NlY3JldCcgbm90IGRlZmluZWQgaW4gUmVzb3VyY2VQcm9wZXJ0aWVzXCIpO1xuICB9XG4gIGNvbnN0IHNlY3JldFZhbHVlID0gYXdhaXQgY2xpZW50XG4gICAgLmdldFNlY3JldFZhbHVlKHsgU2VjcmV0SWQ6IHNlY3JldE5hbWUgfSlcbiAgICAucHJvbWlzZSgpO1xuICAvLyBEZWNyeXB0cyBzZWNyZXQgdXNpbmcgdGhlIGFzc29jaWF0ZWQgS01TIENNSy5cbiAgLy8gRGVwZW5kaW5nIG9uIHdoZXRoZXIgdGhlIHNlY3JldCBpcyBhIHN0cmluZyBvciBiaW5hcnksIG9uZSBvZiB0aGVzZSBmaWVsZHMgd2lsbCBiZSBwb3B1bGF0ZWQuXG4gIGxldCBzZWNyZXQ6IERCU2VjcmV0O1xuICBpZiAoc2VjcmV0VmFsdWUuU2VjcmV0U3RyaW5nKSB7XG4gICAgc2VjcmV0ID0gSlNPTi5wYXJzZShzZWNyZXRWYWx1ZS5TZWNyZXRTdHJpbmcpO1xuICB9IGVsc2Uge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBsZXQgYnVmZiA9IG5ldyBCdWZmZXIoc2VjcmV0VmFsdWUuU2VjcmV0QmluYXJ5ISwgXCJiYXNlNjRcIik7XG4gICAgc2VjcmV0ID0gSlNPTi5wYXJzZShidWZmLnRvU3RyaW5nKFwiYXNjaWlcIikpO1xuICB9XG4gIGNvbnN0IGRiQ2xpZW50ID0gbmV3IENsaWVudCh7XG4gICAgZGF0YWJhc2U6IHNlY3JldC5kYm5hbWUsXG4gICAgaG9zdDogc2VjcmV0Lmhvc3QsXG4gICAgcG9ydDogc2VjcmV0LnBvcnQsXG4gICAgcGFzc3dvcmQ6IHNlY3JldC5wYXNzd29yZCxcbiAgICB1c2VyOiBzZWNyZXQudXNlcm5hbWUsXG4gIH0pO1xuICBhd2FpdCBkYkNsaWVudC5jb25uZWN0KCk7XG4gIGNvbnNvbGUubG9nKFwiY3JlYXRpbmcgdXNlci4uLlwiKTtcbiAgYXdhaXQgZGJDbGllbnQucXVlcnkoXCJDUkVBVEUgVVNFUiBncmFwaGlsZSBXSVRIIExPR0lOXCIpO1xuICBjb25zb2xlLmxvZyhcImdyYW50aW5nIHJkc19pYW0uLi5cIik7XG4gIGF3YWl0IGRiQ2xpZW50LnF1ZXJ5KFwiR1JBTlQgcmRzX2lhbSBUTyBwb3N0Z3Jlc1wiKTtcbiAgY29uc3QgcmVzID0gYXdhaXQgZGJDbGllbnQucXVlcnkoXCJHUkFOVCByZHNfaWFtIFRPIGdyYXBoaWxlXCIpO1xuICBjb25zb2xlLmxvZyhcImRvbmVcIiwgcmVzKTtcbiAgcmV0dXJuIHtcbiAgICBQaHlzaWNhbFJlc291cmNlSWQ6IGAke3NlY3JldC5kYkluc3RhbmNlSWRlbnRpZmllcn0vZGJVc2Vyc2AsXG4gICAgRGF0YToge1xuICAgICAgdXNlcm5hbWU6IFwiZ3JhcGhpbGVcIixcbiAgICB9LFxuICB9O1xufVxuIl19