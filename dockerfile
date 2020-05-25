FROM node:12-alpine

MAINTAINER Sergio Rodríguez <sergio.rdzsg@gmail.com>

ADD . /pdn_s1_backend
WORKDIR /pdn_s1_backend

RUN yarn add global yarn \
&& yarn install \
&& yarn cache clean

EXPOSE ${PORT}

CMD ["yarn", "start"]
