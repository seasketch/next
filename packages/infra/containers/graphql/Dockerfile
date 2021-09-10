FROM node:16-alpine as builder
RUN apk --no-cache add git openssh 
RUN npm install -g lerna
ARG commit
RUN git clone https://github.com/seasketch/next.git /var/seasketch && cd /var/seasketch && git checkout $commit
WORKDIR /var/seasketch/packages/api
RUN npx lerna bootstrap --scope=@seasketch/api && npm run build

FROM node:16-alpine
COPY --from=builder /var/seasketch /var/seasketch
WORKDIR /var/seasketch/packages/api
EXPOSE 3857
CMD ["npm", "run", "start"]