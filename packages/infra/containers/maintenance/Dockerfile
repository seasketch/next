FROM alpine:3.13
RUN apk --no-cache add postgresql-client git nodejs npm openssh wget curl aws-cli

# ssh-keygen so that we can generate a github deploy key
# https://docs.github.com/en/github/authenticating-to-github/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent#generating-a-new-ssh-key
RUN   apk update && \
      apk add --no-cache \
      openssh-keygen

WORKDIR /usr/src/app
# Create deploy keys
RUN ssh-keygen -t rsa -b 4096 -C "support@seasketch.org" -f /root/.ssh/id_rsa -P ""
RUN ssh-keyscan -H github.com >> /etc/ssh/ssh_known_hosts
# Startup scripts check status of deploy keys, setup pg environment vars, and echo
# startup messages
COPY ./github.sh /etc/profile.d/
COPY ./pg.sh /etc/profile.d/
RUN chmod u+x /etc/profile.d/pg.sh
RUN chmod u+x /etc/profile.d/github.sh
# # You will need to make sure deploy keys are in github before the next command can be run!
RUN git clone git@github.com:seasketch/next.git
WORKDIR /usr/src/app/next/packages/api
RUN npm install
# Fetch root cert so that pg can use ssl connection
RUN wget "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem" -O /root/rds-ca-2019-root.pem
# TODO: can we just run this without a command? Is there a standard Docker CMD "noop"?
CMD [ "tail", "-f" ]
