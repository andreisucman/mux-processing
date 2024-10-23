#!/bin/bash

# Set variables
IMAGE_NAME="sunchainltd/myo-processing"
TAG="1.0"
CONTAINER_NAME="myo_processing_container" # Set a default container name

# Find the container ID(s) using the image name
# This command lists container IDs for containers running the specified image
CONTAINER_IDS=$(docker ps -q --filter ancestor=$IMAGE_NAME:$TAG)

# Check if container IDs were found
if [ -z "$CONTAINER_IDS" ]; then
    echo "No running containers found for $IMAGE_NAME:$TAG. Will pull a new image..."
else
    # Loop through each container ID found and replace them
    for CONTAINER_ID in $CONTAINER_IDS; do
        # Optionally, retrieve the container's name
        CONTAINER_NAME=$(docker inspect --format='{{.Name}}' $CONTAINER_ID | sed 's/\///')
        
        echo "Stopping container $CONTAINER_NAME ($CONTAINER_ID)..."
        docker stop $CONTAINER_ID

        echo "Removing container $CONTAINER_NAME ($CONTAINER_ID)..."
        docker rm $CONTAINER_ID
    done

    # Remove the old image
    echo "Removing old image for $IMAGE_NAME:$TAG..."
    docker rmi $IMAGE_NAME:$TAG
fi

# Pull the latest image
echo "Pulling the latest image..."
docker pull $IMAGE_NAME:$TAG

# Run a new container with the default name
echo "Running a new container $CONTAINER_NAME with the new image..."
docker run -d --restart=always -p 80:3002 --name $CONTAINER_NAME --env-file ./env.list $IMAGE_NAME:$TAG
