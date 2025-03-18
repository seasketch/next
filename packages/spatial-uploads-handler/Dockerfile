FROM amazon/aws-lambda-nodejs:20 as builder
WORKDIR /usr/app
RUN dnf install -y tar unzip
RUN curl https://rclone.org/install.sh | bash
RUN dnf install -y git clang sqlite-devel zlib-devel make
RUN curl -O -L https://github.com/felt/tippecanoe/archive/refs/tags/2.64.0.tar.gz
RUN mkdir ./tippecanoe
RUN tar -zxvf 2.64.0.tar.gz -C ./tippecanoe --strip-components=1
WORKDIR /usr/app/tippecanoe
RUN make -j
RUN make install
WORKDIR /usr/app
RUN curl -L https://github.com/protomaps/go-pmtiles/releases/download/v1.8.0/go-pmtiles_1.8.0_Linux_x86_64.tar.gz > ./pmtiles.tar.gz
RUN tar -zxvf ./pmtiles.tar.gz
RUN npm install -g typescript@5.5
RUN dnf install -y jq
COPY tsconfig.json  ./
COPY package.json ./package.json.original
RUN jq 'del(.scripts.postinstall) | del(.scripts.install) | del(.dependences["@seasketch/geostats-types"]) | del(.dependences["@seasketch/metadata-parser"])' package.json.original > package.json
# Not using lerna, so need to copy this manually
RUN mkdir -p ./node_modules/@seasketch
COPY ./@seasketch/geostats-types ./node_modules/@seasketch/geostats-types
COPY ./@seasketch/metadata-parser ./node_modules/@seasketch/metadata-parser
RUN npm install
RUN mkdir -p ./node_modules/@seasketch
COPY ./@seasketch/geostats-types ./node_modules/@seasketch/geostats-types
COPY ./@seasketch/metadata-parser ./node_modules/@seasketch/metadata-parser
COPY handler.ts ./
COPY src ./src
RUN npm run build


# Heavily inspired by
# https://github.com/lambgeo/docker-lambda/blob/master/dockerfiles/Dockerfile
FROM amazon/aws-lambda-nodejs:20 as gdal
RUN dnf update -y
RUN dnf install -y git autoconf libtool flex bison cmake make \
      tar gzip gcc gcc-c++ libpng-devel nasm \
      libxml2-devel readline-devel openssl-devel curl-devel \
      cmake3 && dnf clean all

ENV PREFIX=/usr
# pkg-config
ENV PKGCONFIG_VERSION=0.29.2
RUN mkdir /tmp/pkg-config \
  && curl -sfL https://pkg-config.freedesktop.org/releases/pkg-config-${PKGCONFIG_VERSION}.tar.gz | tar zxf - -C /tmp/pkg-config --strip-components=1 \
  && cd /tmp/pkg-config \
  && CFLAGS="-O2 -Wl,-S" ./configure --prefix=$PREFIX --with-internal-glib \
  && make -j $(nproc) --silent && make install && make clean \
  && rm -rf /tmp/pkg-config

ENV PKG_CONFIG_PATH=$PREFIX/lib/pkgconfig/

RUN dnf install -y sqlite sqlite-devel

RUN dnf install -y expat expat-devel

ENV \
  SQLITE3_LIBS="-L/usr/lib64 -lsqlite3" \
  SQLITE3_INCLUDE_DIR="/usr/include" \
  SQLITE3_CFLAGS="$CFLAGS -I/usr/include" \
  PATH=/usr/bin/:$PATH

RUN dnf install -y libxml2 libxml2-devel

RUN dnf install -y nghttp2 libnghttp2 libnghttp2-devel

RUN dnf install -y libcurl-minimal libcurl-devel

RUN mkdir /tmp/libdeflate \
  && curl -sfL https://github.com/ebiggers/libdeflate/archive/v1.10.tar.gz | tar zxf - -C /tmp/libdeflate --strip-components=1 \
  && cd /tmp/libdeflate \
  && make -j $(nproc) --silent PREFIX=$PREFIX && make install \
  && rm -rf /tmp/libdeflate

RUN dnf install -y libpng libpng-devel

RUN dnf install -y libjpeg-turbo libjpeg-turbo-devel
RUN dnf install -y libwebp libwebp-devel
RUN dnf install -y libzstd libzstd-devel

ENV LERC_VERSION=2.2.1
RUN mkdir /tmp/lerc \
  && curl -sfL https://github.com/Esri/lerc/archive/v${LERC_VERSION}.tar.gz | tar zxf - -C /tmp/lerc --strip-components=1 \
  && cd /tmp/lerc \
  && cmake3 . \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX:PATH=$PREFIX \
    -DCMAKE_INSTALL_LIBDIR:PATH=lib \
    -DCMAKE_C_FLAGS="-O2 -Wl,-S" \
    -DCMAKE_CXX_FLAGS="-O2 -Wl,-S" \
  && make -j $(nproc) --silent && make install \
  && rm -rf /tmp/lerc

RUN dnf install -y libtiff libtiff-devel
RUN dnf install -y openjpeg2 openjpeg2-devel

ENV GEOS_VERSION=3.12.1
RUN mkdir /tmp/geos \
  && curl -sfL https://github.com/libgeos/geos/archive/refs/tags/${GEOS_VERSION}.tar.gz | tar zxf - -C /tmp/geos --strip-components=1 \
  && cd /tmp/geos \
  && mkdir build && cd build \
  && cmake3 .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX:PATH=$PREFIX \
    -DCMAKE_INSTALL_LIBDIR:PATH=lib \
    -DCMAKE_C_FLAGS="-O2 -Wl,-S" \
    -DCMAKE_CXX_FLAGS="-O2 -Wl,-S" \
  && make -j $(nproc) --silent && make install \
  && rm -rf /tmp/geos

  ENV PROJ_VERSION=9.3.1
  RUN mkdir /tmp/proj && mkdir /tmp/proj/data \
    && curl -sfL https://github.com/OSGeo/proj/archive/${PROJ_VERSION}.tar.gz | tar zxf - -C /tmp/proj --strip-components=1 \
    && cd /tmp/proj \
    && mkdir build && cd build \
    && cmake3 .. \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX:PATH=$PREFIX \
      -DCMAKE_INSTALL_LIBDIR:PATH=lib \
      -DCMAKE_INSTALL_INCLUDEDIR:PATH=include \
      -DBUILD_TESTING=OFF \
      -DCMAKE_C_FLAGS="-O2 -Wl,-S" \
      -DCMAKE_CXX_FLAGS="-O2 -Wl,-S" \
    && make -j $(nproc) --silent && make install \
    && rm -rf /tmp/proj

# GeoTIFF
ENV LIBGEOTIFF_VERSION=1.7.1
RUN mkdir /tmp/libgeotiff \
  && curl -sfL https://github.com/OSGeo/libgeotiff/releases/download/${LIBGEOTIFF_VERSION}/libgeotiff-${LIBGEOTIFF_VERSION}.tar.gz | tar zxf - -C /tmp/libgeotiff --strip-components=1 \
  && cd /tmp/libgeotiff \
  && LDFLAGS="-Wl,-rpath,'\$\$ORIGIN'" CFLAGS="-O2 -Wl,-S" CXXFLAGS="-O2 -Wl,-S" ./configure \
    --prefix=$PREFIX \
    --with-proj=$PREFIX \
    --with-jpeg=$PREFIX \
    --with-zip=yes \
    --with-zlib \
    --with-libtiff=$PREFIX \
  && make -j $(nproc) --silent && make install \
  && rm -rf /tmp/libgeotiff

# Build blosc (needed for ZARR)
ENV BLOSC_VERSION=1.21.0
RUN mkdir /tmp/blosc \
  && curl -sfL https://github.com/Blosc/c-blosc/archive/refs/tags/v${BLOSC_VERSION}.tar.gz | tar zxf - -C /tmp/blosc --strip-components=1 \
  && cd /tmp/blosc \
  && cmake3 -G"Unix Makefiles" \
    -DCMAKE_INSTALL_PREFIX:PATH=$PREFIX \
    -DCMAKE_INSTALL_LIBDIR:PATH=lib \
    -DCMAKE_INSTALL_RPATH="$ORIGIN" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-O2 -Wl,-S" \
    -DCMAKE_CXX_FLAGS="-O2 -Wl,-S" \
    -DBUILD_SHARED=ON \
    -DBUILD_STATIC=OFF \
    -DBUILD_BENCHMARKS=OFF \
    -DBUILD_FUZZERS=OFF \
    -DBUILD_TESTS=OFF \
    -DPREFER_EXTERNAL_LZ4=ON \
    -DPREFER_EXTERNAL_ZLIB=ON \
    -DPREFER_EXTERNAL_ZSTD=ON \
    -DDEACTIVATE_SNAPPY=OFF . \
  && make -j $(nproc) --silent && make install && make clean \
  && rm -rf /tmp/blosc

# libcrypto (for GPC access)
RUN mkdir /tmp/cryptopp \
  && curl -sfL https://github.com/weidai11/cryptopp/archive/refs/tags/CRYPTOPP_8_6_0.tar.gz | tar zxf - -C /tmp/cryptopp --strip-components=1 \
  && cd /tmp/cryptopp \
  && make -j $(nproc) --silent && make install PREFIX=$PREFIX \
  && rm -rf /tmp/cryptopp

# szip (for hdf)
ENV SZIP_VERSION=2.1.1
RUN mkdir /tmp/szip \
  && curl -sfL https://support.hdfgroup.org/ftp/lib-external/szip/${SZIP_VERSION}/src/szip-${SZIP_VERSION}.tar.gz | tar zxf - -C /tmp/szip --strip-components=1 \
  && cd /tmp/szip \
  && CFLAGS="-O2 -Wl,-S" CXXFLAGS="-O2 -Wl,-S" ./configure --prefix=$PREFIX --disable-static \
  && make -j $(nproc) --silent && make install && make clean \
  && rm -rf /tmp/szip

RUN dnf install -y libtirpc libtirpc-devel


# Install HDF5 from source
ENV HDF5_VERSION=1.10.5
RUN mkdir /tmp/hdf5 \
    && curl -sfL https://support.hdfgroup.org/ftp/HDF5/current/src/hdf5-${HDF5_VERSION}.tar.gz | tar zxf - -C /tmp/hdf5 --strip-components=1 \
    && cd /tmp/hdf5 \
    && ./configure --prefix=$PREFIX --enable-shared \
    && make -j $(nproc) && make install \
    && rm -rf /tmp/hdf5

# Install NetCDF from source
ENV NETCDF_VERSION=4.8.1
RUN mkdir /tmp/netcdf \
    && curl -sfL https://github.com/Unidata/netcdf-c/archive/refs/tags/v${NETCDF_VERSION}.tar.gz | tar zxf - -C /tmp/netcdf --strip-components=1 \
    && cd /tmp/netcdf \
    && ./configure --prefix=$PREFIX --enable-shared --disable-dap \
    && make -j $(nproc) && make install \
    && rm -rf /tmp/netcdf

# Install for python bindings (gdal_calc)
RUN dnf install -y openssl python-pip python3 swig python-devel
RUN LD_LIBRARY_PATH="" pip install cython numpy==1.25 wheel --no-binary numpy

# GDAL
ENV GDAL_VERSION=3.9.2
RUN mkdir /tmp/gdal \
  && curl -sfL https://github.com/OSGeo/gdal/archive/refs/tags/v${GDAL_VERSION}.tar.gz | tar zxf - -C /tmp/gdal --strip-components=1 \
  && cd /tmp/gdal \
  && mkdir build && cd build \
  && cmake3 .. \
    -DGDAL_USE_EXTERNAL_LIBS=ON \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX:PATH=$PREFIX \
    -DCMAKE_INSTALL_LIBDIR:PATH=lib64 \
    -DCMAKE_C_FLAGS="-O2 -Wl,-S" \
    -DCMAKE_CXX_FLAGS="-O2 -Wl,-S" \
    -DGDAL_SET_INSTALL_RELATIVE_RPATH=ON \
    -DGDAL_USE_TIFF_INTERNAL=OFF \
    -DGDAL_USE_GEOTIFF_INTERNAL=OFF \
    -DGDAL_USE_LERC_INTERNAL=OFF \
    -DGDAL_USE_NETCDF=ON \
    -DLERC_INCLUDE_DIR=$PREFIX/include \
    -DLERC_LIBRARY=$PREFIX/lib/libLercLib.so \
    -DPNG_PNG_INCLUDE_DIR=$PREFIX/include \
    -DPNG_LIBRARY_RELEASE=$PREFIX/lib64/libpng.so \
    -DBUILD_PYTHON_BINDINGS=ON \
  && make -j $(nproc) --silent && make install \
  && rm -rf /tmp/gdal  

FROM amazon/aws-lambda-nodejs:20
WORKDIR ${LAMBDA_TASK_ROOT}
# Bring C libs from lambgeo/lambda-gdal image
COPY --from=gdal /usr/lib/ /usr/lib/
COPY --from=gdal /usr/lib64/ /usr/lib64/
COPY --from=gdal /usr/include/ /usr/include/
COPY --from=gdal /usr/share/ /usr/share/
COPY --from=gdal /usr/bin/ /usr/bin/

ENV \
  GDAL_DATA=/usr/share/gdal \
  PROJ_LIB=/usr/share/proj \
  GDAL_CONFIG=/usr/bin/gdal-config \
  GEOS_CONFIG=/usr/bin/geos-config \
  PATH=/usr/bin:$PATH

COPY --from=builder /usr/local/bin/tippecanoe /usr/local/bin/tippecanoe
COPY --from=builder /usr/app/dist/* ./
COPY --from=builder /usr/app/dist/src ./src
COPY --from=builder /usr/app/node_modules ./node_modules
COPY --from=builder /usr/bin/rclone /bin/rclone
COPY --from=builder /usr/bin/unzip /bin/unzip
COPY --from=builder /usr/app/pmtiles /bin/pmtiles
COPY .rclone.conf /var/task/rclone.conf
# RUN dnf install -y openssl python-pip python3
# LD_LIBRARY_PATH flag is necessary to avoid ssl errors
RUN dnf install -y openssl python-pip python3 swig python-devel
RUN LD_LIBRARY_PATH="" pip install cython numpy==1.25
RUN LD_LIBRARY_PATH="" pip3 install --no-cache-dir --upgrade rasterio fiona
CMD ["handler.processUpload"]