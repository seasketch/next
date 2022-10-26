FROM amazon/aws-lambda-nodejs:16 as builder
WORKDIR /usr/app
RUN yum install -y unzip
RUN curl https://rclone.org/install.sh | bash
RUN yum install -y git clang sqlite-devel zlib-devel make install build-essential libsqlite3-dev zlib1g-dev
RUN git clone https://github.com/felt/tippecanoe.git
WORKDIR /usr/app/tippecanoe
RUN make -j
RUN make install
WORKDIR /usr/app
RUN yum install -y tar
RUN curl -L https://github.com/protomaps/go-pmtiles/releases/download/v1.3.0/go-pmtiles_1.3.0_Linux_x86_64.tar.gz > ./pmtiles.tar.gz
RUN tar -zxvf ./pmtiles.tar.gz
RUN npm install -g typescript@4.7
COPY package.json tsconfig.json  ./
RUN npm install
COPY handler.ts ./
COPY src ./src
RUN npm run build

FROM ghcr.io/lambgeo/lambda-gdal:3.5 as gdal

FROM amazon/aws-lambda-nodejs:16
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
COPY --from=builder /usr/app/dist/* ./
COPY --from=builder /usr/app/dist/src ./src
COPY --from=builder /usr/app/node_modules ./node_modules
COPY --from=builder /usr/bin/rclone /bin/rclone
COPY --from=builder /usr/app/pmtiles /bin/pmtiles
COPY .rclone.conf /var/task/rclone.conf
CMD ["handler.processUpload"]