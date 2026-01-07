FROM node:18-alpine
WORKDIR /usr/src/app
# Install build tools for ZK libraries
RUN apk add --no-cache python3 make g++ 
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]