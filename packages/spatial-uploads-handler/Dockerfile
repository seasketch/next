FROM amazon/aws-lambda-nodejs:18 as builder
WORKDIR /usr/app
RUN yum install -y tar unzip
RUN curl https://rclone.org/install.sh | bash
RUN yum install -y git clang sqlite-devel zlib-devel make install build-essential libsqlite3-dev zlib1g-dev
RUN curl -O -L https://github.com/felt/tippecanoe/archive/refs/tags/2.53.0.tar.gz
RUN mkdir ./tippecanoe
RUN tar -zxvf 2.53.0.tar.gz -C ./tippecanoe --strip-components=1
WORKDIR /usr/app/tippecanoe
RUN make -j
RUN make install
WORKDIR /usr/app
RUN curl -L https://github.com/protomaps/go-pmtiles/releases/download/v1.8.0/go-pmtiles_1.8.0_Linux_x86_64.tar.gz > ./pmtiles.tar.gz
RUN tar -zxvf ./pmtiles.tar.gz
RUN npm install -g typescript@5.1.5
RUN yum install -y jq
WORKDIR /usr/app
COPY ./package.json ./package.json.original
RUN jq 'del(.dependencies."@seasketch/geostats-types") | del(.scripts.install)' ./package.json.original > ./package.json
COPY ./tsconfig.json  ./tsconfig.json
RUN npm install

FROM ghcr.io/lambgeo/lambda-gdal:3.6 as gdal

FROM amazon/aws-lambda-nodejs:18
WORKDIR ${LAMBDA_TASK_ROOT}
# Bring C libs from lambgeo/lambda-gdal image
COPY --from=gdal /opt/lib/ /opt/lib/
COPY --from=gdal /opt/include/ /opt/include/
COPY --from=gdal /opt/share/ /opt/share/
COPY --from=gdal /opt/bin/ /opt/bin/

ENV \
  GDAL_DATA=/opt/share/gdal \
  PROJ_LIB=/opt/share/proj \
  GDAL_CONFIG=/opt/bin/gdal-config \
  GEOS_CONFIG=/opt/bin/geos-config \
  PATH=/opt/bin:$PATH

COPY --from=builder /usr/local/bin/tippecanoe /usr/local/bin/tippecanoe
COPY ./dist/* ./
COPY ./dist/src ./src
COPY --from=builder /usr/app/node_modules ./node_modules
COPY --from=builder /usr/bin/rclone /bin/rclone
COPY --from=builder /usr/bin/unzip /bin/unzip
COPY --from=builder /usr/app/pmtiles /bin/pmtiles
# RUN mkdir -p /usr/app/node_modules/@seasketch/geostats-types
COPY ./node_modules/@seasketch /usr/app/node_modules/
COPY ./.rclone.conf /var/task/rclone.conf
RUN yum install -y python3
RUN pip3 install rasterio fiona
CMD ["handler.processUpload"]