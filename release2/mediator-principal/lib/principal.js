#!/usr/bin/env node
'use strict'

const express = require('express')
const medUtils = require('openhim-mediator-utils')
const URI = require('urijs');
const isJSON = require('is-json');
const path = require('path');
var btoa = require('btoa');
//const winston = require('winston')
const {createLogger,format,transports} = require('winston');
const { combine, timestamp, label, printf } = format;
const customLibrairy=require('./lib.js');

// Logging setup
var globalRes;
var orgUnitResource="organisationUnits";
var faciliyResource="facilities";
var productResource="Product";
var programResource="Program";
var fhirProgramResource="Organization";
var fhirProductResource="Basic";
var fhirLocationResource="Location";
var dhisCategoryOption="categoryOptions";
var dhisCategory="categories";
var dhisCategoryCombo="categoryCombos";
var prodIDPrefixe="prod";
var typeOpenhimResultStatus={
  successful:"Successful",
  failed:"Failed"
}
var typeOperation ={
    startTheService:"Start",
    stopTheService:"Stop",
    getData:"Get",
    postData:"Post",
    putData:"Put",
    deleteData:"Delete",
    normalProcess:"Process"
};
var typeResult={
    success:"Success",
    failed:"Failed",
    iniate:"Initiate",
    ongoing:"ongoing"
};
var levelType={
    info:"info",
    error:"error",
    warning:"warn"
};
var mediatorName="mediateur_principal";
const myFormat = printf(({ level, message, label, timestamp,operationType,action,result }) => {
    return `${timestamp},${level},${label},${operationType},${action},${result},${message}`;
  });
// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = process.env.NODE_ENV === 'test' ? require('../config/test') : require('../config/config')
const mediatorConfig = require('../config/mediator')

var port = process.env.NODE_ENV === 'test' ? 7001 : mediatorConfig.endpoints[0].port;
var indexSearchName=`principal_activities`;
var logger=null;
var filePath;
var processMonth;
var processYear;
var indexName;
var logFileName;
//----------------------------Define logger information -------------------------------------/


/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
 function errorHandler(err, req, res, next) {
		  if (res.headersSent) {
			return next(err);
		  }
		  res.status(500);
		  res.render('error', { error: err });
	}


function setupApp () {
//----------------------------Define logger information -------------------------------------/
filePath=config.appDirectory;
processMonth= parseInt(config.synchronizationPeriod.split("-")[1]);
processYear= parseInt(config.synchronizationPeriod.split("-")[0]);
indexName=`principal_activities_${processMonth}-${processYear}`;

logFileName=path.join(filePath,`/logs/${indexName}.log`);
logger = createLogger({
    format: combine(
      label({ label: mediatorName }),
      timestamp(),
      myFormat
    ),
    transports: [new transports.Console(),
        new transports.File({ filename: logFileName })
    ]
  });
	
  const app = express()
  app.use(errorHandler);
  
  //-------- routes -------------------------//
	app.get("/error",(req, res)=>{
	res.send({});
  });//end get(/error)
  app.get('/loadlogs',(req, res) => {
    globalRes=res;

    let esToken = `Basic ${btoa(config.elasticsearchServer.username+':'+config.elasticsearchServer.password)}`;
    let url= URI(config.elasticsearchServer.url).segment(indexSearchName).segment("logs");
    url=url.toString();
    logger.log({level:levelType.info,operationType:typeOperation.startTheService,action:"/loadlogs",result:typeResult.iniate,
     message:`Lancement de de l'importation des logs dans Kibana`});
    customLibrairy.readAppLogFile(logFileName,(fileLogs)=>{
      logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/loadlogs",result:typeResult.ongoing,
     message:`${fileLogs.length} logs a inserer dans Kibana`});
      saveEntryToElastic(url,esToken,fileLogs,function(responseCollection){
        
        let successResponse=responseCollection.find(element=>element.status >=200 || element.status<300);
        //console.log(successResponse);
        let urn = mediatorConfig.urn;
        let status = '';
        let response = {};
        if(successResponse)
        {
          status = 'Successful';
          response = {
            status: 200,
            headers: {
            'content-type': 'application/json'
            },
            body:JSON.stringify( {'Process':`L'operation de chargement de logs dans Kibana effectuees avec success`}),
            timestamp: new Date().getTime()
          };
        }
        else{
          status = 'Failed';
          response = {
            status: 500,
            headers: {
            'content-type': 'application/json'
            },
            body:JSON.stringify( {'Process':`Echec de l'operation de chargement de logs dans Kibana `}),
            timestamp: new Date().getTime()
          };
        }
        var orchestrationToReturn=[
        {
          name: "loadlogs",
          request: {
            path :"/loadlogs",
            headers: {'Content-Type': 'application/json'},
            querystring: "",
            body:JSON.stringify( {'Process':`Operation de creation des elements des donnees dans DHIS2`}),
            method: "POST",
            timestamp: new Date().getTime()
          },
          response: response
        }];
        var returnObject = {
          "x-mediator-urn": urn,
          "status": status,
          "response": response,
          "orchestrations": orchestrationToReturn,
          "properties": ""
        }
        res.set('Content-Type', 'application/json+openhim');
        res.status(response.status).send(returnObject);
        
      }); 
    });
  });
	app.get('/syncorgunit2fhir', (req, res) => {
        
        globalRes=res;
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncorgunit2fhir",result:typeResult.iniate,
        message:`Lancement de la synchro des orgunits DHIS2=>HAPI`});
        const dhis2Token = `Basic ${btoa(config.dhis2Server.username+':'+config.dhis2Server.password)}`;
        const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;

        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/${orgUnitResource}.json`,result:typeResult.iniate,
        message:`DHIS2: Extraction des structures de DHIS2`});
        getListDHIS2OrgUnit(dhis2Token,function(listOrgUnits)
        {
            //res.send(listOrgUnits);
            if(listOrgUnits.length>0)
            {
                let bundle=customLibrairy.buildLocationHierarchy(listOrgUnits);
                logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${orgUnitResource}.json`,result:typeResult.success,
        message:`${listOrgUnits.length} structures extraits de DHIS2`});
                //res.send(bundle);
                logger.log({level:levelType.info,operationType:typeOperation.postData,action:"/fhir/Location",result:typeResult.iniate,
                        message:`Lancement de la synchronisation des structures dans HAPI`});
                saveBundle2Fhir(hapiToken,'Location',bundle,function(hapiServerResponse)
                {
                  //console.log(hapiServerResponse.status);
                  //let urn = mediatorConfig.urn
                  let returnObject=null;
                  if(hapiServerResponse.status==200)
                  {

                      logger.log({level:levelType.info,operationType:typeOperation.postData,action:"/fhir/Location",result:typeResult.success,
                      message:`${hapiServerResponse.message}`});
                      logger.log({level:levelType.info,operationType:typeOperation.postData,action:"/syncorgunit2fhir",result:typeResult.success,
                      message:`${hapiServerResponse.message}`});
                      
                      let responseMessage=`${bundle.entry.length} Location ont ete charger avec success dans HAPI FHIR`;
                      let bodyMessage=`${bundle.entry.length} Location a charger dans HAPI FHIR`;
                      returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"saveBundle2Fhir","POST");
                      
                      
                  }
                  else
                  {
                    logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/fhir/Location",result:typeResult.failed,
                    message:`Erreur: ${hapiServerResponse.message}`});
                    logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/syncorgunit2fhir",result:typeResult.failed,
                    message:`Erreur: ${hapiServerResponse.message}`});
                    let responseMessage=`Erreur: ${hapiServerResponse.message}`;
                    let bodyMessage=`${bundle.entry.length} Location a charger dans HAPI FHIR`;
                    returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"saveBundle2Fhir","POST");
                  }
                  res.set('Content-Type', 'application/json+openhim');
                  return res.status(returnObject.response.status).send(returnObject);
                });//end saveBundle2Fhir
            }
            else
            {
              logger.log({level:levelType.warning,operationType:typeOperation.normalProcess,action:"/syncorgunit2fhir",result:typeResult.failed,
              message:`0 orgunit retourné`});
              let status = 'Failed';
              let response = {};
              let returnObject=null;
              let responseMessage=`Erreur: 0 orgunit retourné`;
              let bodyMessage=`Extraction de la liste des structures de DHIS2`;
              returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"getListDHIS2OrgUnit","GET");
              res.set('Content-Type', 'application/json+openhim');
              return res.status(returnObject.response.status).send(returnObject);

            }
        });//end of getListDHIS2OrgUnit

  });//end get(/syncorgunit2fhir)
  app.get('/mapfacility2fhir', (req, res) => {
    globalRes=res;
    var listeSIGLStrutures=[];
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/mapfacility2fhir",result:typeResult.iniate,
    message:`Lancement du processus de mapping des structures eSIGL=>DHIS2`});
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`${filePath}`,result:typeResult.iniate,
        message:`Extraction des strucutures des fichiers`});
    customLibrairy.readeSIGLDataCSVFile(filePath,function(listStructures){
      if(listStructures.length>0)
      {
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`Lecture du fichier CSV des structures`,result:typeResult.success,
        message:`${listStructures.length} structures extraits de du fichier`});
        var listLocationIds=[];
        for(let mappingElement of listStructures)
        {
          if(mappingElement.iddhis)
          {
            listLocationIds.push(mappingElement.iddhis);
          }
        }
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/Location`,result:typeResult.iniate,
        message:`Resolution des correspondances avec les structures DHIS2 dans HAPI`});
        getListHAPILocationByIds(hapiToken,listLocationIds,function(listLocationToMap){
          if(listLocationToMap.length>0)
          {
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/Location`,result:typeResult.success,
             message:`${listLocationToMap.length} structures resolues pour mapping`});
            let updatedLocationBundle=customLibrairy.updateLocationFromSIGL(listLocationToMap,config.esiglServer.url,listStructures);
            //console.log()
            //res.send(updatedLocationBundle);
            if(updatedLocationBundle.entry && updatedLocationBundle.entry.length>=1)
            {
              logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/Location`,result:typeResult.iniate,
              message:`${listLocationToMap.length} structures a mapper`});

              saveBundle2Fhir(hapiToken,fhirLocationResource,updatedLocationBundle,function(hapiServerResponse)
              {
                //console.log(hapiServerResponse.status);
                let returnObject=null;
                if(hapiServerResponse.status==200)
                {
                  logger.log({level:levelType.info,operationType:typeOperation.postData,action:"/fhir/Location",result:typeResult.success,
                  message:`${hapiServerResponse.message}: ${updatedLocationBundle.entry.length} structures mappes`});
                  logger.log({level:levelType.info,operationType:typeOperation.postData,action:"/mapfacility2fhir",result:typeResult.success,
                  message:`${updatedLocationBundle.entry.length} structures mappes`});

                  let responseMessage=`${updatedLocationBundle.entry.length} Location ont ete charger avec success dans HAPI FHIR`;
                  let bodyMessage=`${updatedLocationBundle.entry.length} Location a charger dans HAPI FHIR`;
                  returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"mapfacility2fhir","GET");
                  
                }
                else
                {
                  logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/fhir/Location",result:typeResult.failed,
                  message:`Erreur: ${hapiServerResponse.message}`});
                  logger.log({level:levelType.info,operationType:typeOperation.postData,action:"/mapfacility2fhir",result:typeResult.failed,
                  message:`Erreur: ${hapiServerResponse.message}`});
                  let responseMessage=`Erreur: ${hapiServerResponse.message}`;
                  let bodyMessage=`${updatedLocationBundle.entry.length} Location a charger dans HAPI FHIR`;
                  returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"mapfacility2fhir","GET");
                }
                res.set('Content-Type', 'application/json+openhim');
                return res.status(returnObject.response.status).send(returnObject);
              }); //end saveBundle2Fhir

            }//end if updatedLocationBundle.entry
            else
            {
              logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/fhir/Location",result:typeResult.failed,
              message:`Erreur: Impossible de construire le Bundle de correspondance`});
              logger.log({level:levelType.info,operationType:typeOperation.getData,action:"/mapfacility2fhir",result:typeResult.failed,
              message:`Erreur: Impossible de construire le Bundle de correspondance`});
              let responseMessage=`Erreur: Impossible de construire le Bundle de correspondance`;
              let bodyMessage=`Resolution des correspondances avec les structures DHIS2 dans HAPI`;
              returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"mapfacility2fhir","GET");
              res.set('Content-Type', 'application/json+openhim');
              return res.status(returnObject.response.status).send(returnObject);
            }//end else updatedLocationBundle.entry
          }
          else
          {
            logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/fhir/Location",result:typeResult.failed,
            message:`Erreur: Aucune correspondance pour le mapping des structures`});
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:"/mapfacility2fhir",result:typeResult.failed,
            message:`Erreur: Aucune correspondance pour le mapping des structures`});
            let responseMessage=`Erreur: Aucune correspondance pour le mapping des structures`;
            let bodyMessage=`Resolution des correspondances avec les structures DHIS2 dans HAPI`;
            returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"mapfacility2fhir","GET");
            res.set('Content-Type', 'application/json+openhim');
            return res.status(returnObject.response.status).send(returnObject);
          }
        });
      }
      else{
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`${filePath}`,result:typeResult.failed,
        message:`Erreur: Aucune correspondance pour le mapping des structures`});
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:"/mapfacility2fhir",result:typeResult.failed,
        message:`Erreur: Aucune correspondance pour le mapping des structures`});
        let responseMessage=`Erreur: Aucune correspondance pour le mapping des structures`;
        let bodyMessage=`Resolution des correspondances avec les structures DHIS2 dans HAPI`;
        returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"mapfacility2fhir","GET");
        res.set('Content-Type', 'application/json+openhim');
        return res.status(returnObject.response.status).send(returnObject);
      }

      
      //return res.send(listStructures);
      

    });//end of customLibrairy.readeSIGLDataCSVFile
  });
  app.get('/syncprogramproduct2fhir', (req, res) => {
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncprogramproduct2fhir",result:typeResult.iniate,
    message:`Lancement du processus d'extraction des programs-produits eSIGL=>DHIS2`});
    const eSIGLToken = `Basic ${btoa(config.esiglServer.username+':'+config.esiglServer.password)}`;
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
		var orchestrations = [
      { 
			ctxObjectRef: "programs",
			name: "programs", 
			domain: config.esiglServer.url,
			path: config.esiglServer.resourcespath+"/lookup/programs",
			params: "",
			body: "",
			method: "GET",
			headers: {'Authorization': eSIGLToken,'Content-Type': 'application/json'}
		  },
		  {
			ctxObjectRef: "products",
			name: "products", 
			domain: config.esiglServer.url,
			path:config.esiglServer.resourcespath+"/lookup/products",
			params: "?paging=false",
			body: "",
			method: "GET",
			headers: {'Authorization': eSIGLToken,'Content-Type': 'application/json'}
      },
      {
        ctxObjectRef: "program-products",
        name: "program-products", 
        domain: config.esiglServer.url,
        path:config.esiglServer.resourcespath+"/lookup/program-products",
        params: "",
        body: "",
        method: "GET",
        headers: {'Authorization': eSIGLToken,'Content-Type': 'application/json'}
      }
      ];

    var async = require('async');
    let programsList=[];
    let productsList=[];
    let programproductsList=[];
    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/sigl/program-products`,result:typeResult.iniate,
    message:`Extraction de la liste des produits et programme associe`});
    async.eachSeries(orchestrations, (orchestration, nextOrchestration) => { 
      var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
      let localNeedle = require('needle');
      localNeedle.defaults(
      {
          open_timeout: 600000
      });
      let options={headers:orchestration.headers};
      console.log(orchUrl);
      localNeedle.get(orchUrl,options, function(err, resp) {
        if(err)
        {
          logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/sigl/${orchestration.name}`,result:typeResult.failed,
        message:`ESIGL: ${err.message}`});
          
        }
        console.log(`status code :${resp.statusCode}`);
        if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
          logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/sigl/${orchestration.name}`,result:typeResult.failed,
        message:`ESIGL: ${err.message}`});
			  }
        if (resp.statusCode && (resp.statusCode == 200)) {
           
          if(orchestration.name=="programs")
          {
            //console.log(resp.body.programs);
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/sigl/${orchestration.name}`,result:typeResult.ongoing,
        message:`${resp.body.programs.length} ${orchestration.name}: extraits`});
            programsList=programsList.concat(resp.body.programs);
          }
          if(orchestration.name=="products")
          {
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/sigl/${orchestration.name}`,result:typeResult.ongoing,
        message:`${resp.body.products.length} ${orchestration.name}: extraits`});
            productsList=productsList.concat(resp.body.products);
          }
          if(orchestration.name=="program-products")
          {
            logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/sigl/${orchestration.name}`,result:typeResult.ongoing,
        message:`${resp.body['program-products'].length} ${orchestration.name}: extraits`});
            programproductsList=programproductsList.concat(resp.body['program-products']);
          }
        }
        nextOrchestration();
      })//end of localNeedle.get(url orchestration)

    },function(err)
      {
        if(err)
        {
          logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/sigl/program-products`,result:typeResult.failed,
          message:`SIGL: ${err.message}`});
        }
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/sigl/program-products`,result:typeResult.success,
        message:` Programmes: ${programsList.length} |Produits: ${productsList.length} `});
        let listProgramCodes=[];
        for(let prog of programsList){
          if(!listProgramCodes.includes(prog.code)){
            listProgramCodes.push(prog.code);
          }
        }
        let listProductCodes=[];
        for(let prod of productsList){
          if(!listProductCodes.includes(prod.code)){
            listProductCodes.push(prod.code);
          }
        }
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/sigl/program-products`,result:typeResult.success,
        message:` Programmes Codes: ${listProgramCodes.toString().split(",").join("|").substr(0,400)} ...`});
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/sigl/program-products`,result:typeResult.success,
        message:` Produits Codes: ${listProductCodes.toString().split(",").join("|").substr(0,400)} ...`});

        let productProgram=customLibrairy.buildProgamProductRessourceBundle(programsList,productsList,programproductsList,config.esiglServer.url,
        config.extensionBaseUrlProductDetails,config.extensionBaseUrlProgramDetails);
        if(productProgram && productProgram.length>0)
        {
          let bundleProducts=productProgram[0];
          let bundlePrograms=productProgram[1];
          logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/program-products`,result:typeResult.iniate,
          message:`HAPI: Lancement de la mise a jour des produits et des programmes dans HAPI`});
          //return res.send(bundleProducts);
          saveBundle2Fhir(hapiToken,productResource,bundleProducts,(hapiServerResponse)=>{
            if(hapiServerResponse.status==200)
            {
              logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/product`,result:typeResult.success,
              message:`${hapiServerResponse.message}: ${bundleProducts.entry.length} produits mise a jour`});
              logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/program`,result:typeResult.iniate,
              message:`HAPI: Lancement de la mise a jour des programmes dans HAPI`});
              saveBundle2Fhir(hapiToken,programResource,bundlePrograms,(hapiServerResponse1)=>{
                let returnObject=null;
                if(hapiServerResponse1.status==200)
                {
                  logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/fhir/program`,result:typeResult.success,
                  message:`${hapiServerResponse1.message}: ${bundlePrograms.entry.length} programmes mise a jour`});
                  logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/syncprogramproduct2fhir`,result:typeResult.success,
                  message:`${bundleProducts.entry.length} produits et ${bundlePrograms.entry.length} programmes misent a jour`});
                  let responseMessage=`${bundleProducts.entry.length} produits et ${bundlePrograms.entry.length} programmes misent a jour`;
                  let bodyMessage=`Lancement de la mise a jour des produits et programmes dans HAPI`;
                  returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"syncprogramproduct2fhir","GET");
                }
                else
                {
                  logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/fhir/program`,result:typeResult.failed,
                  message:`Erreur lors de la mise a jour des programmes: ${hapiServerResponse1.message}`});
                  logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/syncprogramproduct2fhir`,result:typeResult.failed,
                  message:`Erreur: ${hapiServerResponse1.message}`});
                  let responseMessage=`Erreur lors de la mise a jour des programmes: ${hapiServerResponse1.message}`;
                  let bodyMessage=`Lancement de la mise a jour des produits et programmes dans HAPI`;
                  returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"syncprogramproduct2fhir","GET");
                }
                res.set('Content-Type', 'application/json+openhim');
                return res.status(returnObject.response.status).send(returnObject);
                });//end saveBundle2fhir(programResource)
                //res.send(hapiServerResponse);
            }
            else
            {//productResource
              logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/fhir/product`,result:typeResult.failed,
              message:`Erreur lors de la mise a jour des produits: ${hapiServerResponse.message}`});
              logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/syncprogramproduct2fhir`,result:typeResult.failed,
              message:`Erreur lors de la mise a jour des produits: ${hapiServerResponse.message}`});
              let responseMessage=`${bundleProducts.entry.length} produits et ${bundlePrograms.entry.length} programmes misent a jour`;
              let bodyMessage=`Lancement de la mise a jour des produits et programmes dans HAPI`;
              let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"syncprogramproduct2fhir","GET");
              res.set('Content-Type', 'application/json+openhim');
              return res.status(returnObject.response.status).send(returnObject);
            }
          });//end ofsaveBundle2Fhir(productResource)
        }
        else
        {
          logger.log({level:levelType.error,operationType:typeOperation.normalProcess,action:`buildProgamProductRessourceBundle`,result:typeResult.failed,
          message:`Erreur lors de la transformation en Bundle des produits et programmes ESIGL`});
          logger.log({level:levelType.error,operationType:typeOperation.normalProcess,action:`/syncprogramproduct2fhir`,result:typeResult.failed,
          message:`Erreur lors de la transformation en Bundle des produits et programmes ESIGL`});
          let responseMessage=`Erreur lors de la transformation en Bundle des produits et programmes ESIGL`;
          let bodyMessage=`Transformation des produits et programmes en Bundle`;
          let returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"buildProgamProductRessourceBundle","GET");
          res.set('Content-Type', 'application/json+openhim');
          return res.status(returnObject.response.status).send(returnObject);
        }
      }
    );//end of async.orchestrations

    
  });
  app.get('/syncprogramproduct2dhis', (req, res) => {
    globalRes=res;
    var operationOutcome=true;
    logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"/syncprogramproduct2dhis2",result:typeResult.iniate,
    message:`Lancement du processus de synchronisation des programmes-produits dans DHIS2`});
    const dhis2Token = `Basic ${btoa(config.dhis2Server.username+':'+config.dhis2Server.password)}`;
    const hapiToken = `Basic ${btoa(config.hapiServer.username+':'+config.hapiServer.password)}`;
    logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/program`,result:typeResult.iniate,
    message:`HAPI: Extraction de la liste des programmes`});
    getListHapiResource(hapiToken,fhirProgramResource,(listProgramsEntries)=>{
      //res.status(200).send(listProgramsEntry);
      logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/fhir/program`,result:typeResult.success,
      message:`HAPI: ${listProgramsEntries.length} programmes extraits`});
      let async = require('async');
      async.eachSeries(listProgramsEntries, function(programEntry, nextStep) {
        
        var listResourceIds=[];
        for(let extensionElement of programEntry.resource.extension[0].extension)
        {
          if(extensionElement.url=="providedProducts")
          {
            listResourceIds.push(extensionElement.valueReference.reference.split("/")[1]);
          }
        }
        logger.log({level:levelType.info,operationType:typeOperation.getData,action:"/fhir/product",result:typeResult.iniate,
        message:`Extraction des details sur les produits du programme ${programEntry.resource.name}`});
        getListHAPIResourcesByIds(hapiToken,fhirProductResource,listResourceIds,(listProducts)=>{
          logger.log({level:levelType.info,operationType:typeOperation.getData,action:"/fhir/product",result:typeResult.success,
          message:`Extraction des details sur les produits du programme ${programEntry.resource.name} effectuees`});
          let listCategoryOptions =customLibrairy.buildCategoryOptionsMetadata(prodIDPrefixe,listProducts);
          
          //console.log(JSON.stringify(payload));
          logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}`,result:typeResult.iniate,
          message:`Lancement de la mise a jour des ${listCategoryOptions.length} produits du ${programEntry.resource.name}`});
          saveMetadataList2Dhis(dhis2Token,dhisCategoryOption,listCategoryOptions,(dhisOpResponse)=>{
            
            //console.log(dhisOpResponse);
            let listProducts2Update=[];
            //Now get the metadata to update, those with conflict HTTP status
            if(dhisOpResponse && dhisOpResponse.length>0){
              let tempList= dhisOpResponse.filter(element=>{
                if(element.httpStatus == "Conflict")
                {
                  return element;
                }
              });
              for(let opResponse of tempList){
                listProducts2Update.push(opResponse.metadata);
              } 
            }

            logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}`,result:typeResult.success,
            message:`${listCategoryOptions.length-listProducts2Update.length} produits du ${programEntry.resource.name} inseres`});
            //operationMessage+=`${listCategoryOptions.length} `
            if(listProducts2Update.length>0)
            {
              logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/api/${dhisCategoryOption}`,result:typeResult.iniate,
              message:`Lancement de la mise a jour des details sur les produits du programme ${programEntry.resource.name}`});
              updateMetadataList2Dhis(dhis2Token,dhisCategoryOption,listProducts2Update,(dhisUpdateOperation)=>{
                logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}`,result:typeResult.success,
                message:`${listProducts2Update.length} produits du ${programEntry.resource.name} mise a jour`});
                //console.log(dhisUpdateOperation);
                //Transform program to category
                
                let programMetadataList=[customLibrairy.buildCategoryMetadata(programEntry.resource)];
                logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}`,result:typeResult.iniate,
                message:`Creation de la category ${programEntry.resource.name} dans DHIS2`});
                saveMetadataList2Dhis(dhis2Token,dhisCategory,programMetadataList,(dhisProgAddResponse)=>{
                  //if the program is newly created or exist already add the collections of object 
                  //console.log(dhisProgAddResponse);
                  if(dhisProgAddResponse[0].httpStatus=="OK" || dhisProgAddResponse[0].httpStatus=="Created" || dhisProgAddResponse[0].httpStatus=="Conflict"){
                    //build the collection of object to add
                    logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}`,result:typeResult.success,
                message:`Creation de la category ${programEntry.resource.name} dans DHIS2`});
                    let categoryOptionsCollection={identifiableObjects:[]};
                    for(let categoryOption of listCategoryOptions){
                      categoryOptionsCollection.identifiableObjects.push(
                        {
                          id:categoryOption.id
                        }
                      );
                    }
                    
                    let oIdentifier=programEntry.resource.identifier.find(id=>id.type.text=="dhisId");
                    let dhisIdProgram=oIdentifier.value;
                    logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}/${dhisIdProgram}`,result:typeResult.iniate,
                    message:`Ajout de la collection des produits dans la category ${programEntry.resource.name} dans DHIS2`});
                    saveMetadataCollection2Dhis(dhis2Token,dhisCategory,dhisIdProgram,dhisCategoryOption,categoryOptionsCollection,
                    (dhisCreateCollectionOp)=>{
                      
                      if(dhisCreateCollectionOp[0].httpStatus=="OK"){
                        //Then create the catcombo
                        logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}/${dhisIdProgram}`,result:typeResult.success,
                        message:`Ajout de la collection des produits dans la category ${programEntry.resource.name} dans DHIS2`});
                        let programCatCombosMatadataList=[customLibrairy.buildCategoryCombosMetadata(programEntry.resource)];
                        logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryCombo}`,result:typeResult.iniate,
                        message:`Creation de la ${dhisCategoryCombo} ${programEntry.resource.name} dans DHIS2`});
                        saveMetadataList2Dhis(dhis2Token,dhisCategoryCombo,programCatCombosMatadataList,(dhisProgComboAddResponse)=>{
                          if(dhisProgComboAddResponse[0].httpStatus=="OK" ||
                          dhisProgComboAddResponse[0].httpStatus=="Created" || 
                          dhisProgComboAddResponse[0].httpStatus=="Conflict"){
                            logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryCombo}`,result:typeResult.success,
                            message:`Creation de la ${dhisCategoryCombo} ${programEntry.resource.name} dans DHIS2`});
                            operationOutcome=operationOutcome&&true;
                            //console.log(dhisProgComboAddResponse);
                            //nextStep({warn:'break on the first loop'});
                            nextStep();
                          }
                          else{
                            operationOutcome=operationOutcome && false;
                            logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/api/${dhisCategoryCombo}`,result:typeResult.failed,
                            message:`Erreur:${dhisProgComboAddResponse[0].httpStatus}: echec de la creation de ${dhisCategoryCombo} ${programEntry.resource.name} dans DHIS2`});
                    
                            let err={message:`Erreur:${dhisProgComboAddResponse[0].httpStatus}: echec de la creation de ${dhisCategoryCombo} ${programEntry.resource.name} dans DHIS2`};
                            nextStep(err);
                            
                          }
                        });
                      }
                      else{
                        operationOutcome= operationOutcome&& false;
                        logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/api/${dhisCategory}`,result:typeResult.failed,
                        message:`Erreur:${dhisProgComboAddResponse[0].httpStatus}: Echec de la creation de ${dhisCategory} ${programEntry.resource.name} dans DHIS2`});
                    
                        let err={message:`Erreur:${dhisProgAddResponse[0].httpStatus}: Echec de la creation de ${dhisCategory} ${programEntry.resource.name} dans DHIS2`};
                        nextStep(err);
                      }
                       //nextStep();
                    })//end saveMetadataCollection2Dhis()

                  }
                  else{
                    operationOutcome=operationOutcome && false;
                    logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/saveMetadataList2Dhis",result:typeResult.failed,
                    message:`Erreur:${dhisProgAddResponse[0].httpStatus}: echec de la creation de la caterogie ${programEntry.resource.name} dans DHIS2`});
                    
                    let err={message:`Erreur:${dhisProgAddResponse[0].httpStatus}: echec de la creation de la caterogie ${programEntry.resource.name} dans DHIS2`};
                    nextStep(err);
                  }

                });//end saveMetadataList2Dhis(programMetadataList)

                
              });//end updateMetadataList2Dhis
            }
            else
            {
              let programMetadataList=[customLibrairy.buildCategoryMetadata(programEntry.resource)];
                logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}`,result:typeResult.iniate,
                message:`Creation de la category ${programEntry.resource.name} dans DHIS2`});
                saveMetadataList2Dhis(dhis2Token,dhisCategory,programMetadataList,(dhisProgAddResponse)=>{
                  //if the program is newly created or exist already add the collections of object 
                  //console.log(dhisProgAddResponse);
                  if(dhisProgAddResponse[0].httpStatus=="OK" ||dhisProgAddResponse[0].httpStatus=="Created" 
                  || dhisProgAddResponse[0].httpStatus=="Conflict")
                  {
                    //build the collection of object to add
                    logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}`,result:typeResult.success,
                    message:`Creation de la category ${programEntry.resource.name} dans DHIS2`});
                    let categoryOptionsCollection={identifiableObjects:[]};
                    for(let categoryOption of listCategoryOptions){
                      categoryOptionsCollection.identifiableObjects.push(
                        {
                          id:categoryOption.id
                        }
                      );
                    }
                    logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}`,result:typeResult.iniate,
                    message:`Creation de la collection dans la category ${programEntry.resource.name} dans DHIS2`});
                    let oIdentifier=programEntry.resource.identifier.find(id=>id.type.text=="dhisId");
                    let dhisIdProgram=oIdentifier.value;
                    saveMetadataCollection2Dhis(dhis2Token,dhisCategory,dhisIdProgram,dhisCategoryOption,categoryOptionsCollection,
                    (dhisCreateCollectionOp)=>{
                      if(dhisCreateCollectionOp[0].httpStatus=="OK"){
                        logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryOption}`,result:typeResult.success,
                        message:`Creation de la collection dans la category ${programEntry.resource.name} dans DHIS2`});
                        //Then create the catcombo
                        let programCatCombosMatadataList=[customLibrairy.buildCategoryCombosMetadata(programEntry.resource)];
                        logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryCombo}`,result:typeResult.iniate,
                        message:`Creation de la ${dhisCategoryCombo} ${programEntry.resource.name} dans DHIS2`});
                        saveMetadataList2Dhis(dhis2Token,dhisCategoryCombo,programCatCombosMatadataList,(dhisProgComboAddResponse)=>{
                          

                          if(dhisProgComboAddResponse[0].httpStatus=="OK" ||
                          dhisProgComboAddResponse[0].httpStatus=="Created" || 
                          dhisProgComboAddResponse[0].httpStatus=="Conflict"){
                            logger.log({level:levelType.info,operationType:typeOperation.postData,action:`/api/${dhisCategoryCombo}`,result:typeResult.success,
                            message:`Creation de la ${dhisCategoryCombo} ${programEntry.resource.name} dans DHIS2`});
                            //console.log(dhisProgComboAddResponse);
                            //nextStep({warn:'break on the first loop'});
                            operationOutcome= operationOutcome&& true;
                            nextStep();
                          }
                          else{
                            operationOutcome=operationOutcome&&false;
                            logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/api/${dhisCategoryCombo}`,result:typeResult.failed,
                            message:`Erreur:${dhisProgComboAddResponse[0].httpStatus}: echec de la creation de ${dhisCategoryCombo} ${programEntry.resource.name} dans DHIS2`});
                    
                            let err={message:`Erreur:${dhisProgComboAddResponse[0].httpStatus}: echec de la creation de ${dhisCategoryCombo} ${programEntry.resource.name} dans DHIS2`};
                            nextStep(err);
                          }
                        });
                      }
                      else{
                        operationOutcome=operationOutcome&&false;
                        logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${dhisCategory}`,result:typeResult.failed,
                        message:`Erreur:${dhisProgComboAddResponse[0].httpStatus}: echec de la creation de ${dhisCategory} ${programEntry.resource.name} dans DHIS2`});
                    
                        let err={message:`Erreur:${dhisProgAddResponse[0].httpStatus}: echec de la creation de ${dhisCategory} ${programEntry.resource.name} dans DHIS2`};
                        nextStep(err);
                      }
                       //nextStep();
                    })//end saveMetadataCollection2Dhis()

                  }
                  else
                  {
                    operationOutcome=operationOutcome&&false;
                    logger.log({level:levelType.error,operationType:typeOperation.postData,action:"/saveMetadataList2Dhis",result:typeResult.failed,
                    message:`Erreur:${dhisProgAddResponse[0].httpStatus}: echec de la creation de la caterogie ${programEntry.resource.name} dans DHIS2`});
                    
                    let err={message:`Erreur:${dhisProgAddResponse[0].httpStatus}: echec de la creation de la caterogie ${programEntry.resource.name} dans DHIS2`};
                    nextStep(err);
                  }

                });//end saveMetadataList2Dhis(programMetadataList
            }
            
            //Break on the first loop
            
          });//end saveMetadataList2Dhis
          
        });//end getListHAPIResourcesByIds(...)
        //nextStep();
      },function(err){
        if(err)
        {

          operationOutcome=operationOutcome && false;
        }
        let returnObject=null;
        if(operationOutcome)
        {
          logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/syncprogramproduct2dhis`,result:typeResult.success,
          message:`Operation de synchronisation des produits et programmes dans DHIS2 effectuees avec success`});
          let responseMessage=`Operation de synchronisation des produits et programmes dans DHIS2 effectuees avec success`;
          let bodyMessage=`Lancement du processus de synchronisation des programmes-produits dans DHIS2`;
          returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.successful,"syncprogramproduct2dhis","GET");
        
        }
        else{
          logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/syncprogramproduct2dhis`,result:typeResult.failed,
          message:`Problemes lors de l'operation de synchronisation des produits et programmes dans DHIS2`});
          let responseMessage=`Problemes lors de l'operation de synchronisation des produits et programmes dans DHIS2`;
          let bodyMessage=`Lancement du processus de synchronisation des programmes-produits dans DHIS2`;
          returnObject=getOpenhimResult(responseMessage,bodyMessage,typeOpenhimResultStatus.failed,"syncprogramproduct2dhis","GET");
         
        }
        res.set('Content-Type', 'application/json+openhim');
        return res.status(returnObject.response.status).send(returnObject);
      
      });//end async.eachseries(listProgramsEntry)


    });//end getListHapiResource
  });

  return app
}
function saveEntryToElastic(url,esToken,logEntries,callbackMain)
{
    let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let async=require('async');
    var responseCollection=[];
	let options={headers:{'Content-Type': 'application/json','Authorization':esToken}};
	var logCounter=1;
    async.each(logEntries, function(logEntry, callback) {
        logCounter++;
        localNeedle.post(url,JSON.stringify(logEntry),options,function(err,resp){
            if(err)
            {
                console.log(err);
                callback(err);
            }
			if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
          console.log(`Code d'erreur http: ${resp.statusCode}`);
				//return callback(true, false);
			}
			else{
				var response={
					status: resp.statusCode,
					boby: resp.body,
					timestamp:new Date().getTime()
				}
        responseCollection.push(response);
        console.log(`Insertion du log dans Elasticsearch`);
			}
            callback();
        }); //end of localNeedle.post

    },function(err){
        if(err)
        {
            //console.log(err);
            logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
             message:`${err.Error}`});
        }
        return callbackMain(responseCollection);
    });//end of aysnc.each
    
}
function getListDHIS2OrgUnit(dhis2Token,callbackMain){
    let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let localAsync = require('async');
    var resourceData = [];
    var url= URI(config.dhis2Server.url).segment(orgUnitResource+".json");
    url.addQuery('order', "level:asc");
    url.addQuery('pageSize',config.batchSizeFacilityToSync);
    url.addQuery('fields',"href,id,code,level,parent,displayName");
    url = url.toString();
    localAsync.whilst(
        callback => {
            return callback(null, url !== false);
          },
        callback => {
            
            var options={headers:{'Authorization':dhis2Token}};
            localNeedle.get(url,options, function(err, resp) {
                //url = false;
                if (err) {
                  logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                  message:`${err.Error}`});
                  return callback(true, false);
                }
                if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
					logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Code d'erreur http: ${resp.statusCode}`});
                    return callback(true, false);
                }
                var body = resp.body;
                //var body = JSON.parse(resp.body);
                if (!body.organisationUnits) {
					logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Ressources invalid retournees par DHIS2`});
                    return callback(true, false);
                }
                if (body.pager.total === 0) {
					logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                        message:`Pas de ressources retournees par DHIS - page: ${body.pager.page}`});
                    return callback(true, false);
                }
                url=false;
                if (body.organisationUnits && body.organisationUnits.length > 0) {
					/* logger.log({level:levelType.info,operationType:typeOperation.getData,action:`getListDHIS2OrgUnit page:${body.pager.page}/${body.pager.pageCount}`,
					result:typeResult.success,message:`Extraction de  ${body.organisationUnits.length} orgunits de DHIS2`}); */
                    resourceData = resourceData.concat(body.organisationUnits);
                    //force return only one loop data
                    //return callback(true, false);
                }
                const next = body.pager.nextPage;

                if(next)
                {
                    url = next;
                }
                return callback(null, url);
            })//end of needle.get
              
        },//end callback 2
        err=>{
            return callbackMain(resourceData);

        }
    );//end of async.whilst
}
function getListHapiResource(hapiToken,fhirResource,callbackMain)
{
  let localNeedle = require('needle');
    localNeedle.defaults(
        {
            open_timeout: 600000
        });
    let options={headers:{'Content-Type': 'application/json','Authorization':hapiToken}};
    let localAsync = require('async');
    var resourceData = [];
    var url= URI(config.hapiServer.url).segment(fhirResource);
    url.addQuery('_format', "json");
    url = url.toString();
    localAsync.whilst(
      callback => {
          return callback(null, url !== false);
        },
      callback => {
          
          localNeedle.get(url,options, function(err, resp) {
              //url = false;
              if (err) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`${err.Error}`});
                return callback(true, false);
              }
              if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
              logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Code d'erreur http: ${resp.statusCode}`});
                  return callback(true, false);
              }
              let body = JSON.parse(resp.body);
              if (!body.entry) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                      message:`Ressource invalid retourner par le serveur FHIR: ${resp.statusCode}`});
                return callback(true, false);
              }
              if (body.total === 0 && body.entry && body.entry.length > 0) {
                logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
                message:`Aucune resource retourne par le serveur HAPI: ${resp.statusCode}`});
                return callback(true, false);
              }
              url = false;
              if (body.entry && body.entry.length > 0) {
                  resourceData = resourceData.concat(body.entry);
              }
              const next =  body.link && body.link.find(link => link.relation === 'next');

              if(next)
              {
                  url = next.url;;
              }
              return callback(null, url);
          })//end of needle.get
            
      },//end callback 2
      err=>{
          return callbackMain(resourceData);

      }
  );//end of async.whilst



}
function getListHAPILocationByIds(hapiToken,listLocationIds,callbackMain){
  let localNeedle = require('needle');
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  let options={headers:{'Content-Type': 'application/json','Authorization':hapiToken}};
  let localAsync = require('async');
  var listLocationsToMap = [];
  var currentIdToFetch="";
  var url=null;
  localAsync.eachSeries(listLocationIds, function(locationId, callback) {
    currentIdToFetch=locationId;
    url= URI(config.hapiServer.url).segment('Location').segment(locationId); 
    url=url.toString();
    localNeedle.get(url,options, function(err, resp) {
      if(err)
      {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`${url}`,result:typeResult.failed,
      message:`${err.Error}`});
      return callback(`${err}`);
      }
      if (resp.statusCode && (resp.statusCode == 200)) {
        listLocationsToMap.push(JSON.parse(resp.body.toString('utf8')));
      }
      callback();
    });//end of localNeedle
  },function(error){
    if(error)
    {
      /* logger.log({level:levelType.error,operationType:typeOperation.getData,action:`${url}`,result:typeResult.failed,
      message:`${error.message}`}); */
    }
    callbackMain(listLocationsToMap);
  });//end of localAsync.each

}
function getListHAPIResourcesByIds(hapiToken,fhirResource,listResourcesIds,callbackMain){
  let localNeedle = require('needle');
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  let options={headers:{'Content-Type': 'application/json','Authorization':hapiToken}};
  let localAsync = require('async');
  var listResources = [];
  var currentIdToFetch="";
  
  localAsync.eachSeries(listResourcesIds, function(resourceId, callback) {
    currentIdToFetch=resourceId;
    var url= URI(config.hapiServer.url).segment(fhirResource).segment(resourceId); 
    url=url.toString();
    /* logger.log({level:levelType.info,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.iniate,
      message:`Mapping: Extraction des donnees`}); */ 
    localNeedle.get(url,options, function(err, resp) {
      if(err)
      {
        logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
        message:`${err.Error}`});
        callback(err);
      }
      
      if (resp.statusCode && (resp.statusCode == 200)) {
      listResources.push(JSON.parse(resp.body.toString('utf8')));
      callback();
      }

      
    });//end of localNeedle
  },function(error){
    if(error)
    {
      /* logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${url}`,result:typeResult.failed,
      message:`${error.message}`}); */
    }
    callbackMain(listResources);
  });//end of localAsync.each

}

function saveBundle2Fhir(fhirToken,fhirResource,bundle,callback){
    let localNeedle = require('needle');
    localNeedle.defaults(
    {
        open_timeout: 600000
    });
    //console.log("hapi server"+config.hapiServer);
    const url = URI(config.hapiServer.url).toString();
    let options={headers:{'Content-Type': 'application/json','Authorization':fhirToken}};
    localNeedle.post(url,JSON.stringify(bundle),options,function(err,resp){
        if(err)
        {
            logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                        message:`${err.Error}`});
            return callback({status:500});
        }
        var response={
            status: resp.statusCode,
            message: `${bundle.entry.length} ${fhirResource} synchronisees dans HAPI`,
            timestamp:new Date().getTime()
        }
        
        if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
			logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                        message:`Code d'erreur http: ${resp.statusCode}`});
            return callback({status:500});
          }
        callback(response);
    });

}
function saveMetadataList2Dhis(dhis2Token,dhisResource,listMetadata,callback){
  let localNeedle = require('needle');
  let localAsync = require('async');
  let dicOperationResults=[];
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  var url= URI(config.dhis2Server.url).segment(dhisResource);
  url = url.toString();
  let options={headers:{'Content-Type': 'application/json','Authorization':dhis2Token}};
  let listAlreadyExistedResources=[];
  localAsync.eachSeries(listMetadata, function(metadata, nextResource) {
    
    localNeedle.post(url,JSON.stringify(metadata),options,function(err,resp){
      if(err)
      {
          logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                      message:`${err.Error}`});
          nextResource(err);

      }
      dicOperationResults.push({
        httpStatus:resp.body.httpStatus,
        metadata:metadata
      });
      if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
        if(resp.statusCode==409)
        {
          //console.log(metadata);
          /* logger.log({level:levelType.warning,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                          message:`Code: ${resp.statusCode}. Impossible de creer une ressource [${metadata.id}-${metadata.name}] qui existe deja`}); */
          listAlreadyExistedResources.push(`${metadata.id}`);
        }
        else{
          logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                          message:`Code d'erreur http: ${resp.statusCode}`});
        }
      }
      nextResource();
      
    });//end localNeedle
  },(err)=>{
    if(err)
    {
      /* logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${dhisResource}`,result:typeResult.failed,
      message:`${err.message}`}); */
    }
    if(listAlreadyExistedResources.length>0)
    {
      let stringListResource=listAlreadyExistedResources.toString().split(",").join("|").substr(0,400);
      logger.log({level:levelType.warning,operationType:typeOperation.getData,action:`/api/${dhisResource}`,result:typeResult.failed,
      message:`Impossible de creer des resources qui existe deja: ${stringListResource} ...`});

    }
    callback(dicOperationResults);
    
  });//end localAsync
  

}
function saveMetadataCollection2Dhis(dhis2Token,dhisParentResource,parentId,dhisCollectionResource,
  metaDataCollection,callback){
  let localNeedle = require('needle');
  let localAsync = require('async');
  let dicOperationResults=[];
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  var url= URI(config.dhis2Server.url).segment(dhisParentResource).segment(parentId).segment(dhisCollectionResource);
  url = url.toString();
  let options={headers:{'Content-Type': 'application/json','Authorization':dhis2Token}};
  /* console.log(url);
  console.log(JSON.stringify( metaDataCollection));
  console.log("-----------------------------------------"); */
  localNeedle.post(url,JSON.stringify(metaDataCollection),options,function(err,resp){
    if(err)
    {
        logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                    message:`${err.message}`});
        callback({
          httpStatus:"Failed",
          metadata:{}
        });
    }
    let httpStatus="";
    //console.log(resp.body);
    if(resp.body.httpStatus){
      httpStatus=resp.body.httpStatus;
    }
    else{
      httpStatus="OK";
    }
    dicOperationResults.push({
      httpStatus:httpStatus,
      metadata:metaDataCollection
    });
    
    if (httpStatus!="OK") {
      logger.log({level:levelType.warning,operationType:typeOperation.postData,action:`/${url}`,result:typeResult.failed,
                        message:`Code: ${httpStatus}. Impossible de creer la ressource`});
    }
    callback(dicOperationResults);
  });//end localNeedle
}
function updateMetadataList2Dhis(dhis2Token,dhisResource,listMetadata,callback){
  let localNeedle = require('needle');
  let localAsync = require('async');
  let dicOperationResults=[];
  localNeedle.defaults(
      {
          open_timeout: 600000
      });
  
  //url = url.toString();
  let options={headers:{'Content-Type': 'application/json','Authorization':dhis2Token}};
  localAsync.eachSeries(listMetadata, function(metadata, nextResource) {
    let url= URI(config.dhis2Server.url).segment(dhisResource).segment(metadata.id);
    url=url.toString();
    localNeedle.put(url,JSON.stringify(metadata),options,function(err,resp){
      if(err)
      {
          logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${dhisResource}`,result:typeResult.failed,
                      message:`${err.Error}`});
          nextResource(err);
          
      }
      dicOperationResults.push({
        httpStatus:resp.body.httpStatus,
        metadata:metadata
      });
      if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode > 399)) {
        logger.log({level:levelType.error,operationType:typeOperation.postData,action:`/${dhisResource}`,result:typeResult.failed,
                          message:`Code d'erreur http: ${resp.statusCode}`});
      }
      nextResource();
      
    });//end localNeedle
  },(err)=>{
    if(err)
    {
      /* logger.log({level:levelType.error,operationType:typeOperation.getData,action:`/${dhisResource}`,result:typeResult.failed,
      message:`${err.message}`}); */
    }
    callback(dicOperationResults);
    
  });//end localAsync
  

}
function  getOpenhimResult(responseMessage, bodyMessage,statusValue,orchestrationName,HttpMethod)
{
  let urn = mediatorConfig.urn;
  let status = null;
  let response = null;
  if(statusValue==typeOpenhimResultStatus.successful)
  {
    status = 'Successful';
    response = {
    status: 200,
      headers: {
      'content-type': 'application/json'
      },
      body:JSON.stringify( {'Process':`${responseMessage}`}),
      timestamp: new Date().getTime()
    };
  }
  else
  {
    status = 'Failed';
    response = {
    status: 500,
      headers: {
      'content-type': 'application/json'
      },
      body:JSON.stringify( {'Process':`${responseMessage}`}),
      timestamp: new Date().getTime()
    };
  }
  var orchestrationToReturn=[
  {
    name: orchestrationName,
    request: {
      path :`/${orchestrationName}`,
      headers: {'Content-Type': 'application/json'},
      querystring: "",
      body:JSON.stringify( {'Process':`${bodyMessage}`}),
      method: HttpMethod,
      timestamp: new Date().getTime()
    },
    response: response
  }];
  var openhimObject = {
    "x-mediator-urn": urn,
    "status": status,
    "response": response,
    "orchestrations": orchestrationToReturn,
    "properties": ""
  }
  return openhimObject;
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  filePath=mediatorConfig.config.appDirectory;
  processMonth= parseInt(mediatorConfig.config.synchronizationPeriod.split("-")[1]);
  processYear= parseInt(mediatorConfig.config.synchronizationPeriod.split("-")[0]);
  indexName=`principal_activities_${processMonth}-${processYear}`;
  logFileName=path.join(filePath,`/logs/${indexName}.log`);
  logger = createLogger({
      format: combine(
        label({ label: mediatorName }),
        timestamp(),
        myFormat
      ),
      transports: [new transports.Console(),
          new transports.File({ filename: logFileName })
      ]
    });
  //let winstonLocal=require();
  if (apiConf.api.trustSelfSigned) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' }

  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        logger.log({level:levelType.error,operationType:typeOperation.normalProcess,action:`Enregistrement du mediateur`,result:typeResult.failed,
                        message:`Echec d'enregistrement du mediateur ${mediatorName}`}); 
        console.log(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"Reception des configurations intiales",
        result:typeResult.ongoing,message:`Reception des configurations intiales`});
        console.log(`Reception des configurations intiales`);
        config = newConfig
        if (err) {
          logger.log({level:levelType.error,operationType:typeOperation.normalProcess,action:`Echec d'obtention des configurations initiales`,result:typeResult.failed,
                        message:`Echec d'obtention des configurations initiales`}); 
          
          console.log(err.stack)
          process.exit(1)
        } else {
          logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"Reception des configurations intiales",
        result:typeResult.success,message:`Enregistrement du mediateur avec succes`});
          let app = setupApp()
          const server = app.listen(port, () => {
            if (apiConf.heartbeat) {
              let configEmitter = medUtils.activateHeartbeat(apiConf.api)
              configEmitter.on('config', (newConfig) => {
                logger.log({level:levelType.info,operationType:typeOperation.normalProcess,action:"Obtension des configuratiobns a jour",
        result:typeResult.success,message:`Obtention des configurations avec succes`});
                //winston.info('Received updated config:')
                console.log(JSON.stringify(newConfig))
                // set new config for mediator
                config = newConfig

                // we can act on the new config received from the OpenHIM here
                //winston.info(config)
              })
            }
            callback(server)
          })
        }
      })
    })
  } else {
    // default to config from mediator registration
    config = mediatorConfig.config
    let app = setupApp()
    const server = app.listen(port, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => console.log(`Listening on ${port}...`))
}

process.on('uncaughtException', err => {
  console.log(err);
  logger.log({level:levelType.error,operationType:typeOperation.stopTheService,action:`arret anormal du mediateur sur l'action `,result:typeResult.failed,
  message:`Stop the mediator on ${port}...`})
  //process.exit(1)
  if(globalRes)
  {
    globalRes.redirect("/error");
  }
  
});
process.on('SIGTERM', signal => {
  logger.log({level:levelType.info,operationType:typeOperation.stopTheService,action:"Arret du mediateur",result:typeResult.success,
  message:`Arret normal du mediateur`})
  process.exit(0)
});
process.on('SIGINT', signal => {
logger.log({level:levelType.error,operationType:typeOperation.stopTheService,action:"Arret brusque du mediateur",result:typeResult.failed,
message:`Arret anormal du mediateur`})
process.exit(0)
})

