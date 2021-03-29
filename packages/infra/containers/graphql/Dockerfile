FROM node:15-alpine as builder
RUN apk --no-cache add git openssh 
COPY github_key /root/.ssh/id_rsa
COPY github_key.pub /root/.ssh/id_rsa.pub
RUN ssh-keyscan -H github.com >> /etc/ssh/ssh_known_hosts
RUN git clone --single-branch --branch infra-stack git@github.com:seasketch/next.git /var/seasketch
WORKDIR /var/seasketch/packages/api
RUN npx lerna bootstrap && npm run build

FROM node:15-alpine
COPY --from=builder /var/seasketch /var/seasketch
WORKDIR /var/seasketch/packages/api
EXPOSE 3857
CMD ["npm", "run", "start"]