FROM node:10-alpine

WORKDIR /usr/src

COPY package* ./

RUN npm install

CMD ["node", "index.js"]
