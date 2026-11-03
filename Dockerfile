FROM node:22.23.4-alpine

LABEL maintainer="Sergio Rodríguez <sergio.rdzsg@gmail.com>"

ADD --chown=node:node . /pdn_s1_backend
WORKDIR /pdn_s1_backend

RUN yarn install \
&& yarn cache clean

EXPOSE ${PORT}

USER node

CMD ["yarn", "start"]
