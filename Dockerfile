# Build stage
FROM node:lts-buster AS build

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y ffmpeg build-essential python3 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --include=dev --include=optional --cpu=x64 --os=linux --libc=glibc sharp @tensorflow/tfjs-node --production

COPY . .

RUN rm -rf dist
RUN npm run build

FROM node:lts-buster

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/models ./models
COPY --from=build --chown=node:node /usr/src/app/package*.json ./

RUN npm install --include=optional --os=linux --cpu=x64 --libc=glibc --production

EXPOSE 3002

USER node

CMD ["npm", "start"]