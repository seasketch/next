FROM alpine:3.12
RUN apk --no-cache add postgresql-client git nodejs npm openssh wget curl
# install aws cli v2
ENV GLIBC_VER=2.31-r0
# install glibc compatibility for alpine
RUN apk --no-cache add \
        binutils \
        curl \
    && curl -sL https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub -o /etc/apk/keys/sgerrand.rsa.pub \
    && curl -sLO https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VER}/glibc-${GLIBC_VER}.apk \
    && curl -sLO https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VER}/glibc-bin-${GLIBC_VER}.apk \
    && curl -sLO https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VER}/glibc-i18n-${GLIBC_VER}.apk \
    && apk add --no-cache \
        glibc-${GLIBC_VER}.apk \
        glibc-bin-${GLIBC_VER}.apk \
        glibc-i18n-${GLIBC_VER}.apk \
    && /usr/glibc-compat/bin/localedef -i en_US -f UTF-8 en_US.UTF-8 \
    && curl -sL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o awscliv2.zip \
    && unzip awscliv2.zip \
    && aws/install \
    && rm -rf \
        awscliv2.zip \
        aws \
        /usr/local/aws-cli/v2/*/dist/aws_completer \
        /usr/local/aws-cli/v2/*/dist/awscli/data/ac.index \
        /usr/local/aws-cli/v2/*/dist/awscli/examples \
        glibc-*.apk \
    && apk --no-cache del \
        binutils \
        curl \
    && rm -rf /var/cache/apk/*

# ssh-keygen so that we can generate a github deploy key
# https://docs.github.com/en/github/authenticating-to-github/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent#generating-a-new-ssh-key
RUN   apk update && \
      apk add --no-cache \
      openssh-keygen

WORKDIR /usr/src/app
RUN ssh-keygen -t rsa -b 4096 -C "support@seasketch.org" -f /root/.ssh/id_rsa -P ""
RUN ssh-keyscan -H github.com >> /etc/ssh/ssh_known_hosts
RUN echo "Be sure to add /root/.ssh/id_rsa.pub to the @seasketch/next repo deploy keys!"
COPY ./github.sh /etc/profile.d/
COPY ./pg.sh /etc/profile.d/
RUN chmod u+x /etc/profile.d/pg.sh
RUN chmod u+x /etc/profile.d/github.sh
RUN wget "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem" -O /root/rds-ca-2019-root.pem
CMD [ "tail", "-f" ]
