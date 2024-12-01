sudo apt update

sudo apt install docker.io

sudo systemctl start docker

sudo systemctl enable docker

docker pull sunchainltd/mux-processing --no-cache

docker stop [ID]

docker rm [ID]

docker ps

docker run -d --restart=always -p 80:3001 sunchainltd/mux-processing:1.0 --env-file ./env.list.txt

# to make the bash script executable

chmod +x ./script.sh

./script.sh

cp node_modules/\@tensorflow/tfjs-node/deps/lib/tensorflow.dll node_modules/\@tensorflow/tfjs-node/lib/napi-v8/ // move files in napi-v8
