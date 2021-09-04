FROM node:15-alpine as builder
RUN apk --no-cache add git openssh 
COPY github_key /root/.ssh/id_rsa
COPY github_key.pub /root/.ssh/id_rsa.pub
RUN ssh-keyscan -H github.com >> /etc/ssh/ssh_known_hosts
RUN npm install -g lerna
ARG commit
RUN git clone git@github.com:seasketch/next.git /var/seasketch && cd /var/seasketch && git checkout $commit
WORKDIR /var/seasketch/packages/api
RUN npx lerna bootstrap --scope=@seasketch/api && npm run build

FROM node:15-alpine
COPY --from=builder /var/seasketch /var/seasketch
WORKDIR /var/seasketch/packages/api
EXPOSE 3857
CMD ["npm", "run", "start"]