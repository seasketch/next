FROM node:23

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r seasketch && useradd -rm -g seasketch -G audio,video seasketch

USER seasketch

WORKDIR /home/seasketch
RUN npm install lerna@6
ARG commit
RUN git clone https://github.com/seasketch/next.git /home/seasketch/src && cd /home/seasketch/src && git checkout $commit
WORKDIR /home/seasketch/src/packages/api
RUN npx lerna@6.6.2 bootstrap --scope=@seasketch/api --scope=@seasketch/map-tile-cache-calculator --scope=@seasketch/vector-data-source --scope=@seasketch/mapbox-gl-esri-sources --scope=spatial-uploads-handler --scope=@seasketch/geostats-types --scope=@seasketch/metadata-parser --scope=fgb-source --scope=overlay-engine --scope=overlay-worker && npm run build
EXPOSE 3857
CMD ["npm", "run", "start"]