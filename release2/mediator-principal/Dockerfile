#FROM node:10.13.0
FROM  node:10.13-alpine
ARG mediator-name="mediateur-principal"
ENV PORT 5021
RUN mkdir -p /var/node/$mediator-name
ADD src/  /var/node/$mediator-name
WORKDIR /var/node/$mediator-name
RUN npm install
EXPOSE $PORT
CMD [ "npm", "start" ]