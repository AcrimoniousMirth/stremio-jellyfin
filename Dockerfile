FROM node:22-slim

# API key auth (preferred) — generate at Jellyfin > Dashboard > Advanced > API Keys
ENV JELLYFIN_API_KEY ""

# Username/password auth (fallback if API key is not set)
ENV JELLYFIN_USER ""
ENV JELLYFIN_PASSWORD ""

ENV SERVER_PORT 60421
ENV JELLYFIN_SERVER "http://localhost:8096"

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app

COPY package*.json ./

RUN chown -R node:node /home/node/app

USER node
RUN npm install

COPY --chown=node:node *.js ./

EXPOSE $SERVER_PORT
ENTRYPOINT ["node", "server.js"]
