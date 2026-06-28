FROM node:22-alpine
ENV NODE_PATH=/usr/local/lib/node_modules
RUN apk --no-cache add bash ca-certificates postgresql-client git openssh-client wget curl aws-cli redis \
  && update-ca-certificates
WORKDIR /usr/src/app
# Create deploy keys
COPY ./github_key /root/.ssh/id_rsa
COPY ./github_key.pub /root/.ssh/id_rsa.pub
RUN chmod 700 /root/.ssh \
  && chmod 600 /root/.ssh/id_rsa \
  && chmod 644 /root/.ssh/id_rsa.pub \
  && ssh-keyscan -t rsa,ecdsa,ed25519 -H github.com >> /root/.ssh/known_hosts
# Startup scripts check status of deploy keys, setup pg environment vars, and echo
# startup messages
COPY ./github.sh /etc/profile.d/
COPY ./pg.sh /etc/profile.d/
COPY ./migrate.sh /home/
RUN chmod u+x /etc/profile.d/pg.sh
RUN chmod u+x /etc/profile.d/github.sh
RUN chmod u+x /home/migrate.sh
# # # You will need to make sure deploy keys are in github before the next command can be run!
RUN git clone git@github.com:seasketch/next.git
WORKDIR /usr/src/app/next/packages/api
RUN npm install -g \
  graphile-migrate@"$(node -p "require('./package.json').devDependencies['graphile-migrate']")" \
  dotenv@"$(node -p "require('./package.json').devDependencies['dotenv']")" \
  --no-audit --no-fund
# Fetch the current AWS RDS trust bundle so pg clients can verify TLS.
RUN wget "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" -O /root/rds-global-bundle.pem
# TODO: can we just run this without a command? Is there a standard Docker CMD "noop"?
CMD [ "tail", "-f", "/dev/null" ]
