FROM node:24

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
ARG commit
RUN git clone https://github.com/seasketch/next.git /home/seasketch/src && cd /home/seasketch/src && git checkout "$commit"
WORKDIR /home/seasketch/src
# npm ci --workspace still installs every workspace. Keep the packages the
# API build compiles, then npm install from the root lockfile. Dev
# dependencies of those packages supply tsup, rollup, and esbuild.
RUN node -e 'const fs=require("fs"); const keep=new Set(["api","geostats-types","fgb-source","h3-land","raster-array","ai-data-analyst","metadata-parser","gl-style-builder","vector-data-source","map-tile-cache-calculator","mapbox-gl-esri-sources","overlay-engine","overlay-worker","lambda-db-client","spatial-uploads-handler"]); for (const name of fs.readdirSync("packages")) { if (!keep.has(name)) fs.rmSync("packages/"+name,{recursive:true,force:true}); }' \
 && npm install --no-audit --no-fund \
 && npm run build:libs \
 && npm run build --workspace=@seasketch/api
WORKDIR /home/seasketch/src/packages/api
EXPOSE 3857
CMD ["npm", "run", "start"]