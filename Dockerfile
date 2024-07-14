FROM node:20

COPY . ./workspace

WORKDIR /workspace

RUN npm install

EXPOSE 80

CMD npm run start
