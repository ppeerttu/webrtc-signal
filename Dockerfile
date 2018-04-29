FROM node:9-alpine

WORKDIR /usr/src

COPY package* ./

RUN npm install

CMD ["node", "index.js"]
