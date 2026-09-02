FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server ./server
EXPOSE 8787
CMD ["node", "server/index.mjs"]
