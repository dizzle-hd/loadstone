FROM node:21 AS build

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . ./
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/out/ /usr/share/nginx/html/

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
