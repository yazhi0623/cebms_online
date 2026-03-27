FROM node:22-alpine AS build

WORKDIR /app/frontend

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_HEALTH_URL=/health
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_HEALTH_URL=$VITE_HEALTH_URL

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend /app/frontend
RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/aws-ubuntu-docker-private-api/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
