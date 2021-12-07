#FROM node:10.13.0
FROM  node:10.13-alpine
ARG mediatorname="mediateur-pnlp"
ENV PORT 5022
RUN mkdir -p /var/node/$mediatorname
ADD src/  /var/node/$mediatorname
WORKDIR /var/node/$mediatorname
RUN apk --no-cache add curl
RUN npm install
EXPOSE $PORT
CMD [ "npm", "start" ]