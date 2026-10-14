FROM node:22-alpine
WORKDIR /app
COPY server.js ./server.js
ENV HOST=0.0.0.0
ENV PORT=27878
EXPOSE 27878/tcp
USER node
CMD ["node", "server.js"]
