sudo apt update

sudo apt install docker.io

sudo systemctl start docker

sudo systemctl enable docker

docker pull sunchainltd/myo-processing --no-cache

docker stop [ID]

docker rm [ID]

docker ps

docker run -d --restart=always -p 80:3001 sunchainltd/myo-processing --env-file ./env.list

# to make the bash script executable

chmod +x ./script.sh

./script.sh
