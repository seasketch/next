FROM node:18-alpine
RUN apk --no-cache add \
  git \
  openssh \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  # for webgl support
  xorg \
  xserver-xorg \
  xvfb \ 
  libx11-dev \ 
  libxext-dev
  
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
RUN npm install -g lerna
ARG commit
RUN git clone https://github.com/seasketch/next.git /var/seasketch && cd /var/seasketch && git checkout $commit
WORKDIR /var/seasketch/packages/api
RUN npx lerna bootstrap && npm run build
EXPOSE 3857
CMD ["npm", "run", "start"]