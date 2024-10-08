# Stage 1: Build
FROM node:lts-alpine AS build

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache ffmpeg

# Copy package files and install all dependencies (including devDependencies)
COPY package*.json ./

# Ensure NODE_ENV is set to development
ENV NODE_ENV=development

# Install dependencies, explicitly including devDependencies
RUN npm install --include=dev --include=optional --silent

# Copy application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:lts-alpine

# Set working directory
WORKDIR /usr/src/app

# Install runtime dependencies
RUN apk add --no-cache ffmpeg

# Copy only the necessary files from the build stage
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./

# Install only production dependencies
ENV NODE_ENV=production
RUN npm install --include=optional --production --silent

# Set environment variables
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

# Expose port
EXPOSE 3002

# Change ownership to 'node' user
RUN chown -R node /usr/src/app

# Switch to non-root user
USER node

# Start the application
CMD ["npm", "start"]
