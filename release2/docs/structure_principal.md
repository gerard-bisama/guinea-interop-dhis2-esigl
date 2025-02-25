# Structure of the mediator: principal
Principal mediator: is used for general operation commons to all mediators.It is used for the following operations
  * Extract the list of facilities (geographic and service delivery points) from DHIS2 (orgUnits) to store in HAPI (Location). The DHIS2 is considered as the master list.
  * Map the list of facilities extracted from DHIS2 to the corresponding e-SIGL using IDs. This process is done throught the use of excel file with contains mapp the DHIS2 ID=>e-SIGL ID
  * Extract the list of products and associated program from e-SIGL to HAPI server. Then push them in to DHIS2.
  * Process the metadata on the products and program to facilitate the exchange of data. P.ex: Update the categorycombo of the products in DHIS2 by adding the generating the content of the "code" fields which is empty sometimes but used in ADX data pushed into DHIS2.

## Configuration
The file structure of the mediator-principal is represented below. The last release of the source code is located the 'release2' folder. After cloning the repository from git hub go in the release2 folder.
```
git clone https://github.com/gerard-bisama/guinea-interop-dhis2-esigl.git
cd guinea-interop-dhis2-esigl/release2
```
The file structure looks like this:
```
cd /
release2
|_ mediator-principal  
  |_ Dockerfile
  |_ env.list
  |_ logs
  |_ src
    |_config
      |_ config.json
      |_ mediator.json  
    |_ data
    |_ lib
    |_ package.json

```
* mediator-principal: the main folder that contains the mediator source codes.
* Dockerfile: Set of instructions which are used by docker build for building a custom docker image of the mediator-principal
* env.list: used to set environment variable for the mediator-principal docker
* logs: contains the logs of the docker 
* src: contains the config, lib, data folder.
* lib: the librairy of the source code of the micro-service
* config: the configuration files
* data: the repository where the facility mapping data will be stored.

### Configuration of the type of the service
This section show how to configure a mediator as a standalone microservice or an openHIM components
```
$ cd mediator-principal/src/config
$ nano config.json
```
Here is the contains

```
{
  "api": {
    "username": "root@openhim.org",
    "password": "password", 
    "apiURL": "https://localhost:8080",
    "trustSelfSigned": "true"
  },
  "register": false,
  "heartbeat": true
}

```
here are the parameter to set (lease the other as they are)
* password: the password of the root openhim user as set during the installation of the openHIM
* register: false|true. false to run the mediator as a standalone component and true to register the mediator in openHIM. If true the mediator should appear in the Admin console of openHIM.

### Configuration of mediator 
The mediator needs to interact with eLMIS and DHIS2 to extract data, transform them on a standard format based on the needs and then exchange them. The HAPI FHIR server is used as a central repository for sharing the data extracted and processed from both system's as resources that can be used by an other system which make the solution able to be scalled up on new usecase. The mediator play this role by implementing the business logics related to Extraction, Transformation and Loading (ETL) of data.
To edit the mediator
 ```
$ cd mediator-principal/src/config
$ nano mediator.json
```

Leave other node as they are and configure the value in the 'config' node.
To learn more about the skeleton of mediators and configuration file, visit the [OpenHIM dev guide](https://openhim.org/docs/dev-guide/developing-mediators).

```
{
  "urn": "urn:uuid:a4976a30-9364-11e9-9146-07d60medpg01",
  "version": "0.3.1",
  "name": "Mediateur PNLP",
  "description": "Extraction des donnees sur les requisitions de eSIGL->DHIS2",
  "defaultChannelConfig": [],
  ....
  "config": {
    "dhis2Server":{
		"url":"https://localhost/api",
		"username":"user",
		"password":"pwd"
		},
	"hapiServer":{
    "url":"http://localhost/fhir",
    "username":"",
		"password":""
		},
	"esiglServer":{
		"url":"https://localhost",
		"username":"user",
		"password":"pwd",
		"resourcespath":"/rest-api"
    },
  "elasticsearchServer":{
      "url":"http://localhost:9200",
      "username":"",
      "password":""
    },
  "batchSizeFacilityToSync":"200",
  "batchSizeFacilityFromHapi":"20",
  "extensionBaseUrlProductDetails":"https://www.hl7.org/fhir/StructureDefinition/ProductDetails",
  "extensionBaseUrlProgramDetails":"https://www.hl7.org/fhir/StructureDefinition/ProgramDetails",
  "program":{
    "code":"SIGL-INTEGRE-PNLP"
  }
  }
}
```
* urn,version,name,description: elements of identification of the mediators. 
* logstashDirectory,elasticsearchServer:(!!! deprecated) they were used for visualizing logs. Now this can been done with [portainer](https://docs.portainer.io/start/install-ce/server/docker/linux). Don't worry about them.
* dhis2Server: url endpoint of DHIS2 and associated credentials. Since the associated  account should be able to create/update DHIS2 metadata related to category (CategoryOption,Category,CategoryCombo,categoryOptionCombo).
* esiglServer:  url endpoint of eLMIS and associated credentials. The associated  account should be able to read facilities, products and programs informations.
*  extensionBaseUrlProductDetails and extensionBaseUrlProgramDetails: information about profile related to programs and products. Don't change any thing.
* batchSizeFacilityToSync: to specify the number of facilities extracted from DHIS2 by page to avoid timeout when querying orgUnitis from DHIS2. 
* batchSizeFacilityFromHapi: to specify the number of resource to extract per page. Not only used for facilities but also for products.
* program.code: used to specify which program to sync to DHIS2 or for which to update the CategoryOptionCombo, It is compulsory for these two operations.

### Configuration of env variable for the docker
When running as docker container, the mediator will need to read some environment variable.
Here is the content of the env.list file.

```
OPENHIM_APIURL=https://IP:8083
OPENHIM_USERNAME=root@openhim.org
OPENHIM_PASSWORD=pwd
OPENHIM_TRUSTSELFSIGNED=true
MEDIATOR_HOST=IP
MEDIATOR_PORT=5021
MEDIATOR_REGISTER=true
MEDIATOR_HEARTBEAT=true
```
here are the parameter to set (lease the other as they are).
* OPENHIM_APIURL: replace IP by the local IP of the computer were the openHIM core is installed
* OPENHIM_PASSWORD: the password of the root@oepnhim.org
* MEDIATOR_HOST: replace IP by the local IP of the computer where the mediator is running.
* MEDIATOR_PORT: define the port of the mediator
* MEDIATOR_REGISTER: false|true. false to run the mediator as a standalone component and true to register the mediator in openHIM. If true the mediator should appear in the Admin console of openHIM.