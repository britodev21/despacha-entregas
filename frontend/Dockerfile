# DESPACHA — imagem da tela: build do React + Nginx sem root.
# O Traefik do servidor faz o HTTPS e entrega o tráfego aqui (porta 8080);
# este Nginx serve os arquivos estáticos, aplica headers de segurança e rate
# limit e encaminha /api/ para a API na rede interna.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: nenhum pacote executa código na instalação.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
# Variáveis VITE_* são PÚBLICAS (vão para o JavaScript do navegador).
ARG VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ARG VITE_MAP_ATTRIBUTION="&copy; OpenStreetMap"
ENV VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL VITE_MAP_ATTRIBUTION=$VITE_MAP_ATTRIBUTION
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
# Origem dos tiles do mapa: precisa estar liberada na CSP (img-src).
ARG MAP_TILE_ORIGIN=https://tile.openstreetmap.org
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i "s#__MAP_TILE_ORIGIN__#${MAP_TILE_ORIGIN}#g" /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
