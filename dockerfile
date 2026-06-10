FROM node:22-alpine

LABEL maintainer="Sergio Rodríguez <sergio.rdzsg@gmail.com>"

ADD . /pdn_s1_backend
WORKDIR /pdn_s1_backend

RUN yarn install \
&& yarn cache clean

EXPOSE ${PORT}

CMD ["yarn", "start"]
