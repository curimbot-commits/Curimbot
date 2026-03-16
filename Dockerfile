FROM node:22.12.0 as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/frontend-app/browser /usr/share/nginx/html

# Configuración que usa el puerto dinámico de Railway
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["/bin/sh", "-c", "nginx -g 'daemon off;'"]