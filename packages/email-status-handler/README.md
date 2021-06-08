# `@seasketch/emailStatusHandler`

This Lambda microservice handles status updates from SES via an SNS topic. It connects directly to the SeaSketch database and updates `invite_emails.status`.

In the architecture diagram below, this lambda handles the step in the upper-right corner.

![InviteMailerArch](https://user-images.githubusercontent.com/511063/120561722-ec8d9580-c3b9-11eb-80de-15ddd9a1e594.png)
