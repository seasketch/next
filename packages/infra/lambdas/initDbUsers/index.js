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
    await dbClient.query("CREATE USER graphile WITH LOGIN");
    await dbClient.query("GRANT CONNECT ON DATABASE seasketch TO graphile");
    await dbClient.query("GRANT rds_iam TO postgres");
    const res = await dbClient.query("GRANT rds_iam TO graphile");
    return {
        PhysicalResourceId: `${secret.dbInstanceIdentifier}/dbUsers`,
        Data: {
            username: "graphile",
        },
    };
}
exports.initializeUsers = initializeUsers;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQTs7Ozs7OztHQU9HO0FBQ0gsK0JBQStCO0FBQy9CLGlEQUF1QztBQUVoQyxLQUFLLFVBQVUsT0FBTyxDQUFDLEtBQStDO0lBQzNFLFFBQVEsS0FBSyxDQUFDLFdBQVcsRUFBRTtRQUN6QixLQUFLLFFBQVE7WUFDWCxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixFQUFFLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQy9ELE9BQU8sZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hDLEtBQUssUUFBUTtZQUNYLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDNUIsT0FBTyxFQUFFLGtCQUFrQixFQUFFLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQzFELEtBQUssUUFBUTtZQUNYLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDNUIsT0FBTyxFQUFFLENBQUM7S0FDYjtBQUNILENBQUM7QUFaRCwwQkFZQztBQVlNLEtBQUssVUFBVSxlQUFlLENBQ25DLEtBQStDO0lBRS9DLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNsRCxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQ1gsTUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO0tBQy9EO0lBQ0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDO1FBQ3BDLE1BQU07S0FDUCxDQUFDLENBQUM7SUFDSCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdEQsSUFBSSxDQUFDLFVBQVUsRUFBRTtRQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTRDLENBQUMsQ0FBQztLQUMvRDtJQUNELE1BQU0sV0FBVyxHQUFHLE1BQU0sTUFBTTtTQUM3QixjQUFjLENBQUMsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLENBQUM7U0FDeEMsT0FBTyxFQUFFLENBQUM7SUFDYixnREFBZ0Q7SUFDaEQsZ0dBQWdHO0lBQ2hHLElBQUksTUFBZ0IsQ0FBQztJQUNyQixJQUFJLFdBQVcsQ0FBQyxZQUFZLEVBQUU7UUFDNUIsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO0tBQy9DO1NBQU07UUFDTCxhQUFhO1FBQ2IsSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsV0FBVyxDQUFDLFlBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMzRCxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7S0FDN0M7SUFDRCxNQUFNLFFBQVEsR0FBRyxJQUFJLHNCQUFNLENBQUM7UUFDMUIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1FBQ3ZCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtRQUNqQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7UUFDakIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1FBQ3pCLElBQUksRUFBRSxNQUFNLENBQUMsUUFBUTtLQUN0QixDQUFDLENBQUM7SUFDSCxNQUFNLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUN6QixNQUFNLFFBQVEsQ0FBQyxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztJQUN4RCxNQUFNLFFBQVEsQ0FBQyxLQUFLLENBQUMsaURBQWlELENBQUMsQ0FBQztJQUN4RSxNQUFNLFFBQVEsQ0FBQyxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUNsRCxNQUFNLEdBQUcsR0FBRyxNQUFNLFFBQVEsQ0FBQyxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUM5RCxPQUFPO1FBQ0wsa0JBQWtCLEVBQUUsR0FBRyxNQUFNLENBQUMsb0JBQW9CLFVBQVU7UUFDNUQsSUFBSSxFQUFFO1lBQ0osUUFBUSxFQUFFLFVBQVU7U0FDckI7S0FDRixDQUFDO0FBQ0osQ0FBQztBQTdDRCwwQ0E2Q0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIGluaXREYlVzZXJzIGhhbmRsZXMgZXZlbnRzIGZyb20gYSBDbG91ZEZvcm1hdGlvbiBDdXN0b20gUmVzb3VyY2UgaW4gb3JkZXJcbiAqIHRvIHJ1biBhZnRlciB0aGUgaW5pdGlhbCBjcmVhdGlvbiBvZiB0aGUgU2VhU2tldGNoIERhdGFiYXNlLlxuICogSXQgZG9lcyB0d28gdGhpbmdzOlxuICogICAqIENyZWF0ZXMgYSBuZXcgJ2dyYXBoaWxlJyB1c2VyIGZvciB1c2UgYnkgcG9zdGdyYXBoaWxlXG4gKiAgICogR3JhbnRzICdyZHNfaWFtJyBwZXJtaXNzaW9uIHRvIGJvdGggcG9zdGdyZXMgJiBncmFwaGlsZSB1c2Vyc1xuICogICAgIHRvIGVuYWJsZSBpYW0gYXV0aGVudGljYXRpb25cbiAqL1xuaW1wb3J0ICogYXMgQVdTIGZyb20gXCJhd3Mtc2RrXCI7XG5pbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwibm9kZS1wb3N0Z3Jlc1wiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihldmVudDogQVdTQ0RLQXN5bmNDdXN0b21SZXNvdXJjZS5PbkV2ZW50UmVxdWVzdCkge1xuICBzd2l0Y2ggKGV2ZW50LlJlcXVlc3RUeXBlKSB7XG4gICAgY2FzZSBcIkNyZWF0ZVwiOlxuICAgICAgY29uc29sZS5sb2coXCJpbml0aWFsaXppbmcgdXNlcnMuLi5cIiwgZXZlbnQuUmVzb3VyY2VQcm9wZXJ0aWVzKTtcbiAgICAgIHJldHVybiBpbml0aWFsaXplVXNlcnMoZXZlbnQpO1xuICAgIGNhc2UgXCJVcGRhdGVcIjpcbiAgICAgIGNvbnNvbGUubG9nKFwidXBkYXRlOiBub29wXCIpO1xuICAgICAgcmV0dXJuIHsgUGh5c2ljYWxSZXNvdXJjZUlkOiBldmVudC5QaHlzaWNhbFJlc291cmNlSWQgfTtcbiAgICBjYXNlIFwiRGVsZXRlXCI6XG4gICAgICBjb25zb2xlLmxvZyhcImRlbGV0ZTogbm9vcFwiKTtcbiAgICAgIHJldHVybiB7fTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgREJTZWNyZXQge1xuICBwYXNzd29yZDogc3RyaW5nO1xuICBkYm5hbWU6IHN0cmluZztcbiAgZW5naW5lOiBzdHJpbmc7XG4gIHBvcnQ6IG51bWJlcjtcbiAgZGJJbnN0YW5jZUlkZW50aWZpZXI6IHN0cmluZztcbiAgaG9zdDogc3RyaW5nO1xuICB1c2VybmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW5pdGlhbGl6ZVVzZXJzKFxuICBldmVudDogQVdTQ0RLQXN5bmNDdXN0b21SZXNvdXJjZS5PbkV2ZW50UmVxdWVzdFxuKTogUHJvbWlzZTxBV1NDREtBc3luY0N1c3RvbVJlc291cmNlLk9uRXZlbnRSZXNwb25zZT4ge1xuICBjb25zdCByZWdpb24gPSBldmVudC5SZXNvdXJjZVByb3BlcnRpZXNbXCJyZWdpb25cIl07XG4gIGlmICghcmVnaW9uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiJ3JlZ2lvbicgbm90IGRlZmluZWQgaW4gUmVzb3VyY2VQcm9wZXJ0aWVzXCIpO1xuICB9XG4gIGNvbnN0IGNsaWVudCA9IG5ldyBBV1MuU2VjcmV0c01hbmFnZXIoe1xuICAgIHJlZ2lvbixcbiAgfSk7XG4gIGNvbnN0IHNlY3JldE5hbWUgPSBldmVudC5SZXNvdXJjZVByb3BlcnRpZXNbXCJzZWNyZXRcIl07XG4gIGlmICghc2VjcmV0TmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIidzZWNyZXQnIG5vdCBkZWZpbmVkIGluIFJlc291cmNlUHJvcGVydGllc1wiKTtcbiAgfVxuICBjb25zdCBzZWNyZXRWYWx1ZSA9IGF3YWl0IGNsaWVudFxuICAgIC5nZXRTZWNyZXRWYWx1ZSh7IFNlY3JldElkOiBzZWNyZXROYW1lIH0pXG4gICAgLnByb21pc2UoKTtcbiAgLy8gRGVjcnlwdHMgc2VjcmV0IHVzaW5nIHRoZSBhc3NvY2lhdGVkIEtNUyBDTUsuXG4gIC8vIERlcGVuZGluZyBvbiB3aGV0aGVyIHRoZSBzZWNyZXQgaXMgYSBzdHJpbmcgb3IgYmluYXJ5LCBvbmUgb2YgdGhlc2UgZmllbGRzIHdpbGwgYmUgcG9wdWxhdGVkLlxuICBsZXQgc2VjcmV0OiBEQlNlY3JldDtcbiAgaWYgKHNlY3JldFZhbHVlLlNlY3JldFN0cmluZykge1xuICAgIHNlY3JldCA9IEpTT04ucGFyc2Uoc2VjcmV0VmFsdWUuU2VjcmV0U3RyaW5nKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgbGV0IGJ1ZmYgPSBuZXcgQnVmZmVyKHNlY3JldFZhbHVlLlNlY3JldEJpbmFyeSEsIFwiYmFzZTY0XCIpO1xuICAgIHNlY3JldCA9IEpTT04ucGFyc2UoYnVmZi50b1N0cmluZyhcImFzY2lpXCIpKTtcbiAgfVxuICBjb25zdCBkYkNsaWVudCA9IG5ldyBDbGllbnQoe1xuICAgIGRhdGFiYXNlOiBzZWNyZXQuZGJuYW1lLFxuICAgIGhvc3Q6IHNlY3JldC5ob3N0LFxuICAgIHBvcnQ6IHNlY3JldC5wb3J0LFxuICAgIHBhc3N3b3JkOiBzZWNyZXQucGFzc3dvcmQsXG4gICAgdXNlcjogc2VjcmV0LnVzZXJuYW1lLFxuICB9KTtcbiAgYXdhaXQgZGJDbGllbnQuY29ubmVjdCgpO1xuICBhd2FpdCBkYkNsaWVudC5xdWVyeShcIkNSRUFURSBVU0VSIGdyYXBoaWxlIFdJVEggTE9HSU5cIik7XG4gIGF3YWl0IGRiQ2xpZW50LnF1ZXJ5KFwiR1JBTlQgQ09OTkVDVCBPTiBEQVRBQkFTRSBzZWFza2V0Y2ggVE8gZ3JhcGhpbGVcIik7XG4gIGF3YWl0IGRiQ2xpZW50LnF1ZXJ5KFwiR1JBTlQgcmRzX2lhbSBUTyBwb3N0Z3Jlc1wiKTtcbiAgY29uc3QgcmVzID0gYXdhaXQgZGJDbGllbnQucXVlcnkoXCJHUkFOVCByZHNfaWFtIFRPIGdyYXBoaWxlXCIpO1xuICByZXR1cm4ge1xuICAgIFBoeXNpY2FsUmVzb3VyY2VJZDogYCR7c2VjcmV0LmRiSW5zdGFuY2VJZGVudGlmaWVyfS9kYlVzZXJzYCxcbiAgICBEYXRhOiB7XG4gICAgICB1c2VybmFtZTogXCJncmFwaGlsZVwiLFxuICAgIH0sXG4gIH07XG59XG4iXX0=