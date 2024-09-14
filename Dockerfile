FROM node:lts-alpine
WORKDIR /usr/src/app
RUN apk add --no-cache ffmpeg
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --include=optional sharp --production --silent && mv node_modules ../
COPY . .

ENV DATABASE_NAME=""
ENV API_SERVER_URL=""
ENV PROCESSING_SERVER_URL=""
ENV DO_SPACES_ENDPOINT=""
ENV DO_SPACES_BUCKET_NAME=""
ENV DO_SPACES_REGION=""
ENV AWS_REKOGNITION_BUCKET_NAME=""
ENV DATABASE_URI=""
ENV DO_SPACES_ACCESS_KEY=""
ENV DO_SPACES_SECRET_KEY=""
ENV SECRET=""

EXPOSE 3001
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
