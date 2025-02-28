# Interoperability system between e-SIGL and DHIS2 (Guinea use case)
The e-SIGL (eLMIS) and DHIS-2 applications have been operating for several months in Guinea. This plateform allows the data exchange between the 2 softwares.

> [!IMPORTANT]
> eLMIS is based on openLMIS V2. For others eLMIS code can be customized with few level of effor since there is not need to write the code from scratch.

## Architecture
The architecture requires the following components running on Ubuntu 20 (Ubuntu 16 or 18 could work too) of DHIS2 and e-SIGL:
* HAPI FHIR Server (hapi-fhir-jpaserver-local): 
This is used to store and validate extracted Data on product,program and requisition, converted to FHIR resources and to act as the FHIR Repository. Any FHIR client can request resources from this repository using HTTP requests. 
* OpenHIM Console and Core API Server:
 The middleware component designed to ease interoperability between disparate information systems.
* Mediators: 
Microservices used used to pull resources from DHIS2 and eSIGL, transform them to Fhir standard and save it in the Hapi Server, then push then to DHIS2 in ADX formats. Then can be deployed as container or nodejs services. They are developed based on the openHIM requirement to be able to be managed using OpeHIM console
* (Optional) docker and  Portainer: 
Docker is an open platform for developing, shipping, and running applications. Docker provides the ability to package and run an application in a loosely isolated environment called a container.. Portainer hides the complexity of managing containers behind an easy-to-use UI. 
> [!NOTE] 
> The resources version of FHIR used for this project is R4. [Link](https://hl7.org/fhir/R4/resourcelist.html) for more information about R4 FHIR resources.

## Installation of components

### Install docker community Edition (Optional) 
The docker CE is used to facilitate the deployment of some software components such as HAPI, OpenHIM and associated mediators. However,all these can be deployed on standard way. Docker is compulsory for Portainer.
> [!NOTE] 
> For our last release the mediators has been optimized to be easily deployed and to run as containers. 
To install docker engine using via apt repository as described [here](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository)

### Hapi FHIR 
* [Hapi Fhir/JPA Server](https://github.com/hapifhir/hapi-fhir-jpaserver-starter)
Hapi can be installed by checking it out and deployed using maven, or through tomcat with a war file. Or it can be run as a docker multistage component.
We have choose to setup Hapi FHIR as a multistage container projet.
To respond to the architecture and some project constraints (Hapi fail sometimes to connect to Postgres and the datase fails to be created at the startup if not exist), We choose to create separately hapi server container and postgres container, them we will connect them later.
> [!NOTE] 
> For our last release, we have used postgresql 9.6 and Hapi FHIR server V5.5.1
#### Configure the postgres server container
 Edit a docker-compose.yml as described below to install postgresql 9.6 and run it on port 5432. The volume is used to store permanently database data. The prostgres database will store Hapi Fhir configurations (Profiles,Search Parameters) and resources (Products,Programs,Requisitions,etc...)
 ##### 1. Edit the docker-compose.yml file

```
$ mkdir docker-postgres
$ cd docker-postgres
$ touch docker-compose.yml
$ nano docker-compose.yml 
```
then copy and paste the lines below (please pay attention to the identitation in yml file)
```
version: "3"
services:
  postgres-96:
    container_name: postgres-interop
    image: postgres:9.6
    restart: always
    environment:
      POSTGRES_PASSWORD: admin
      POSTGRES_USER: admin
    volumes:
      - ./postgres-data:/home/server/docker_volumes/postgresql/data
    ports:
      - "5432:5432"
```
The line below shows the local path binded to the volume
``` /postgres-data:/home/server/docker_volumes/postgresql/data  
```
 ##### 2. Run the docker container
 ```
 $ docker-compose up
  ```
 ##### 3. Setup the role and database in the postgres container
 ```
 $ docker exec -it postgres-interop psql -U admin
  ```
postgres-interop: is the name of the container. Then create the database and the role based on the password and user defined in the postgres's docker-compose.yml
```
admin=# CREATE ROLE hapi LOGIN PASSWORD 'admin' NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
admin=# CREATE DATABASE hapi WITH OWNER = admin ENCODING = 'UTF8' TABLESPACE = pg_default CONNECTION LIMIT = -1;
admin=# \list
```
#### Configure the HAPI FHIR server container
##### 1. Pull the source from https://github.com/hapifhir/hapi-fhir-jpaserver-starter
 ```
$ git clone https://github.com/hapifhir/hapi-fhir-jpaserver-starter.git hapi-server-h2
 
 ```
 ##### 2. Edit the docker-compose file like this
 ```
 version: "3"
 services:
  hapi-fhir-jpaserver-start:
    build: . 
    container_name: hapi-fhir-server 
    restart: on-failure
    ports:
      - "8080:8080"
    network_mode: "host" 
    environment:
      profiles.active: r4
      spring.datasource.url: 'jdbc:postgresql://localhost:5432/hapi'
      spring.datasource.username: admin
      spring.datasource.password: admin
      spring.datasource.driverClassName: org.postgresql.Driver
      tester.home.server_address: 'http://localhost:8080/fhir'
  ```
**_network_mode_**: "host" #This to allow the hapi-fhir-server container to connect to the external postgres container
**_build_**: . # we can remove build and use a docker hub image 'image: "hapiproject/hapi:v5.5.1"'
**_spring.datasource.url_**:  The localhost  can be changed by the IP address of the local server.
**_ports_**: The port should be leave to 8080 since when changing the port mapping, it create the problem of hapi-server not hable to read the conformance metadata.

 ##### 3. Remove the access to global free hapi fhir server
 Comment these line in the src/main/resources/application.yml file.
```
 Global:
          name: Global Tester
          server_address: "http://hapi.fhir.org/baseR4"
          refuse_to_fetch_third_party_urls: false
          fhir_version: R4
```
 ##### 3.Deploy the hapi container
 ```
$ cd hapi-server-h2
$ docker-compose up -d --build
$ docker-compose up -d 
```
Then you can check if fhir is working by displaying the capability statement: "http://localhost:8080/fhir/metadata"
 ##### 4.Load the profile
 [FHIR](https://hl7.org/fhir/R4/modules.html) standard has been chosen for data exchange between eLMIS and DHIS2 since it provide at the same time the specification for data representation and data exchange. The [profiles](https://hl7.org/fhir/R4/profilelist.html) are defined to specialize general FHIR resources based on the use case. 
 Profiles have been created for the following data:
 * Product: for detailed product information
 * Program: to group products by program or group
 * Requisition: to collect information about the use of product
 To load the profiles we can post them manually on the HAPI server endpoint or use the tool 'load.js' picked from the [iHIRS5 source](https://github.com/iHRIS/iHRIS/tree/master/tools). The tool is in the tools directory of the 
 projet [here](https://github.com/iHRIS/iHRIS/tree/master/tools).
 The profile are located in profiles directory of the interoperability source project.
 1. Pull the source from https://github.com/gerard-bisama/guinea-interop-dhis2-esigl.git
 2. Load the profile in Hapi server.
 To load manually the profile, starting from the xxxDetails.StructureDefinition.xml then the associated xxx.StructureDefinition.xml
 ```
 $ cd guinea-interop-dhis2-esigl/fhir-profile
 $ curl -X POST 'http://localhost:8080/fhir' -d @ProductDetails.StructureDefinition.xml -H "Content-Type: application/xml"
 $ curl -X POST 'http://localhost:8080/fhir' -d @Product.StructureDefinition.xml -H "Content-Type: application/xml"
 ...
 ```
To load using the 'load.js' tool
```
$ cd guinea-interop.../release2/tools
$ npm install #Only once for the first time when the module is used. 
$ node load.js --server http://localhost:8080/fhir/ ../fhir-profile/ProductDetails.StructureDefinition.xml
$ node load.js --server http://localhost:8080/fhir/ ../fhir-profile/Product.StructureDefinition.xml 
```
If loaded successfully, you should getback the result with the name of resource created + http code 201

### OpenHIM
Follow the link below for the documentation on openHIM.
* [OpenHIM-Core & OpenHIM Console](https://openhim.org/docs/getting-started/prerequisites).
> [!IMPORTANT]
> OpenHIM console through its web UI, is the only approach that allow to change the configuration of mediator without reinstalling the mediator. If a parameter need to be changed to process a specific use case, this the best option.

##### 1. Pull the source from  openHIM repository
```
git clone https://github.com/jembi/openhim-common.git
cd openhim-common
```
##### 2. Set the openHIM console port. 
The openHIM console provide the UI for administrating mediators. Base on our need we will set the port to 80. The default port is 9000.
!!Pay attention about the port number. openHIM core uses some ports for its internal operation such as:for mediator registration. Avoid using these ports for other components.

```
console:
    container_name: openhim-console
    image: jembi/openhim-console
    ports:
        - "80:80"
``` 
Access the OpenHIM Console on http://localhost
##### 3. Deploy the openHIM 
```
$ cd openhim-common
$ docker-compose build 
$ docker-compose up -d
```
## Managing the mediators
The mediator are microservice or apps used to implement the exchange of resource between e-SIGL and DHIS2. In this architecture FHIR is used as an interface between e-SIGL and DHIS2. Differents mediators are implemented based on the use case to handle exchanges of data.
The mediator developped are [orchestration mediator](https://openhim.org/docs/tutorial/mediators/orchestrator) based on openHIM framework.
There is 2 main types of mediators: principal mediators and the program's mediators.
* Principal mediator: is used for general operation commons to all mediators.It is used for the following operations
  * Extract the list of facilities (geographic and service delivery points) from DHIS2 (orgUnits) to store in HAPI (Location). The DHIS2 is considered as the master list.
  * Map the list of facilities extracted from DHIS2 to the corresponding e-SIGL using IDs. This process is done throught the use of excel file with contains mapp the DHIS2 ID=>e-SIGL ID
  * Extract the list of products and associated program from e-SIGL to HAPI server. Then push them in to DHIS2.
  * Process the metadata on the products and program to facilitate the exchange of data. P.ex: Update the categorycombo of the products in DHIS2 by adding the generating the content of the "code" fields which is empty sometimes but used in ADX data pushed into DHIS2.

* Program mediators: it is used for management operation specific to program. Every program will have its dedicated mediators. The following operations are performed for each programs
  * Generate the metadata (dataElements) related to the requisition information of the products in DHIS2.The requisition concerns the data on the inventory of the products such as the quantity received, the stock on hand, the losses. For optimizing the metadata each program, the requisitions data elements are generated by program using the prefix of product code in the data element name.
  * Extract requisitions data in eLMIS and save them in Hapi server.
  * Push requisitions data from HAPI to DHIS2 as ADX resources.
  * Generate the indicators (supply chain indicators) from HAPI and push them to DHIS2. This is done because of the complexity of calculating some indicators directly in DHIS2 using the requisition's data and hard coded formula .

> [!IMPORTANT]
> Mediator should be runned on the same server where the openhim is deployed of these architecture is opted.

### Running the 'mediator-principal' mediator
The mediator-princal as other program mediators can be run as standalone microservice or openHIM components.
In term of system architecture, they can be run as a nodejs app or as a docker container.
The option depends to the need of the project. But the best one is to run them as docker continair attached to the openHIM as it will provide robust architecture and an console to manage the mediators.

The information about the structure of the mediator and the configuration of the mediator-principal can be found  [here](release2/docs/structure_principal.md)

#### running the 'mediator-principal' mediator as js app.
After configuration of the mediator, run the mediator
* Install the required dependencies
```
$ cd mediator-principal/src/
$ npm install
```
* Then run the mediator
```
npm start
```
The mediator will start by default at the port 5021 if not changed. If you have opted for openHIM console management, follow instruction on  [Register the mediator in openHIM console](#Register-the-mediator-in-openHIM-console-Opt)

#### running the 'mediator-principal' mediator as docker app.
1. Build the image or rebuild an image: 
```
$ cd mediator-principal
$ docker image  build -t mediateur-principal:v1 . #!!note '.' at the end of the command
```
2. (Opt) Bind the /binded-volume with ../mediateur-principal/data in case you want to access the mapping file, if there is a mapping to do otherwise remove the -v params.
```
$ docker container run --env-file ./env.list --name mediateur-principal -p 5021:5021 -v /home/lmis-server/dev/binded-volume:/var/node/mediateur-principal/data mediateur-principal:v1
```
3. (Opt) Check if the binding works.
```
$ docker inspect mediateur-principal
```
You will find the following node:
```
"Mounts": [
          {
              "Type": "bind",
              "Source": "/<localfolder>/binded-volume",
              "Destination": "/var/node/mediateur-principal/data",
              "Mode": "",
              "RW": true,
              "Propagation": "rprivate"
          }
      ]
```
4. See the logs to monitor activities of the mediator
```
$ container logs -f --tail 100 mediateur-principal
```
To restart the mediator the next time just run
```
docker start mediateur-principal
```
The mediator will start by default at the port 5021 if not changed. If you have opted for openHIM console management, follow instruction on  [Register the mediator in openHIM console](#Register-the-mediator-in-openHIM-console-Opt)

#### Trigger the operations on the mediateur-principal
The principal mediator used the channel to perform operations using url patterns.The url pattern are routes or endpoints that run the operations. 
The mediator principal has the following channels:
* 0-[Principal] Synchroniser les UO DHIS2->HAPI: The mediator gets organisation Units from DHIS2, transform them into Location resources and save them in FHIR. Url endpoint: _'syncorgunit2fhir'_ 
* 1-[Principal] Mapper les structures eSIGL avec les UO de DHIS2: the mediator gets the id of the facilities from an excel mapping file and update existing Location resource with them. Url endpoint: _'mapfacility2fhir'_ 
* 2-[Principal] Synchroniser le programmes et les produits associes avec HAPI: the mediator gets the list of products and associated programs from eLMIS, transform them to Product and Program based on the define profiles. Url endpoint: _'syncprogramproduct2fhir'_ 
* 3-[Principal] Synchroniser le programmes et les produits associes avec DHIS2: the mediator create/update the associated metadata related to product and programs into DHIS2. Url endpoint: _'syncprogramproduct2dhis?programcode'_ 
* 4-[Principal] Mettre à jour les categoryOptionCombos avant la synchro FHIR-DHIS2: the mediator updates information on the metadata created in DHIS2. Url endpoint: _'updatecatcombodhis?programcode'_ 

> [!IMPORTANT]
> The principal mediators operations should be runs at the initialization of the project, or if a new facility is added or a new product or program is added.

Below are the step trigger operations on the mediator-principale.
* Step 1: Extract list of all facilities from DHIS2, transfort them in Location resources and save them in the HAPI repository. Optionaly an orgUnit can be passed as a param _'orgunitid=id'_ to the endpoint and the operation will extract only chilfren of the provided facility. This can be usfull when the administrator knows where the new facilities have been added. As adding facilities are not transactional operation this can be run based of the need and manually
```sh
curl 'http://localhost:5021/syncorgunit2fhir' #to synch all orgUnits from DHIS2
#or
curl 'http://localhost:5021/syncorgunit2fhir?orgunitid=orgUnitId'
```
* step 2: Perform the mapping of facilities between eLMIS and DHIS2. The mapping required a manual matching between orgUnit ID and facility ID. Additionnal information such as category of facility, region and district are provided to facilitate the search and updating information.
The mapping file header should looks like this: 
```
['code','id','iddhis','etablissement','categories','region','prefecture']
```
The facilite map should be placed in 'pwd()/data' of the mediator and trigger the channel with
```sh
curl 'http://localhost:5021/mapfacility2fhir'
```
* step 3: Extract the list of all products and programs from eLMIS, transfort them in Product and Program resources resources and save them in the HAPI repository.
```sh
curl 'http://localhost:5021/syncprogramproduct2fhir'
```
* step 3: Extract the list of all products and programs from eLMIS and from specific program, transfort them in Product and Program metadata push them to DHIS2.the parameter _'programcode'_ is compulsory to syncronize only data from specific program to avoid overload of DHIS2 by syncing the unused data. if not provided the progralcode is the mediator.json or openHIM will be used.
```sh
curl 'http://localhost:5021/syncprogramproduct2dhis?programcode=xxxxx'
```
* step 4: Once the products and programs are created as category, catoption, DHIS2 generates the categoryOptionCombos. Sometime with newer version the categoryOptionCombos does not have the field code with is used in ADX later to push data.
```sh
curl 'http://localhost:5021/updatecatcombodhis' #take the program code in mediator configuration
#or
curl 'http://localhost:5021/updatecatcombodhis?programcode=xxxxxx'
```
#### Automate the operation of the mediateur-principal
Operations can be automated using crontab. Appart of the operation related to the mapping of facilities which require manual data handle to perform operations. All operations related to the synchronization of program and products can be configure on monthly basis since products and programs are not transactional data.
To configure the automatic sync of products and programs 'xxxxx' every month in crontab:
```sh
crontab -e
#then enter the following entries
0 0 1 * * curl 'http://localhost:5021/syncprogramproduct2fhir'
3 0 1 * *  curl 'http://localhost:5021/syncprogramproduct2dhis?programcode=xxxxx'
5 0 1 * *  curl 'http://localhost:5021/updatecatcombodhis?programcode=xxxxxx'
```
Once the sync is completed, the metadata should look like [this](release2/docs/dhis_productmetadata.md)
### Running the program mediators
The program-mediator can be run as standalone microservice or openHIM components.
In term of system architecture, they can be run as a nodejs app or as a docker container.
The option depends to the need of the project. But the best one is to run them as docker continair attached to the openHIM as it will provide robust architecture and an console to manage the mediators.
For performance purpuse due to the recurrent timeline when extraction data from eLMIS API or DHIS2 API, it is advisable to create a metiator per program. P.ex: if we want to synchronize data of PNLP (Malaria), PNLAT (TB/HIV), PEV (EPI) programs we will create 3 mediators. We can just copy the _'mediator-PNLP'_ and rename it to _'mediator-PNLAT'_  and _'mediator-PEV'_ 

The information about the structure of the mediator and the configuration of the mediator-principal can be found  [here](release2/docs/structure_progmediator.md)

Once the sync is completed, the metadata should look like [this](release2/docs/dhis_requisitions.md)

### Register the mediator in openHIM console (Opt).
When setting the parameter "register: true' either in config.json or env.list, the mediotor will send the request for registration to the openHIM.
And you have to perform additional configuration on openHIM console.
The detailed information on  the configuration of mediator in openHIM can be found [here](release2/docs/register_mediaror_openhim.md)



### Start server
Three main componants must be started to have an operational openhim server.
* Start the openhim-core
```
sudo service mongod start
openhim-core
```

* Start the Hapi FHIR Server
```
cd hapi-fhir-jpaserver-starter
mvn jetty:run -Djetty.http.port=8083 > ~/hapifhir.log &
```

* Start the openhim console
Openhim console is deployed as web application on apache. Ones need just to ensure that apache is running.

### Mediators
```
git clone https://github.com/gerard-bisama/guinea-interop-dhis2-esigl.git
cd guinea-interop-dhis2-esigl
```
To run the Push DHIS2 and eSIGL to FHIR HAPI Server mediator
```
cd esigl-dhis-interop
npm install
npm start
```
To run the Fhir Resources from HAPI to DHIS2 mediator
```
cd fhir-dhis-sync
npm install
npm start
```
### Configurations
Configure the mediators as described to the operational user manual. The user manual is available in the docs directory.

Taratataaa!!!!


