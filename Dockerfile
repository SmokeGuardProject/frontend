FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=https://api.smoke-guard.pp.ua/api
ARG VITE_REALTIME_MODE=socket
ARG VITE_REALTIME_SOCKET_URL=https://api.smoke-guard.pp.ua/realtime

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_REALTIME_MODE=$VITE_REALTIME_MODE
ENV VITE_REALTIME_SOCKET_URL=$VITE_REALTIME_SOCKET_URL

RUN npm run build

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
