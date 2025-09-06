# Node.js + npm preinstalled, built on Alpine
FROM node:20-alpine

# Update Alpine packages to reduce vulnerabilities
RUN apk update && apk upgrade --no-cache

COPY package.json package.json
COPY package-lock.json package-lock.json
COPY . .

RUN npm install

CMD ["node", "index.js"]