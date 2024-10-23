FROM node:lts-buster AS build

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y ffmpeg build-essential python3 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

ENV NODE_ENV=development

RUN npm install --include=dev --include=optional sharp @tensorflow/tfjs-node --production --silent

COPY . .

RUN rm -rf dist
RUN npm run build

FROM node:lts-buster

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/models ./models
COPY --from=build --chown=node:node /usr/src/app/package*.json ./

ENV DATABASE_NAME=""
ENV MODERATION_SERVER_URL=""
ENV OPENAI_API_KEY=""
ENV MODEL_MINI=""
ENV MODEL=""
ENV DO_SPACES_ENDPOINT=""
ENV DO_SPACES_BUCKET_NAME=""
ENV DO_SPACES_REGION=""
ENV DO_SPACES_ACCESS_KEY=""
ENV DO_SPACES_SECRET_KEY=""
ENV DATABASE_URI=""
ENV SECRET=""

RUN npm install --include=optional --production --silent

EXPOSE 3002

USER node

CMD ["npm", "start"]
