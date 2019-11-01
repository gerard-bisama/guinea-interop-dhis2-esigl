# Interoperability system between e-SIGL and DHIS2 (Guinea case)
The e-SIGL and DHIS-2 applications have been operating for several months in Guinea. This plateform allows the data exchange between the 2 softwares.

## Architecture
The architecture requires the following components apart of DHIS2 and e-SIGL:
 **HAPI FHIR Server (hapi-fhir-jpaserver-local)**: This is used to store and validate extracted Data on product,program and requisition, converted to FHIR resources and to act as the FHIR Repository. Any FHIR client can request resources from this repository. 
**OpenHIM Console and Core API Server**. The middleware component designed to ease interoperability between disparate information systems.
**Push DHIS2 and eSIGL to FHIR HAPI Server**. Mediator used to pull resources from DHIS2 and eSIGL, transform them to Fhir standard and save it in the Hapi Server
**Fhir Resources from HAPI to DHIS2**. Mediator used to pull resources from validated resources from the Hapi Server and push them in DHIS2
## Installation

### Hapi FHIR and OpenHIM
* [Hapi Fhir/JPA Server](https://hapifhir.io/doc_jpa.html)
* [OpenHIM-Core](https://openhim.readthedocs.io/en/latest/getting-started.html)
* [OpenHIM Console](https://openhim.readthedocs.io/en/latest/getting-started.html)
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


